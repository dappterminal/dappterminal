import { NextRequest, NextResponse } from 'next/server'
import { fetchMarkets } from '@/lib/aave'

/**
 * GET /api/aave-v3/markets
 *
 * Returns list of Aave v3 markets with basic metadata.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)

    const chainIds = parseChainIds(searchParams)
    const user =
      searchParams.get('user') ||
      searchParams.get('address') ||
      undefined

    const markets = await fetchMarkets({
      chainIds: chainIds.length > 0 ? chainIds : undefined,
      userAddress: user,
    })

    return NextResponse.json({
      success: true,
      data: {
        markets,
        count: markets.length,
        chainIds: chainIds.length > 0 ? chainIds : undefined,
        user,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch Aave markets',
        details: message,
      },
      { status: 500 }
    )
  }
}

function parseChainIds(params: URLSearchParams): number[] {
  const chainIds: number[] = []

  const directParams = params.getAll('chainId')
  const chainsParam = params.get('chains')

  const append = (value: string | null) => {
    if (!value) return
    value
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .forEach(part => {
        const parsed = Number(part)
        if (!Number.isNaN(parsed)) {
          chainIds.push(parsed)
        }
      })
  }

  directParams.forEach(append)
  append(chainsParam)

  return Array.from(new Set(chainIds))
}
