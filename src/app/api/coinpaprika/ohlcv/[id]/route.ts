/**
 * API Route: CoinPaprika OHLCV (Historical Chart Data)
 *
 * GET /api/coinpaprika/ohlcv/[id]
 *
 * Get historical OHLCV data for charts
 *
 * Query parameters:
 * - start: Start date (ISO 8601) - optional
 * - end: End date (ISO 8601) - optional
 * - limit: Number of data points (default: 366, max: 366)
 * - quote: Quote currency (default: 'usd')
 * - interval: Data interval (1h, 24h, 7d, 14d, 30d, 90d, 365d) - default: 24h
 */

import { NextRequest, NextResponse } from 'next/server'
import { coinPaprikaClient, CoinPaprikaAPIError } from '@/plugins/coinpaprika/api/client'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: coinId } = await params
    const searchParams = request.nextUrl.searchParams

    if (!coinId) {
      return NextResponse.json({ error: 'Missing coin ID' }, { status: 400 })
    }

    // Parse query parameters
    const start = searchParams.get('start') || undefined
    const end = searchParams.get('end') || undefined
    const limitStr = searchParams.get('limit')
    const limit = limitStr ? parseInt(limitStr, 10) : undefined
    const quote = searchParams.get('quote') || undefined
    const interval = searchParams.get('interval') as any || undefined

    // Validate interval if provided
    if (interval && !['1h', '24h', '7d', '14d', '30d', '90d', '365d'].includes(interval)) {
      return NextResponse.json(
        { error: 'Invalid interval. Must be one of: 1h, 24h, 7d, 14d, 30d, 90d, 365d' },
        { status: 400 }
      )
    }

    // Fetch OHLCV data from CoinPaprika API
    const ohlcv = await coinPaprikaClient.getOHLCV(coinId, {
      start,
      end,
      limit,
      quote,
      interval,
    })

    return NextResponse.json({
      coinId,
      interval: interval || '24h',
      quote: quote || 'usd',
      count: ohlcv.length,
      data: ohlcv,
    })
  } catch (error) {
    console.error('[CoinPaprika OHLCV API] Error:', error)

    if (error instanceof CoinPaprikaAPIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch OHLCV data' },
      { status: 500 }
    )
  }
}
