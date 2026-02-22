/**
 * API Route: DexScreener Token Pairs
 *
 * GET /api/dexscreener/token/:chainId/:address
 *
 * Returns all DEX pairs for a specific token on a given chain.
 */

import { NextRequest, NextResponse } from 'next/server'
import { TTLCache } from '@/lib/cache'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

const tokenCache = new TTLCache<unknown>(60_000) // 1 minute

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ chainId: string; address: string }> }
) {
  try {
    const clientId = getClientIdentifier(request)
    const rl = await rateLimit(`dexscreener:token:${clientId}`, 'MODERATE')
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    const { chainId, address } = await params

    if (!chainId || !address) {
      return NextResponse.json(
        { error: 'Missing chainId or address parameter' },
        { status: 400 }
      )
    }

    const cacheKey = `token:${chainId}:${address.toLowerCase()}`
    const cached = tokenCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    const response = await fetch(
      `https://api.dexscreener.com/token-pairs/v1/${encodeURIComponent(chainId)}/${encodeURIComponent(address)}`,
      { headers: { 'Accept': 'application/json' } }
    )

    if (!response.ok) {
      throw new Error(`DexScreener API returned ${response.status}`)
    }

    const pairs = await response.json()

    // The token-pairs endpoint returns an array directly
    const result = {
      pairs: Array.isArray(pairs) ? pairs : (pairs.pairs || []),
      chainId,
      tokenAddress: address,
    }

    tokenCache.set(cacheKey, result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[DexScreener Token] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch token pairs' },
      { status: 500 }
    )
  }
}
