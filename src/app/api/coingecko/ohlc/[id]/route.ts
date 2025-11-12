/**
 * API Route: CoinGecko OHLC (Historical Chart Data)
 *
 * GET /api/coingecko/ohlc/[id]
 *
 * Get historical OHLC (candlestick) data for charts
 *
 * Query parameters:
 * - days: Number of days of data (1, 7, 14, 30, 90, 180, 365, max) - default: 7
 * - vs_currency: Quote currency (default: 'usd')
 */

import { NextRequest, NextResponse } from 'next/server'
import { coinGeckoClient, CoinGeckoAPIError } from '@/lib/coingecko-client'

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
    const daysParam = searchParams.get('days') || '7'
    const days = daysParam === 'max' ? 'max' : parseInt(daysParam, 10)
    const vsCurrency = searchParams.get('vs_currency') || 'usd'

    // Validate days if it's a number
    if (typeof days === 'number' && (isNaN(days) || days < 1)) {
      return NextResponse.json(
        { error: 'Invalid days parameter. Must be a positive number or "max"' },
        { status: 400 }
      )
    }

    // Fetch OHLC data from CoinGecko API
    const ohlc = await coinGeckoClient.getOHLC(coinId, vsCurrency, days)

    // Transform to include volume (CoinGecko OHLC doesn't include volume, so we set to 0)
    // Format: [timestamp, open, high, low, close, volume]
    const dataWithVolume = ohlc.map(candle => ({
      time_open: new Date(candle[0]).toISOString(),
      time_close: new Date(candle[0]).toISOString(), // Same as open for OHLC endpoint
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: 0, // CoinGecko OHLC endpoint doesn't provide volume
      market_cap: 0,
    }))

    return NextResponse.json({
      coinId,
      days,
      vs_currency: vsCurrency,
      count: dataWithVolume.length,
      data: dataWithVolume,
    })
  } catch (error) {
    console.error('[CoinGecko OHLC API] Error:', error)

    if (error instanceof CoinGeckoAPIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch OHLC data' },
      { status: 500 }
    )
  }
}
