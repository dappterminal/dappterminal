/**
 * API Route: User Transaction History
 *
 * GET /api/analytics/user-history
 *
 * Returns paginated transaction history for a specific wallet address
 *
 * Query parameters:
 * - walletAddress (required): The wallet address to query
 * - protocol (optional): Filter by protocol (e.g., "uniswap-v4", "1inch")
 * - chainId (optional): Filter by chain ID
 * - txType (optional): Filter by transaction type ("swap" or "bridge")
 * - limit (optional): Number of results per page (default: 50, max: 100)
 * - offset (optional): Pagination offset (default: 0)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getUserTransactionHistory } from '@/lib/tracking/swaps'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const walletAddress = searchParams.get('walletAddress')

    // Validate required parameters
    if (!walletAddress) {
      return NextResponse.json(
        { error: 'Missing required parameter: walletAddress' },
        { status: 400 }
      )
    }

    // Parse optional filters
    const protocol = searchParams.get('protocol') || undefined
    const chainIdStr = searchParams.get('chainId')
    const chainId = chainIdStr ? parseInt(chainIdStr, 10) : undefined
    const txType = searchParams.get('txType') as 'swap' | 'bridge' | undefined

    // Parse pagination parameters
    const limitStr = searchParams.get('limit')
    const offsetStr = searchParams.get('offset')
    const limit = limitStr ? Math.min(parseInt(limitStr, 10), 100) : 50
    const offset = offsetStr ? parseInt(offsetStr, 10) : 0

    // Validate pagination parameters
    if (isNaN(limit) || limit < 1) {
      return NextResponse.json(
        { error: 'Invalid limit parameter' },
        { status: 400 }
      )
    }

    if (isNaN(offset) || offset < 0) {
      return NextResponse.json(
        { error: 'Invalid offset parameter' },
        { status: 400 }
      )
    }

    // Validate txType if provided
    if (txType && txType !== 'swap' && txType !== 'bridge') {
      return NextResponse.json(
        { error: 'Invalid txType parameter. Must be "swap" or "bridge"' },
        { status: 400 }
      )
    }

    // Fetch transaction history
    const transactions = await getUserTransactionHistory(walletAddress, {
      protocol,
      chainId,
      txType,
      limit,
      offset,
    })

    return NextResponse.json({
      success: true,
      data: {
        transactions,
        pagination: {
          limit,
          offset,
          count: transactions.length,
        },
        filters: {
          walletAddress,
          protocol,
          chainId,
          txType,
        },
      },
    })
  } catch (error) {
    console.error('[User History API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch user transaction history',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
