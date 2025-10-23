import { NextRequest, NextResponse } from 'next/server'
import { fetchReserves } from '@/lib/aave'

/**
 * GET /api/aave-v3/reserves?market=<marketId>
 *
 * Returns reserve-level statistics for the requested market.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('market') || searchParams.get('marketId') || 'ethereum-v3'

    const reserves = await fetchReserves(marketId)

    return NextResponse.json({
      success: true,
      data: {
        marketId,
        reserves,
        count: reserves.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Aave reserves',
        details: message,
      },
      { status: 500 }
    )
  }
}
