import { NextRequest, NextResponse } from 'next/server'
import { CHAIN_KEY_MAP, calculateMinDestAmount } from '@/lib/stargate'

/**
 * POST /api/stargate/quote
 *
 * Fetch bridge quote from Stargate API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      fromChainId,
      toChainId,
      fromTokenAddress,
      toTokenAddress,
      fromAmount,
      fromAddress,
      toAddress,
      slippage = 0.5, // Default 0.5% slippage
    } = body

    // Validate required parameters
    if (!fromChainId || !toChainId || !fromTokenAddress || !toTokenAddress || !fromAmount) {
      return NextResponse.json(
        { error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Map chain IDs to Stargate chain keys
    const srcChainKey = CHAIN_KEY_MAP[fromChainId]
    const dstChainKey = CHAIN_KEY_MAP[toChainId]

    if (!srcChainKey || !dstChainKey) {
      return NextResponse.json(
        { error: `Unsupported chain. From: ${fromChainId}, To: ${toChainId}` },
        { status: 400 }
      )
    }

    // Calculate minimum destination amount with slippage
    const dstAmountMin = calculateMinDestAmount(fromAmount, slippage)

    // Build Stargate API request
    const params = new URLSearchParams({
      srcToken: fromTokenAddress,
      dstToken: toTokenAddress,
      srcAddress: fromAddress || toAddress,
      dstAddress: toAddress || fromAddress,
      srcChainKey,
      dstChainKey,
      srcAmount: fromAmount,
      dstAmountMin,
    })

    const url = `https://stargate.finance/api/v1/quotes?${params}`
    console.log('[Stargate] Requesting quote:', url)

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'accept': 'application/json',
      },
    })

    const data = await response.json()
    console.log('[Stargate] Response:', JSON.stringify(data, null, 2))

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Stargate API error', details: data },
        { status: response.status }
      )
    }

    // Stargate returns an array of quotes, pick the first one
    const quote = Array.isArray(data.quotes) ? data.quotes[0] : data

    if (!quote) {
      return NextResponse.json(
        { error: 'No quote available for this route' },
        { status: 404 }
      )
    }

    console.log('[Stargate] Quote steps:', JSON.stringify(quote?.steps, null, 2))

    // Return quote with all steps needed for the transfer
    return NextResponse.json({
      success: true,
      data: {
        fromChainId,
        toChainId,
        fromAmount,
        toAmount: quote?.dstAmount || quote?.amountLD || '0',
        stargateSteps: quote?.steps || [],
        fullQuote: quote,
      },
    })
  } catch (error) {
    console.error('[Stargate] Quote error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quote from Stargate API', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
