/**
 * API Route: CoinPaprika Ticker
 *
 * GET /api/coinpaprika/ticker/[id]
 *
 * Get price and market data for a specific coin
 */

import { NextRequest, NextResponse } from 'next/server'
import { coinPaprikaClient, CoinPaprikaAPIError } from '@/plugins/coinpaprika/api/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: coinId } = await params

    if (!coinId) {
      return NextResponse.json({ error: 'Missing coin ID' }, { status: 400 })
    }

    // Fetch ticker data from CoinPaprika API
    const ticker = await coinPaprikaClient.getTicker(coinId)

    return NextResponse.json(ticker)
  } catch (error) {
    console.error('[CoinPaprika Ticker API] Error:', error)

    if (error instanceof CoinPaprikaAPIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch ticker data' },
      { status: 500 }
    )
  }
}
