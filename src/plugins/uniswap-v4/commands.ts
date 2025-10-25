/**
 * Uniswap V4 Plugin Commands
 *
 * Commands for the Uniswap V4 DEX integration
 */

import type { Command, CommandResult, ExecutionContext } from '@/core/types'
import { resolveToken } from './lib/tokens'
import { parseUnits, formatUnits } from 'viem'
import type { UniswapV4PluginState, SingleHopSwapParams } from './types'
import { getSingleHopQuote } from './lib/quote'

// Helper to get plugin state
function getUniswapV4State(context: ExecutionContext): UniswapV4PluginState {
  const storedState = context.protocolState?.get('uniswap-v4')
  if (!storedState) {
    return {} as UniswapV4PluginState
  }
  return storedState as UniswapV4PluginState
}

function setUniswapV4State(context: ExecutionContext, state: UniswapV4PluginState): void {
  if (!context.protocolState) {
    context.protocolState = new Map()
  }
  context.protocolState.set('uniswap-v4', state)
}

/**
 * Swap Command
 *
 * Execute a single-hop swap on Uniswap V4
 * Usage: swap <amount> <tokenIn> <tokenOut> [--slippage bps] [--deadline seconds]
 */
export const swapCommand: Command = {
  id: 'swap',
  scope: 'G_p',
  protocol: 'uniswap-v4',
  description: 'Swap tokens on Uniswap V4',
  aliases: ['s'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Parse arguments
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter(p => p && !p.startsWith('--'))

      if (parts.length < 3) {
        return {
          success: false,
          error: new Error(
            'Usage: swap <amount> <tokenIn> <tokenOut> [--slippage bps] [--deadline seconds]\\n' +
            'Example: swap 100 usdc weth\\n' +
            'Example: swap 0.5 eth usdc --slippage 100\\n' +
            'Example: swap 1000 usdc dai --deadline 600\\n\\n' +
            'Supported chains: Ethereum (1), Base (8453), Arbitrum (42161), Optimism (10)'
          ),
        }
      }

      const [amountInput, tokenInInput, tokenOutInput] = parts

      // Parse slippage flag (default: 50 bps = 0.5%)
      let slippageBps = 50
      const slippageIndex = argsStr.indexOf('--slippage')
      if (slippageIndex !== -1) {
        const afterSlippage = argsStr.substring(slippageIndex + 10).trim()
        const slippageValue = parseInt(afterSlippage.split(' ')[0])
        if (!isNaN(slippageValue) && slippageValue >= 1 && slippageValue <= 500) {
          slippageBps = slippageValue
        }
      }

      // Parse deadline flag (default: 20 minutes = 1200 seconds)
      let deadlineSeconds = 1200
      const deadlineIndex = argsStr.indexOf('--deadline')
      if (deadlineIndex !== -1) {
        const afterDeadline = argsStr.substring(deadlineIndex + 10).trim()
        const deadlineValue = parseInt(afterDeadline.split(' ')[0])
        if (!isNaN(deadlineValue) && deadlineValue > 0) {
          deadlineSeconds = deadlineValue
        }
      }

      // Verify wallet is connected
      if (!context.wallet?.isConnected || !context.wallet.address || !context.wallet.chainId) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      const chainId = context.wallet.chainId

      // Resolve tokens
      const tokenIn = resolveToken(tokenInInput, chainId)
      const tokenOut = resolveToken(tokenOutInput, chainId)

      if (!tokenIn || !tokenOut) {
        return {
          success: false,
          error: new Error(
            `Token not found. Input: ${tokenInInput}, Output: ${tokenOutInput}\\n` +
            `Make sure tokens exist on the current chain (${chainId})`
          ),
        }
      }

      // Validate token pair
      if (tokenIn.address.toLowerCase() === tokenOut.address.toLowerCase()) {
        return {
          success: false,
          error: new Error('Cannot swap a token for itself'),
        }
      }

      if (tokenIn.chainId !== tokenOut.chainId) {
        return {
          success: false,
          error: new Error('Tokens must be on the same chain'),
        }
      }

      // Parse amount with proper decimals
      const amountIn = parseUnits(amountInput, tokenIn.decimals)

      if (amountIn <= BigInt(0)) {
        return {
          success: false,
          error: new Error('Amount must be greater than 0'),
        }
      }

      // Calculate deadline (current time + deadline seconds)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)

      // Get quote from quoter contract
      let minAmountOut: bigint
      let minAmountOutFormatted: string
      try {
        const quote = await getSingleHopQuote({
          tokenIn,
          tokenOut,
          amountIn,
          slippageBps,
          chainId,
        })
        minAmountOut = quote.minAmountOut
        minAmountOutFormatted = quote.minAmountOutFormatted
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        return {
          success: false,
          error: new Error(`Failed to get quote: ${errorMsg}`),
        }
      }

      // Build swap parameters
      const swapParams: SingleHopSwapParams = {
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut,
        recipient: context.wallet.address,
        deadline,
        chainId,
      }

      // Cache the swap params for potential re-use
      const state = getUniswapV4State(context)
      state.lastSwap = {
        params: swapParams,
        timestamp: Date.now(),
      }
      setUniswapV4State(context, state)

      // Format amount in for display
      const amountInFormatted = formatUnits(amountIn, tokenIn.decimals)

      // Return swap request for handler to execute
      return {
        success: true,
        value: {
          uniswapV4SwapRequest: true,
          params: swapParams,
          tokenInSymbol: tokenIn.symbol,
          tokenOutSymbol: tokenOut.symbol,
          amountInFormatted,
          minAmountOutFormatted,
          slippageBps,
          deadlineSeconds,
          message: `Ready to swap ${amountInFormatted} ${tokenIn.symbol} for ~${minAmountOutFormatted} ${tokenOut.symbol}`,
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
