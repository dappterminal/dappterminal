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
import { chartCache } from '@/lib/cache'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit: 30 req/min per client
    const clientId = getClientIdentifier(request)
    const rl = await rateLimit(`chart:coingecko:${clientId}`, 'MODERATE')
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

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

    // Check server-side cache
    const cacheKey = `coingecko:ohlc:${coinId}:${vsCurrency}:${days}`
    const cached = chartCache.coingecko.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // Fetch OHLC and market chart (for volume) in parallel
    const [ohlc, marketChart] = await Promise.all([
      coinGeckoClient.getOHLC(coinId, vsCurrency, days),
      coinGeckoClient.getMarketChart(coinId, vsCurrency, days).catch(() => null),
    ])

    // Build a lookup of volume by timestamp (nearest match within tolerance)
    // market_chart volumes are [timestamp_ms, volume] pairs
    const volumeMap = new Map<number, number>()
    if (marketChart?.total_volumes) {
      for (const [ts, vol] of marketChart.total_volumes) {
        volumeMap.set(ts, vol)
      }
    }

    // Find the closest volume entry for a given OHLC timestamp
    const findVolume = (ohlcTs: number): number => {
      if (volumeMap.size === 0) return 0
      // Exact match first
      if (volumeMap.has(ohlcTs)) return volumeMap.get(ohlcTs)!
      // Find nearest within 2 hour tolerance
      let closest = 0
      let minDiff = Infinity
      for (const [ts, vol] of volumeMap) {
        const diff = Math.abs(ts - ohlcTs)
        if (diff < minDiff) {
          minDiff = diff
          closest = vol
        }
      }
      return minDiff <= 2 * 60 * 60 * 1000 ? closest : 0
    }

    // Transform and merge volume into OHLC data
    const dataWithVolume = ohlc.map(candle => ({
      time_open: new Date(candle[0]).toISOString(),
      time_close: new Date(candle[0]).toISOString(),
      open: candle[1],
      high: candle[2],
      low: candle[3],
      close: candle[4],
      volume: findVolume(candle[0]),
      market_cap: 0,
    }))

    const responseBody = {
      coinId,
      days,
      vs_currency: vsCurrency,
      count: dataWithVolume.length,
      data: dataWithVolume,
    }

    // Store in cache
    chartCache.coingecko.set(cacheKey, responseBody)

    return NextResponse.json(responseBody)
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
