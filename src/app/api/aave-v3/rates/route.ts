import { NextRequest, NextResponse } from 'next/server'
import { fetchReserveRates } from '@/lib/aave'

/**
 * GET /api/aave-v3/rates?market=<marketId>
 *
 * Returns supply and borrow APYs for the requested market.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const marketId = searchParams.get('market') || searchParams.get('marketId') || 'ethereum-v3'

    const reserves = await fetchReserveRates(marketId)

    const rates = reserves.map((reserve) => ({
      id: reserve.id,
      symbol: reserve.symbol,
      supplyApy: reserve.supplyApy,
      variableBorrowApy: reserve.variableBorrowApy,
      stableBorrowApy: reserve.stableBorrowApy,
      rewardApr: reserve.rewardApr,
    }))

    return NextResponse.json({
      success: true,
      data: {
        marketId,
        rates,
        count: rates.length,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Aave reserve rates',
        details: message,
      },
      { status: 500 }
    )
  }
}
