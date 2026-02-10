/**
 * API Route: CoinGecko Symbol Resolution
 *
 * GET /api/coingecko/resolve?symbol=SOL
 *
 * Resolves a token symbol (e.g. "SOL") to a CoinGecko coin ID (e.g. "solana").
 * Uses a hardcoded fast-path for the most common tokens and falls back to
 * CoinGecko's /search endpoint for everything else.
 *
 * Results are cached for 24 hours since symbol->ID mappings rarely change.
 */

import { NextRequest, NextResponse } from 'next/server'
import { coinGeckoClient, CoinGeckoAPIError } from '@/lib/coingecko-client'
import { TTLCache } from '@/lib/cache'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

// Long-lived cache — symbol mappings are very stable
const resolveCache = new TTLCache<{ id: string; name: string; symbol: string }>(
  24 * 60 * 60_000 // 24 hours
)

// Fast-path for the most common symbols to avoid burning API calls
const WELL_KNOWN: Record<string, string> = {
  BTC: 'bitcoin',
  ETH: 'ethereum',
  USDC: 'usd-coin',
  USDT: 'tether',
  DAI: 'dai',
  WBTC: 'wrapped-bitcoin',
  WETH: 'weth',
  MATIC: 'matic-network',
  POL: 'matic-network',
  LINK: 'chainlink',
  UNI: 'uniswap',
  AAVE: 'aave',
  SOL: 'solana',
  DOGE: 'dogecoin',
  SHIB: 'shiba-inu',
  ARB: 'arbitrum',
  OP: 'optimism',
  AVAX: 'avalanche-2',
  DOT: 'polkadot',
  ATOM: 'cosmos',
  NEAR: 'near',
  FTM: 'fantom',
  APT: 'aptos',
  SUI: 'sui',
  SEI: 'sei-network',
  INJ: 'injective-protocol',
  TIA: 'celestia',
  PEPE: 'pepe',
  WIF: 'dogwifcoin',
  BONK: 'bonk',
  RENDER: 'render-token',
  FET: 'fetch-ai',
  GRT: 'the-graph',
  IMX: 'immutable-x',
  MKR: 'maker',
  CRV: 'curve-dao-token',
  LDO: 'lido-dao',
  RETH: 'rocket-pool-eth',
  CBETH: 'coinbase-wrapped-staked-eth',
  STETH: 'staked-ether',
  SNX: 'havven',
  COMP: 'compound-governance-token',
  ENS: 'ethereum-name-service',
  RPL: 'rocket-pool',
  XRP: 'ripple',
  ADA: 'cardano',
  BNB: 'binancecoin',
  TRX: 'tron',
  TON: 'the-open-network',
}

export async function GET(request: NextRequest) {
  try {
    const clientId = getClientIdentifier(request)
    const rl = await rateLimit(`resolve:coingecko:${clientId}`, 'MODERATE')
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      )
    }

    const symbol = request.nextUrl.searchParams.get('symbol')?.trim()
    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 })
    }

    const upperSymbol = symbol.toUpperCase()
    const cacheKey = `resolve:${upperSymbol}`

    // 1. Check cache
    const cached = resolveCache.get(cacheKey)
    if (cached) {
      return NextResponse.json(cached)
    }

    // 2. Check well-known fast-path
    const wellKnownId = WELL_KNOWN[upperSymbol]
    if (wellKnownId) {
      const result = { id: wellKnownId, name: upperSymbol, symbol: upperSymbol }
      resolveCache.set(cacheKey, result)
      return NextResponse.json(result)
    }

    // 3. Fall back to CoinGecko search API
    const searchResult = await coinGeckoClient.search(symbol)

    if (!searchResult.coins || searchResult.coins.length === 0) {
      return NextResponse.json(
        { error: `No CoinGecko match found for "${symbol}"` },
        { status: 404 }
      )
    }

    // Pick the best match: prefer exact symbol match with highest market cap rank
    const exactMatches = searchResult.coins.filter(
      c => c.symbol.toUpperCase() === upperSymbol
    )

    const best = exactMatches.length > 0
      ? exactMatches.sort((a, b) => (a.market_cap_rank ?? Infinity) - (b.market_cap_rank ?? Infinity))[0]
      : searchResult.coins[0] // Fall back to top search result

    const result = {
      id: best.id,
      name: best.name,
      symbol: best.symbol.toUpperCase(),
    }

    resolveCache.set(cacheKey, result)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[CoinGecko Resolve] Error:', error)

    if (error instanceof CoinGeckoAPIError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 500 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to resolve symbol' },
      { status: 500 }
    )
  }
}
