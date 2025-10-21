/**
 * LiFi Status API Proxy
 *
 * Proxies requests to LiFi's public status API
 * GET /api/lifi/status - Check bridge transaction status
 */

import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const bridge = searchParams.get('bridge')
    const fromChain = searchParams.get('fromChain')
    const toChain = searchParams.get('toChain')
    const txHash = searchParams.get('txHash')

    if (!bridge || !fromChain || !toChain || !txHash) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameters: bridge, fromChain, toChain, txHash',
        },
        { status: 400 }
      )
    }

    // Build query string for LiFi status API
    const params = new URLSearchParams({
      bridge,
      fromChain,
      toChain,
      txHash,
    })

    // Call LiFi public status API
    const response = await fetch(
      `https://li.quest/v1/status?${params}`,
      {
        method: 'GET',
        headers: {
          'accept': 'application/json',
        },
      }
    )

    const data = await response.json()

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: 'LiFi status API error',
          details: data,
        },
        { status: response.status }
      )
    }

    // Return formatted response
    return NextResponse.json({
      success: true,
      data: {
        status: data.status,
        substatus: data.substatus,
        sending: data.sending,
        receiving: data.receiving,
        lifiExplorerLink: data.lifiExplorerLink,
      },
    })
  } catch (error) {
    console.error('[LiFi Status API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch status from LiFi API',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
