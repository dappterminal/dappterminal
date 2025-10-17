/**
 * Wormhole SDK Integration
 *
 * Core SDK initialization and helper functions for Wormhole bridge operations
 */

import { wormhole, routes, Wormhole } from '@wormhole-foundation/sdk'
import evm from '@wormhole-foundation/sdk/evm'

/**
 * Initialize Wormhole SDK
 */
export async function initWormholeSDK() {
  // Pass the evm platform loader from the main SDK package
  return await wormhole('Mainnet', [evm])
}

/**
 * Create route resolver with priority
 */
export function createRouteResolver(wh: any) {
  return wh.resolver([
    routes.AutomaticCCTPRoute,        // Fastest for USDC (~15 min)
    routes.CCTPRoute,                  // Fast for USDC manual
    routes.AutomaticTokenBridgeRoute, // Automatic with relayer
    routes.TokenBridgeRoute,           // Slowest - manual
  ])
}

/**
 * Transfer request parameters
 */
export interface TransferRequestParams {
  sourceChain: string
  destChain: string
  sourceToken: string
  destToken?: string
  amount: string
  sourceAddress: string
  destAddress: string
}

/**
 * Find available routes for a transfer
 */
export async function findTransferRoutes(
  wh: any,
  params: TransferRequestParams
) {
  try {
    const resolver = createRouteResolver(wh)

    // Get chain contexts
    const srcChain = wh.getChain(params.sourceChain)
    const dstChain = wh.getChain(params.destChain)

    // Determine if token is native
    const isNative = params.sourceToken.toLowerCase() === 'native' ||
                     params.sourceToken === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

    // Create token ID using Wormhole utility
    const tokenId = Wormhole.tokenId(
      srcChain.chain,
      isNative ? 'native' : params.sourceToken
    )

    // Find supported destination tokens
    const destTokens = await resolver.supportedDestinationTokens(
      tokenId,
      srcChain,
      dstChain
    )

    if (!destTokens || destTokens.length === 0) {
      throw new Error(`No supported destination tokens found for ${params.sourceToken}`)
    }

    // Create transfer request
    // Note: sender/receiver addresses are passed to route.initiate(), not set on the request
    const transferRequest = await routes.RouteTransferRequest.create(wh, {
      source: tokenId,
      destination: destTokens[0],
    })

    // Find routes
    const foundRoutes = await resolver.findRoutes(transferRequest)

    return {
      routes: foundRoutes,
      transferRequest,
      wh,
    }
  } catch (error) {
    console.error('[Wormhole SDK] Error finding routes:', error)
    throw error
  }
}

/**
 * Get quotes for all available routes
 */
export async function getQuotesForRoutes(
  routes: any[],
  transferRequest: any,
  amount: string
) {
  const transferParams = {
    amount,
    options: { nativeGas: 0 }
  }

  const quotes = await Promise.allSettled(
    routes.map(async (route) => {
      try {
        // Validate route
        const validated = await route.validate(transferRequest, transferParams)
        if (!validated.valid) {
          return {
            success: false,
            error: validated.error || 'Validation failed',
            route: route.constructor.name,
          }
        }

        // Get quote
        const quote = await route.quote(transferRequest, validated.params)
        return {
          success: quote.success,
          route: route.constructor.name,
          quote,
        }
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : String(error),
          route: route.constructor.name,
        }
      }
    })
  )

  return quotes.map((result, index) => {
    if (result.status === 'fulfilled') {
      return result.value
    }
    return {
      success: false,
      error: result.reason?.message || 'Unknown error',
      route: routes[index]?.constructor?.name || 'Unknown',
    }
  })
}

/**
 * Format quote for API response
 */
export function formatQuoteForAPI(route: any, quote: any) {
  return {
    type: route.constructor.name,
    success: quote.success,
    eta: quote.eta,
    relayFee: quote.relayFee ? {
      amount: quote.relayFee.amount.amount,
      decimals: quote.relayFee.amount.decimals,
      symbol: quote.relayFee.token.symbol,
    } : null,
    sourceToken: quote.sourceToken ? {
      amount: quote.sourceToken.amount.amount,
      decimals: quote.sourceToken.amount.decimals,
      symbol: quote.sourceToken.token.symbol,
    } : null,
    destinationToken: quote.destinationToken ? {
      amount: quote.destinationToken.amount.amount,
      decimals: quote.destinationToken.amount.decimals,
      symbol: quote.destinationToken.token.symbol,
    } : null,
  }
}
