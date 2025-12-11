/**
 * API Route: CoinPaprika registry search
 *
 * GET /api/coinpaprika/registry/search?query=btc&limit=15
 *
 * Performs fuzzy search against the static coins database.
 */

import { NextRequest, NextResponse } from 'next/server'
import type { CoinEntry } from '@/plugins/coinpaprika/types'
import { coinRegistry } from '@/plugins/coinpaprika/data/coin-registry'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('query')
    const limitParam = searchParams.get('limit')

    if (!query) {
      return NextResponse.json({ error: 'Missing query parameter' }, { status: 400 })
    }

    const limit = Math.min(
      Math.max(Number(limitParam) || 15, 1),
      50
    )

    const results: CoinEntry[] = await coinRegistry.fuzzySearch(query, limit)

    return NextResponse.json({ results })
  } catch (error) {
    console.error('[CoinPaprika Registry Search API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to search registry' },
      { status: 500 }
    )
  }
}
