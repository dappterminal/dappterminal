/**
 * Uniswap V4 Plugin Commands
 *
 * Commands for the Uniswap V4 DEX integration
 */

import type { Command, CommandResult, ExecutionContext } from '@/core/types'
import { resolveToken } from './lib/tokens'
import { parseUnits, formatUnits } from 'viem'
import type { UniswapV4PluginState, SingleHopSwapParams, MultiHopSwapParams, Token, AddLiquidityParams, FeeAmount } from './types'
import { getSingleHopQuote, getMultiHopQuote } from './lib/quote'
import { getCommonIntermediateTokens } from './lib/multiHopSwap'
import { FEE_AMOUNTS } from './types'
import { priceToTick, getNearestUsableTick } from './lib/positionManager'
import { getTickSpacing, createPoolKey, getKnownPoolsForPair } from './lib/poolUtils'
import { findExistingPoolForPair } from './lib/discoverPools'

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
      let minAmountOut: bigint | undefined
      let minAmountOutFormatted: string | undefined
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

      // Verify quote was obtained
      if (minAmountOut === undefined || minAmountOutFormatted === undefined) {
        return {
          success: false,
          error: new Error('Failed to obtain quote for swap'),
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

/**
 * Liquidity Command (unified for add/remove)
 *
 * Manage liquidity positions on Uniswap V4
 * Usage: liquidity <add|remove> ...
 */
export const liquidityCommand: Command = {
  id: 'liquidity',
  scope: 'G_p',
  protocol: 'uniswap-v4',
  description: 'Manage liquidity on Uniswap V4 (add/remove)',
  aliases: ['liq', 'lp'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter(p => p)

      if (parts.length === 0) {
        return {
          success: false,
          error: new Error(
            'Usage: liquidity <add|remove> ...\\n\\n' +
            'Add liquidity:\\n' +
            '  liquidity add <token0> <token1> <amount0> <amount1> [options]\\n\\n' +
            'Remove liquidity:\\n' +
            '  liquidity remove <token0> <token1> <percentage> [options]\\n\\n' +
            'Examples:\\n' +
            '  liquidity add eth usdc 1 2000\\n' +
            '  liquidity add eth usdc 1 2000 --min-price 1800 --max-price 2200\\n' +
            '  liquidity remove eth usdc 50\\n' +
            '  liquidity remove eth usdc 100 --burn'
          ),
        }
      }

      const subcommand = parts[0].toLowerCase()
      const remainingArgs = parts.slice(1).join(' ')

      if (subcommand === 'add') {
        return addLiquidityCommand.run(remainingArgs, context)
      } else if (subcommand === 'remove') {
        return removeLiquidityCommand.run(remainingArgs, context)
      } else {
        return {
          success: false,
          error: new Error(
            `Unknown subcommand: ${subcommand}\\n\\n` +
            'Valid subcommands: add, remove\\n\\n' +
            'Usage: liquidity <add|remove> ...'
          ),
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

/**
 * Add Liquidity Command (internal)
 *
 * Add liquidity to a Uniswap V4 pool
 * Called by liquidityCommand
 */
const addLiquidityCommand: Command = {
  id: 'liquidity-add-internal',
  scope: 'G_p',
  protocol: 'uniswap-v4',
  description: 'Add liquidity to a Uniswap V4 pool',
  aliases: [],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Parse arguments
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter(p => p && !p.startsWith('--'))

      if (parts.length < 4) {
        return {
          success: false,
          error: new Error(
            'Usage: liquidity add <token0> <token1> <amount0> <amount1> [--min-price X] [--max-price Y] [--fee tier] [--use-permit2]\\n\\n' +
            'Examples:\\n' +
            '  liquidity add eth usdc 1 2000                         (full range)\\n' +
            '  liquidity add eth usdc 1 2000 --min-price 1800 --max-price 2200\\n' +
            '  liquidity add eth usdc 1 2000 --fee 500               (0.05% fee tier)\\n' +
            '  liquidity add wbtc eth 0.1 2 --use-permit2            (use Permit2 for approvals)\\n\\n' +
            'Fee tiers: 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%)\\n' +
            'Default: 3000 (0.3%)'
          ),
        }
      }

      const [token0Input, token1Input, amount0Input, amount1Input] = parts

      // Verify wallet is connected
      if (!context.wallet?.isConnected || !context.wallet.address || !context.wallet.chainId) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      const chainId = context.wallet.chainId

      // Resolve tokens
      const token0 = resolveToken(token0Input, chainId)
      const token1 = resolveToken(token1Input, chainId)

      if (!token0 || !token1) {
        return {
          success: false,
          error: new Error(
            `Token not found. Token0: ${token0Input}, Token1: ${token1Input}\\n` +
            `Make sure tokens exist on the current chain (${chainId})`
          ),
        }
      }

      // Validate token pair
      if (token0.address.toLowerCase() === token1.address.toLowerCase()) {
        return {
          success: false,
          error: new Error('Cannot add liquidity with the same token twice'),
        }
      }

      // Parse amounts
      const amount0 = parseUnits(amount0Input, token0.decimals)
      const amount1 = parseUnits(amount1Input, token1.decimals)

      if (amount0 <= BigInt(0) || amount1 <= BigInt(0)) {
        return {
          success: false,
          error: new Error('Amounts must be greater than 0'),
        }
      }

      // Parse fee tier (default: 3000 = 0.3%)
      let fee: FeeAmount = FEE_AMOUNTS.MEDIUM
      const feeIndex = argsStr.indexOf('--fee')
      if (feeIndex !== -1) {
        const afterFee = argsStr.substring(feeIndex + 5).trim()
        const feeValue = parseInt(afterFee.split(' ')[0])
        if ([100, 500, 3000, 10000].includes(feeValue)) {
          fee = feeValue as FeeAmount
        } else {
          return {
            success: false,
            error: new Error(`Invalid fee tier: ${feeValue}. Must be 100, 500, 3000, or 10000`),
          }
        }
      }

      // Parse price range
      let minPrice: number | undefined
      let maxPrice: number | undefined

      const minPriceIndex = argsStr.indexOf('--min-price')
      if (minPriceIndex !== -1) {
        const afterMinPrice = argsStr.substring(minPriceIndex + 11).trim()
        const minPriceValue = parseFloat(afterMinPrice.split(' ')[0])
        if (!isNaN(minPriceValue) && minPriceValue > 0) {
          minPrice = minPriceValue
        }
      }

      const maxPriceIndex = argsStr.indexOf('--max-price')
      if (maxPriceIndex !== -1) {
        const afterMaxPrice = argsStr.substring(maxPriceIndex + 11).trim()
        const maxPriceValue = parseFloat(afterMaxPrice.split(' ')[0])
        if (!isNaN(maxPriceValue) && maxPriceValue > 0) {
          maxPrice = maxPriceValue
        }
      }

      // Validate price range
      if (minPrice !== undefined && maxPrice !== undefined && minPrice >= maxPrice) {
        return {
          success: false,
          error: new Error('Min price must be less than max price'),
        }
      }

      // Check for use-permit2 flag
      const usePermit2 = argsStr.includes('--use-permit2')

      // Calculate deadline (20 minutes from now)
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 1200)

      // Check if this is a known pool
      const knownPools = getKnownPoolsForPair(token0.symbol, token1.symbol, chainId)
      let poolMessage = ''
      if (knownPools.length > 0) {
        poolMessage = `\\nKnown pools for ${token0.symbol}/${token1.symbol}:\\n`
        knownPools.forEach(pool => {
          poolMessage += `  - ${pool.description}\\n`
        })
      }

      // Build add liquidity parameters
      const params: AddLiquidityParams = {
        token0,
        token1,
        amount0,
        amount1,
        minPrice,
        maxPrice,
        fee,
        recipient: context.wallet.address,
        deadline,
        slippageBps: 50, // Default 0.5% slippage
        usePermit2,
        chainId,
      }

      // Format amounts for display
      const amount0Formatted = formatUnits(amount0, token0.decimals)
      const amount1Formatted = formatUnits(amount1, token1.decimals)

      // Build price range message
      let priceRangeMsg = 'Full range (no limits)'
      if (minPrice !== undefined || maxPrice !== undefined) {
        priceRangeMsg = `Price range: ${minPrice?.toFixed(2) ?? '∞'} to ${maxPrice?.toFixed(2) ?? '∞'}`
      }

      // Return add liquidity request
      return {
        success: true,
        value: {
          uniswapV4AddLiquidityRequest: true,
          params,
          token0Symbol: token0.symbol,
          token1Symbol: token1.symbol,
          amount0Formatted,
          amount1Formatted,
          message: `Ready to add ${amount0Formatted} ${token0.symbol} + ${amount1Formatted} ${token1.symbol} to pool (Fee: ${fee / 10000}%)\\n${priceRangeMsg}\\nApproval method: ${usePermit2 ? 'Permit2 (signature)' : 'Standard ERC20'}${poolMessage}`,
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
 * Remove Liquidity Command (internal)
 *
 * Remove liquidity from a Uniswap V4 position
 * Called by liquidityCommand
 */
const removeLiquidityCommand: Command = {
  id: 'liquidity-remove-internal',
  scope: 'G_p',
  protocol: 'uniswap-v4',
  description: 'Remove liquidity from a Uniswap V4 position',
  aliases: [],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Parse arguments
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter(p => p && !p.startsWith('--'))

      if (parts.length < 3) {
        return {
          success: false,
          error: new Error(
            'Usage: liquidity remove <token0> <token1> <percentage> [--fee tier] [--burn]\\n\\n' +
            'Examples:\\n' +
            '  liquidity remove eth usdc 100                 (remove all liquidity)\\n' +
            '  liquidity remove eth usdc 50                  (remove 50%)\\n' +
            '  liquidity remove eth usdc 100 --fee 500       (specify fee tier)\\n' +
            '  liquidity remove wbtc eth 100 --burn          (burn NFT after removal)\\n\\n' +
            'Fee tiers: 100 (0.01%), 500 (0.05%), 3000 (0.3%), 10000 (1%)\\n' +
            'Default: 3000 (0.3%)'
          ),
        }
      }

      const [token0Input, token1Input, percentageInput] = parts

      // Verify wallet is connected
      if (!context.wallet?.isConnected || !context.wallet.address || !context.wallet.chainId) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      const chainId = context.wallet.chainId

      // Resolve tokens
      const token0 = resolveToken(token0Input, chainId)
      const token1 = resolveToken(token1Input, chainId)

      if (!token0 || !token1) {
        return {
          success: false,
          error: new Error(
            `Token not found. Token0: ${token0Input}, Token1: ${token1Input}\\n` +
            `Make sure tokens exist on the current chain (${chainId})`
          ),
        }
      }

      // Parse percentage
      const percentage = parseFloat(percentageInput)
      if (isNaN(percentage) || percentage <= 0 || percentage > 100) {
        return {
          success: false,
          error: new Error('Percentage must be between 0 and 100'),
        }
      }

      // Parse fee tier (default: 3000 = 0.3%)
      let fee: FeeAmount = FEE_AMOUNTS.MEDIUM
      const feeIndex = argsStr.indexOf('--fee')
      if (feeIndex !== -1) {
        const afterFee = argsStr.substring(feeIndex + 5).trim()
        const feeValue = parseInt(afterFee.split(' ')[0])
        if ([100, 500, 3000, 10000].includes(feeValue)) {
          fee = feeValue as FeeAmount
        } else {
          return {
            success: false,
            error: new Error(`Invalid fee tier: ${feeValue}. Must be 100, 500, 3000, or 10000`),
          }
        }
      }

      // Check for burn flag
      const burnToken = argsStr.includes('--burn')

      // Store request info to be processed by handler
      // Handler will need to query user's positions to find the right tokenId
      return {
        success: true,
        value: {
          uniswapV4RemoveLiquidityRequest: true,
          token0Symbol: token0.symbol,
          token1Symbol: token1.symbol,
          token0,
          token1,
          fee,
          percentage,
          burnToken,
          chainId,
          message: `Ready to remove ${percentage}% liquidity from ${token0.symbol}/${token1.symbol} pool (Fee: ${fee / 10000}%)\\n${burnToken ? 'Will burn NFT after removal' : 'Will keep NFT'}\\n\\nNote: Handler will find your position for this pool.`,
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
 * Discover Pools Command
 *
 * Scan for existing V4 pools to find which token pairs have liquidity
 * Usage: discover [token1] [token2]
 */
export const discoverCommand: Command = {
  id: 'discover',
  scope: 'G_p',
  protocol: 'uniswap-v4',
  description: 'Discover which V4 pools exist on the current chain',
  aliases: ['find-pools'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter((p) => p && !p.startsWith('--'))

      // Verify wallet is connected
      if (!context.wallet?.isConnected || !context.wallet.chainId) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      const chainId = context.wallet.chainId

      // Import getPublicClient
      const { getPublicClient } = await import('wagmi/actions')
      const { config } = await import('@/lib/wagmi-config')
      const { getTokensByChainId } = await import('./lib/tokens')

      const client = getPublicClient(config, { chainId: chainId as any })
      if (!client) {
        return {
          success: false,
          error: new Error('Failed to get public client'),
        }
      }

      const tokens = getTokensByChainId(chainId)

      // If specific tokens provided, check just that pair
      if (parts.length >= 2) {
        const [token1Input, token2Input] = parts
        const token1 = resolveToken(token1Input, chainId)
        const token2 = resolveToken(token2Input, chainId)

        if (!token1 || !token2) {
          return {
            success: false,
            error: new Error(`Tokens not found: ${token1Input}, ${token2Input}`),
          }
        }

        return {
          success: true,
          value: {
            uniswapV4DiscoverRequest: true,
            token0: token1,
            token1: token2,
            chainId,
            message: `Scanning for ${token1.symbol}/${token2.symbol} pools across all fee tiers...`,
          },
        }
      }

      // Otherwise, scan common pairs
      const commonPairs: Array<[Token, Token]> = []

      // Get common tokens for scanning
      const tokenList = Object.values(tokens)
      const commonTokenSymbols = ['ETH', 'WETH', 'USDC', 'USDT', 'DAI', 'WBTC', 'ARB']
      const commonTokens = tokenList.filter((t) =>
        commonTokenSymbols.includes(t.symbol.toUpperCase())
      )

      // Create pairs (avoid duplicates)
      for (let i = 0; i < commonTokens.length; i++) {
        for (let j = i + 1; j < commonTokens.length; j++) {
          // Skip ETH/WETH pair as they're the same
          if (
            (commonTokens[i].symbol === 'ETH' && commonTokens[j].symbol === 'WETH') ||
            (commonTokens[i].symbol === 'WETH' && commonTokens[j].symbol === 'ETH')
          ) {
            continue
          }
          commonPairs.push([commonTokens[i], commonTokens[j]])
        }
      }

      return {
        success: true,
        value: {
          uniswapV4DiscoverRequest: true,
          pairs: commonPairs,
          chainId,
          message: `Scanning ${commonPairs.length} common token pairs for V4 pools...\\nThis may take a minute.`,
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
