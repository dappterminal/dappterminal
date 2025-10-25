/**
 * Uniswap V4 Plugin Commands
 *
 * Commands for the Uniswap V4 DEX integration
 */

import type { Command, CommandResult, ExecutionContext } from '@/core/types'
import { resolveToken } from './lib/tokens'
import { parseUnits, formatUnits } from 'viem'
import type { UniswapV4PluginState, SingleHopSwapParams, MultiHopSwapParams, Token } from './types'
import { getSingleHopQuote, getMultiHopQuote } from './lib/quote'
import { getCommonIntermediateTokens } from './lib/multiHopSwap'

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
 * Execute a swap on Uniswap V4 (single-hop or multi-hop)
 * Usage: swap <amount> <tokenIn> <tokenOut> [--slippage bps] [--deadline seconds]
 * Multi-hop: swap <amount> <tokenIn> <intermediate> <tokenOut> [--slippage bps]
 */
export const swapCommand: Command = {
  id: 'swap',
  scope: 'G_p',
  protocol: 'uniswap-v4',
  description: 'Swap tokens on Uniswap V4 (auto-routes if needed)',
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
            'Multi-hop: swap <amount> <tokenIn> <intermediate> <tokenOut>\\n\\n' +
            'Examples:\\n' +
            '  swap 100 usdc weth                    (single-hop)\\n' +
            '  swap 1 eth weth                       (auto-routes through USDC)\\n' +
            '  swap 1 eth usdc weth                  (explicit multi-hop)\\n' +
            '  swap 0.5 eth usdc --slippage 100\\n' +
            '  swap 1000 usdc dai --deadline 600\\n\\n' +
            'Supported chains: Ethereum (1), Base (8453), Arbitrum (42161), Optimism (10)'
          ),
        }
      }

      const [amountInput, ...tokenInputs] = parts
      const isMultiHop = tokenInputs.length >= 3

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

      // EXPLICIT MULTI-HOP (4+ tokens specified)
      if (isMultiHop) {
        // Resolve all tokens in the route
        const route: Token[] = []
        for (const tokenInput of tokenInputs) {
          const token = resolveToken(tokenInput, chainId)
          if (!token) {
            return {
              success: false,
              error: new Error(
                `Token not found: ${tokenInput}\\n` +
                `Make sure all tokens exist on the current chain (${chainId})`
              ),
            }
          }
          route.push(token)
        }

        const tokenIn = route[0]
        const tokenOut = route[route.length - 1]

        // Validate route
        for (let i = 0; i < route.length; i++) {
          if (i > 0 && route[i].address.toLowerCase() === route[i - 1].address.toLowerCase()) {
            return {
              success: false,
              error: new Error('Route cannot have adjacent duplicate tokens'),
            }
          }
        }

        // Parse amount
        const amountIn = parseUnits(amountInput, tokenIn.decimals)
        if (amountIn <= BigInt(0)) {
          return {
            success: false,
            error: new Error('Amount must be greater than 0'),
          }
        }

        // Calculate deadline
        const deadline = BigInt(Math.floor(Date.now() / 1000) + deadlineSeconds)

        // Get multi-hop quote
        let minAmountOut: bigint
        let minAmountOutFormatted: string
        try {
          const quote = await getMultiHopQuote({
            route,
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
            error: new Error(`Failed to get multi-hop quote: ${errorMsg}`),
          }
        }

        // Build multi-hop swap parameters
        const swapParams: MultiHopSwapParams = {
          route,
          amountIn,
          minAmountOut,
          recipient: context.wallet.address,
          deadline,
          chainId,
        }

        // Cache the swap params
        const state = getUniswapV4State(context)
        state.lastSwap = {
          params: swapParams,
          timestamp: Date.now(),
        }
        setUniswapV4State(context, state)

        // Format amount for display
        const amountInFormatted = formatUnits(amountIn, tokenIn.decimals)
        const routeStr = route.map(t => t.symbol).join(' → ')

        // Return multi-hop swap request
        return {
          success: true,
          value: {
            uniswapV4MultiHopSwapRequest: true,
            params: swapParams,
            route,
            tokenInSymbol: tokenIn.symbol,
            tokenOutSymbol: tokenOut.symbol,
            amountInFormatted,
            minAmountOutFormatted,
            slippageBps,
            deadlineSeconds,
            message: `Ready to swap ${amountInFormatted} ${tokenIn.symbol} for ~${minAmountOutFormatted} ${tokenOut.symbol} via ${routeStr}`,
          },
        }
      }

      // SINGLE-HOP or AUTO MULTI-HOP (3 tokens: amount, tokenIn, tokenOut)
      const [tokenInInput, tokenOutInput] = tokenInputs

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

      // Try single-hop quote first
      let minAmountOut: bigint
      let minAmountOutFormatted: string
      let usedMultiHop = false
      let route: Token[] | undefined

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
      } catch (singleHopError) {
        // Single-hop failed - try multi-hop auto-routing
        const errorMsg = singleHopError instanceof Error ? singleHopError.message : String(singleHopError)

        // Only try multi-hop if the error is about pool not existing
        if (errorMsg.includes('Pool does not exist') || errorMsg.includes('returned no data')) {
          try {
            // Find intermediate tokens for this chain
            const intermediates = getCommonIntermediateTokens(chainId)

            // Try each intermediate token
            let foundRoute = false
            for (const intermediateAddress of intermediates) {
              // Skip if intermediate is same as input or output
              if (
                intermediateAddress.toLowerCase() === tokenIn.address.toLowerCase() ||
                intermediateAddress.toLowerCase() === tokenOut.address.toLowerCase()
              ) {
                continue
              }

              const intermediate = resolveToken(intermediateAddress, chainId)
              if (!intermediate) continue

              try {
                const testRoute = [tokenIn, intermediate, tokenOut]
                const quote = await getMultiHopQuote({
                  route: testRoute,
                  amountIn,
                  slippageBps,
                  chainId,
                })
                minAmountOut = quote.minAmountOut
                minAmountOutFormatted = quote.minAmountOutFormatted
                route = testRoute
                usedMultiHop = true
                foundRoute = true
                break
              } catch {
                // Try next intermediate
                continue
              }
            }

            if (!foundRoute) {
              return {
                success: false,
                error: new Error(
                  `No route found for ${tokenIn.symbol}/${tokenOut.symbol}.\\n` +
                  `Direct pool does not exist and no multi-hop route available.\\n` +
                  `Try a different token pair or specify an intermediate token manually.`
                ),
              }
            }
          } catch (multiHopError) {
            return {
              success: false,
              error: new Error(`Failed to find route: ${errorMsg}`),
            }
          }
        } else {
          // Error is not about pool existence - return original error
          return {
            success: false,
            error: new Error(`Failed to get quote: ${errorMsg}`),
          }
        }
      }

      // Build swap parameters (single-hop or multi-hop)
      if (usedMultiHop && route) {
        const swapParams: MultiHopSwapParams = {
          route,
          amountIn,
          minAmountOut,
          recipient: context.wallet.address,
          deadline,
          chainId,
        }

        const state = getUniswapV4State(context)
        state.lastSwap = {
          params: swapParams,
          timestamp: Date.now(),
        }
        setUniswapV4State(context, state)

        const amountInFormatted = formatUnits(amountIn, tokenIn.decimals)
        const routeStr = route.map(t => t.symbol).join(' → ')

        return {
          success: true,
          value: {
            uniswapV4MultiHopSwapRequest: true,
            params: swapParams,
            route,
            tokenInSymbol: tokenIn.symbol,
            tokenOutSymbol: tokenOut.symbol,
            amountInFormatted,
            minAmountOutFormatted,
            slippageBps,
            deadlineSeconds,
            message: `Ready to swap ${amountInFormatted} ${tokenIn.symbol} for ~${minAmountOutFormatted} ${tokenOut.symbol} via ${routeStr}`,
          },
        }
      } else {
        // Single-hop swap
        const swapParams: SingleHopSwapParams = {
          tokenIn,
          tokenOut,
          amountIn,
          minAmountOut,
          recipient: context.wallet.address,
          deadline,
          chainId,
        }

        const state = getUniswapV4State(context)
        state.lastSwap = {
          params: swapParams,
          timestamp: Date.now(),
        }
        setUniswapV4State(context, state)

        const amountInFormatted = formatUnits(amountIn, tokenIn.decimals)

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
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}
