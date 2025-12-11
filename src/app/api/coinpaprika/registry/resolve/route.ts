/**
 * API Route: CoinPaprika registry resolver
 *
 * GET /api/coinpaprika/registry/resolve?symbol=BTC
 *
 * Resolves a ticker symbol to the corresponding CoinPaprika ID.
 */

import { NextRequest, NextResponse } from 'next/server'
import { coinRegistry } from '@/plugins/coinpaprika/data/coin-registry'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const symbol = searchParams.get('symbol')

    if (!symbol) {
      return NextResponse.json({ error: 'Missing symbol parameter' }, { status: 400 })
    }

    const coinId = await coinRegistry.resolveSymbol(symbol)

    if (!coinId) {
      return NextResponse.json({ error: `Coin '${symbol}' not found` }, { status: 404 })
    }

    return NextResponse.json({ coinId })
  } catch (error) {
    console.error('[CoinPaprika Registry Resolve API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to resolve symbol' },
      { status: 500 }
    )
  }
}
