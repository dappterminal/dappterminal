/**
 * 1inch Protocol Commands
 */

import type { Command, CommandResult, ExecutionContext } from '@/core'
import { resolveTokenAddress } from './tokens'

/**
 * Price command - Get token price
 */
export const priceCommand: Command = {
  id: 'price',
  scope: 'G_p',
  protocol: '1inch',
  description: 'Get token price from 1inch',
  aliases: ['p'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ')
      const token = parts[0]

      if (!token) {
        return {
          success: false,
          error: new Error('Usage: price <token>\nExample: price eth'),
        }
      }

      const chainId = context.wallet.chainId || 1

      // Resolve token symbol to address
      const tokenAddress = resolveTokenAddress(token, chainId)

      const response = await fetch(`/api/1inch/prices/price_by_token?chainId=${chainId}&token=${tokenAddress}`)

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: new Error(errorData.error || 'Failed to get price'),
        }
      }

      const data = await response.json()

      return {
        success: true,
        value: {
          tokenPrice: true,
          token,
          price: data.price,
          tokenAddress: data.token,
          chainId,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}

/**
 * Gas command - Get gas prices
 */
export const gasCommand: Command = {
  id: 'gas',
  scope: 'G_p',
  protocol: '1inch',
  description: 'Get current gas prices from 1inch',
  aliases: ['g'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const chainId = context.wallet.chainId || 1

      const response = await fetch(`/api/1inch/gas?chainId=${chainId}`)

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: new Error(errorData.error || 'Failed to get gas prices'),
        }
      }

      const data = await response.json()

      return {
        success: true,
        value: {
          gasPrices: true,
          chainId,
          baseFee: data.baseFee,
          low: data.low,
          medium: data.medium,
          high: data.high,
          instant: data.instant,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}

/**
 * Swap command - Execute token swap
 */
export const swapCommand: Command = {
  id: 'swap',
  scope: 'G_p',
  protocol: '1inch',
  description: 'Swap tokens using 1inch aggregator',
  aliases: ['s'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Verify wallet is connected
      if (!context.wallet.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      // Parse arguments: swap <amount> <fromToken> <toToken> [--slippage <percent>]
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ')

      if (parts.length < 3) {
        return {
          success: false,
          error: new Error(
            'Usage: swap <amount> <fromToken> <toToken> [--slippage <percent>]\n' +
            'Example: swap 0.1 eth usdc --slippage 0.5'
          ),
        }
      }

      const amount = parts[0]
      const fromToken = parts[1]
      const toToken = parts[2]

      // Parse slippage flag
      let slippage = 1 // Default 1%
      const slippageIndex = parts.indexOf('--slippage')
      if (slippageIndex !== -1 && slippageIndex + 1 < parts.length) {
        slippage = parseFloat(parts[slippageIndex + 1])
      }

      const chainId = context.wallet.chainId || 1

      // Resolve token symbols to addresses
      const srcAddress = resolveTokenAddress(fromToken, chainId)
      const dstAddress = resolveTokenAddress(toToken, chainId)

      // Get swap quote first
      const quoteResponse = await fetch(
        `/api/1inch/swap/classic/quote?chainId=${chainId}&src=${srcAddress}&dst=${dstAddress}&amount=${amount}&slippage=${slippage}`
      )

      if (!quoteResponse.ok) {
        const errorData = await quoteResponse.json()
        return {
          success: false,
          error: new Error(errorData.error || 'Failed to get swap quote'),
        }
      }

      const quote = await quoteResponse.json()

      // Return transaction request for terminal to handle signing
      return {
        success: true,
        value: {
          swapRequest: true,
          fromToken,
          toToken,
          amountIn: amount,
          amountOut: quote.dstAmount,
          gas: quote.gas,
          slippage,
          chainId,
          walletAddress: context.wallet.address,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}
