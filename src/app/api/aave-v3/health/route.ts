import { NextRequest, NextResponse } from 'next/server'
import { fetchUserPosition, calculateHealthMetrics } from '@/lib/aave'

/**
 * GET /api/aave-v3/health?market=<marketId>&address=<wallet>
 *
 * Returns health factor metrics for a user on a specific market.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)

  const marketId = searchParams.get('market') || searchParams.get('marketId') || 'ethereum-v3'
  const address =
    searchParams.get('address') ||
    searchParams.get('user') ||
    searchParams.get('wallet') ||
    ''

  if (!address) {
    return NextResponse.json(
      {
        success: false,
        error: 'Missing wallet address. Provide ?address=0x...',
      },
      { status: 400 }
    )
  }

  try {
    const position = await fetchUserPosition(marketId, address)
    const health = calculateHealthMetrics(position.summary)

    return NextResponse.json({
      success: true,
      data: {
        marketId,
        address,
        health,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to compute Aave health metrics',
        details: message,
      },
      { status: 500 }
    )
  }
}
