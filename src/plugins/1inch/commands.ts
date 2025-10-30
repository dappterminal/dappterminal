/**
 * 1inch Protocol Commands
 */

import type { Command, CommandResult, ExecutionContext } from '@/core'
import { resolveTokenAddress, getTokenDecimals } from './tokens'

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
          error: new Error('Usage: price <token>\nExample: price eth\n       price pepe (auto-search)'),
        }
      }

      const chainId = context.wallet.chainId || 1

      // Try to resolve token from hardcoded list first
      let tokenAddress: string
      let tokenSymbol = token.toUpperCase()

      // resolveTokenAddress returns the symbol if not found (doesn't throw)
      tokenAddress = resolveTokenAddress(token, chainId)

      // Check if we got a valid address (starts with 0x and has proper length)
      const isValidAddress = tokenAddress.startsWith('0x') && (tokenAddress.length === 42 || tokenAddress.length === 66)

      if (!isValidAddress) {
        // Token not in hardcoded list, try searching via 1inch API
        console.log(`Token '${token}' not in hardcoded list, searching via 1inch API...`)

        const searchUrl = `/api/1inch/tokens/search?query=${encodeURIComponent(token)}&chainId=${chainId}`
        const searchResponse = await fetch(searchUrl)

        if (!searchResponse.ok) {
          const errorData = await searchResponse.json().catch(() => ({ error: 'Unknown error' }))
          return {
            success: false,
            error: new Error(errorData.error || `Token '${token}' not found. Try a different symbol or use the contract address.`),
          }
        }

        const searchData = await searchResponse.json()
        tokenAddress = searchData.address
        tokenSymbol = searchData.symbol
        console.log(`Found token via search: ${tokenSymbol} at ${tokenAddress}`)
      }

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
          token: tokenSymbol,
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

      const amountInput = parts[0]
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

      // Get the correct decimals for the source token
      const srcDecimals = getTokenDecimals(fromToken)

      // Convert decimal amount to base units using correct decimals
      const { parseUnits } = await import('viem')
      const amount = parseUnits(amountInput, srcDecimals).toString()

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
          srcAddress,
          dstAddress,
          amount,
          amountIn: amount,
          amountOut: quote.dstAmount,
          gas: quote.gas,
          slippage,
          chainId,
          walletAddress: context.wallet.address,
          protocols: quote.protocols, // Include routing information
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
 * Limit Order command - Create limit order on 1inch orderbook
 */
export const limitorderCommand: Command = {
  id: 'limitorder',
  scope: 'G_p',
  protocol: '1inch',
  description: 'Create limit order on 1inch orderbook',
  aliases: ['limit', 'lo'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Verify wallet is connected
      if (!context.wallet.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      // Parse arguments: limitorder <amount> <fromToken> <toToken> --rate <price>
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ')

      if (parts.length < 3) {
        return {
          success: false,
          error: new Error(
            'Usage: limitorder <amount> <fromToken> <toToken> --rate <price>\n' +
            'Example: limitorder 100 usdc eth --rate 0.0003\n' +
            'Example: limitorder 0.5 eth usdc --rate 3500'
          ),
        }
      }

      const amountInput = parts[0]
      const fromToken = parts[1]
      const toToken = parts[2]

      // Parse rate flag (required)
      const rateIndex = parts.indexOf('--rate')
      if (rateIndex === -1 || rateIndex + 1 >= parts.length) {
        return {
          success: false,
          error: new Error(
            'Rate is required. Usage: limitorder <amount> <fromToken> <toToken> --rate <price>'
          ),
        }
      }
      const rate = parseFloat(parts[rateIndex + 1])

      if (isNaN(rate) || rate <= 0) {
        return {
          success: false,
          error: new Error('Invalid rate. Must be a positive number.'),
        }
      }

      const chainId = context.wallet.chainId || 1

      // Resolve token symbols to addresses
      const fromAddress = resolveTokenAddress(fromToken, chainId)
      const toAddress = resolveTokenAddress(toToken, chainId)

      // Get decimals for both tokens
      const fromDecimals = getTokenDecimals(fromToken)
      const toDecimals = getTokenDecimals(toToken)

      // Validate amount
      if (isNaN(parseFloat(amountInput)) || parseFloat(amountInput) <= 0) {
        return {
          success: false,
          error: new Error('Invalid amount. Must be a positive number.'),
        }
      }

      // Return limit order request for terminal to handle
      return {
        success: true,
        value: {
          limitOrderRequest: true,
          fromToken,
          toToken,
          fromAddress,
          toAddress,
          amount: amountInput,
          rate,
          chainId,
          fromDecimals,
          toDecimals,
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

/**
 * ETH RPC command - Execute Ethereum RPC calls via 1inch
 */
export const ethrpcCommand: Command = {
  id: 'eth_rpc',
  scope: 'G_p',
  protocol: '1inch',
  description: 'Execute Ethereum RPC calls via 1inch node',
  aliases: ['rpc', 'ethrpc'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Parse arguments: eth_rpc <method> [params...]
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ')

      if (parts.length < 1) {
        return {
          success: false,
          error: new Error(
            'Usage: eth_rpc <method> [params...]\n' +
            'Example: eth_rpc eth_blockNumber\n' +
            'Example: eth_rpc eth_getBalance 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb latest'
          ),
        }
      }

      const method = parts[0]
      const params = parts.slice(1)

      const chainId = context.wallet.chainId || 1

      // Build RPC request body
      const rpcRequest = {
        jsonrpc: '2.0',
        method,
        params,
        id: 1,
      }

      const response = await fetch(`/api/1inch/eth_rpc?chainId=${chainId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(rpcRequest),
      })

      if (!response.ok) {
        const errorData = await response.json()
        return {
          success: false,
          error: new Error(errorData.error?.message || errorData.error || 'RPC call failed'),
        }
      }

      const data = await response.json()

      if (data.error) {
        return {
          success: false,
          error: new Error(data.error.message || 'RPC error'),
        }
      }

      return {
        success: true,
        value: {
          rpcResponse: true,
          method,
          result: data.result,
          resultHex: data.resultHex,
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
