/**
 * Wormhole Quote API Route
 *
 * Gets cross-chain transfer quotes via Wormhole SDK
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getWormholeChainName,
  resolveTokenAddress,
  NATIVE_TOKEN_ADDRESS,
  formatETA,
  getRouteInfo,
} from '@/lib/wormhole'
import { initWormholeSDK, findTransferRoutes, getQuotesForRoutes, formatQuoteForAPI } from '@/lib/wormhole-sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceChainId, destChainId, fromToken, toToken, amount, sourceAddress, destAddress } = body

    // Validate required parameters
    if (!sourceChainId || !destChainId || !fromToken || !amount || !sourceAddress || !destAddress) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Get Wormhole chain names
    const sourceChain = getWormholeChainName(sourceChainId)
    const destChain = getWormholeChainName(destChainId)

    if (!sourceChain || !destChain) {
      return NextResponse.json(
        { success: false, error: `Unsupported chain: ${sourceChainId} or ${destChainId}` },
        { status: 400 }
      )
    }

    // Resolve token addresses
    const fromTokenAddress = resolveTokenAddress(sourceChainId, fromToken) || fromToken
    const toTokenAddress = toToken
      ? (resolveTokenAddress(destChainId, toToken) || toToken)
      : (resolveTokenAddress(destChainId, fromToken) || fromToken)

    // Initialize Wormhole SDK
    console.log('[Wormhole Quote] Initializing SDK...')
    const wh = await initWormholeSDK()

    // Find available routes
    console.log('[Wormhole Quote] Finding routes...')
    const { routes, transferRequest } = await findTransferRoutes(wh, {
      sourceChain,
      destChain,
      sourceToken: fromTokenAddress,
      destToken: toTokenAddress,
      amount,
      sourceAddress,
      destAddress,
    })

    // Get quotes for all routes
    console.log('[Wormhole Quote] Getting quotes for', routes.length, 'routes...')
    const quoteResults = await getQuotesForRoutes(routes, transferRequest, amount)

    // Filter successful quotes and format them
    type QuoteResult = { success: boolean; route: string; quote?: unknown }
    const successfulQuotes = quoteResults
      .filter((result: QuoteResult) => result.success)
      .map((result: QuoteResult, index: number) => {
        const route = routes[index]
        const routeInfo = getRouteInfo(result.route)
        const formattedQuote = formatQuoteForAPI(route, result.quote)

        return {
          type: result.route,
          name: routeInfo.name,
          description: routeInfo.description,
          isAutomatic: routeInfo.isAutomatic,
          eta: formattedQuote.eta ? formatETA(formattedQuote.eta) : `~${routeInfo.estimatedTimeMinutes} min`,
          relayFee: formattedQuote.relayFee,
          quote: formattedQuote,
        }
      })

    if (successfulQuotes.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid routes found for this transfer' },
        { status: 400 }
      )
    }

    // Best route is the first successful one (resolver returns in priority order)
    const bestRoute = successfulQuotes[0]

    return NextResponse.json({
      success: true,
      data: {
        bestRoute,
        quotes: successfulQuotes,
        sourceChain,
        destChain,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        amount,
      },
    })
  } catch (error) {
    console.error('[Wormhole Quote] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
