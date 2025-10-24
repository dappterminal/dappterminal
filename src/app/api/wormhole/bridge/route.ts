/**
 * Wormhole Bridge API Route
 *
 * Prepares bridge transactions via Wormhole SDK
 * Note: Actual signing happens client-side with wallet
 */

import { NextRequest, NextResponse } from 'next/server'
import {
  getWormholeChainName,
  resolveTokenAddress,
} from '@/lib/wormhole'
import { initWormholeSDK, findTransferRoutes, getQuotesForRoutes } from '@/lib/wormhole-sdk'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { sourceChainId, destChainId, fromToken, toToken, amount, sourceAddress, destAddress, routeType } = body

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

    console.log('[Wormhole Bridge] Initializing SDK...')
    const wh = await initWormholeSDK()

    console.log('[Wormhole Bridge] Finding routes...')
    const { routes, transferRequest } = await findTransferRoutes(wh, {
      sourceChain,
      destChain,
      sourceToken: fromTokenAddress,
      destToken: toTokenAddress,
      amount,
      sourceAddress,
      destAddress,
    })

    console.log('[Wormhole Bridge] Getting quotes...')
    const quoteResults = await getQuotesForRoutes(routes, transferRequest, amount)

    // Find the first successful route (or specified route type)
    let selectedRouteIndex = quoteResults.findIndex((r: { success: boolean; route?: string }) => r.success)

    if (routeType) {
      const typeIndex = quoteResults.findIndex((r: { success: boolean; route?: string }) => r.success && r.route === routeType)
      if (typeIndex !== -1) {
        selectedRouteIndex = typeIndex
      }
    }

    if (selectedRouteIndex === -1) {
      return NextResponse.json(
        { success: false, error: 'No valid route found' },
        { status: 400 }
      )
    }

    const selectedRoute = routes[selectedRouteIndex]
    const selectedQuote = quoteResults[selectedRouteIndex]

    console.log('[Wormhole Bridge] Selected route:', selectedQuote.route)

    // Validate and get transaction parameters
    const transferParams = {
      amount,
      options: { nativeGas: 0 }
    }

    const validated = await selectedRoute.validate(transferRequest, transferParams)
    if (!validated.valid) {
      return NextResponse.json(
        { success: false, error: validated.error || 'Transfer validation failed' },
        { status: 400 }
      )
    }

    const quote = await selectedRoute.quote(transferRequest, validated.params)

    console.log('[Wormhole Bridge] Preparing transactions...')

    // NOTE: The actual transaction signing must happen client-side with the wallet
    // We return the prepared transaction data for the client to sign and send
    // This is a limitation we need to work around - the SDK expects a signer

    // For now, return transaction structure that client can execute
    // The client will need to handle the Wormhole SDK directly
    const mockTransactions = [
      {
        to: fromTokenAddress as `0x${string}`,
        data: '0x095ea7b3' as `0x${string}`, // approve selector
        value: '0x0',
        description: `Approve ${fromToken.toUpperCase()}`,
      },
      {
        to: '0x3ee18B2214AFF97000D974cf647E7C347E8fa585' as `0x${string}`, // Wormhole TokenBridge (example)
        data: '0x0f5287b0' as `0x${string}`, // transferTokens selector
        value: '0x0',
        description: `Bridge ${amount} ${fromToken.toUpperCase()}`,
      },
    ]

    return NextResponse.json({
      success: true,
      data: {
        transactions: mockTransactions,
        sourceChain,
        destChain,
        fromToken: fromTokenAddress,
        toToken: toTokenAddress,
        amount,
        route: selectedQuote.route,
        quote: quote,
        scanUrlTemplate: 'https://wormholescan.io/#/tx/{{hash}}?network=Mainnet',
        note: 'SDK integration requires client-side signing - full implementation pending',
      },
    })
  } catch (error) {
    console.error('[Wormhole Bridge] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
