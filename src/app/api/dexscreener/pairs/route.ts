/**
 * API Route: DexScreener Pair Search
 *
 * GET /api/dexscreener/pairs?q=<token_address_or_symbol>
 *
 * Searches for DEX pairs by token symbol or address.
 * Returns top pairs sorted by volume with price/volume/liquidity data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { TTLCache } from '@/lib/cache'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

const pairsCache = new TTLCache<unknown>(60_000) // 1 minute

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request)
    const rl = await rateLimit(`dexscreener:pairs:${clientId}`, 'MODERATE')
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    const query = request.nextUrl.searchParams.get('q')?.trim()
    if (!query) {
      return NextResponse.json({ error: 'Missing q parameter' }, { status: 400 })
    }

    const cacheKey = `pairs:${query.toLowerCase()}`
    const cached = pairsCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const response = await fetch(
      `https://api.dexscreener.com/latest/dex/search?q=${encodeURIComponent(query)}`,
      { headers: { 'Accept': 'application/json' } }
    )

    if (!response.ok) {
      throw new Error(`DexScreener API returned ${response.status}`)
    }

    const data = await response.json()

    // Sort pairs by 24h volume descending, take top 20
    const pairs = (data.pairs || [])
      .sort((a: any, b: any) => (b.volume?.h24 || 0) - (a.volume?.h24 || 0))
      .slice(0, 20)
      .map((pair: any) => ({
        chainId: pair.chainId,
        dexId: pair.dexId,
        pairAddress: pair.pairAddress,
        baseToken: pair.baseToken,
        quoteToken: pair.quoteToken,
        priceUsd: pair.priceUsd,
        priceNative: pair.priceNative,
        volume: pair.volume,
        priceChange: pair.priceChange,
        liquidity: pair.liquidity,
        fdv: pair.fdv,
        marketCap: pair.marketCap,
        url: pair.url,
      }))

    const result = { pairs, total: pairs.length }
    pairsCache.set(cacheKey, result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[DexScreener Pairs] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to search pairs' },
      { status: 500 }
    )
  }
}
