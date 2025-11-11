/**
 * API Route: Global Platform Statistics
 *
 * GET /api/analytics/global-stats
 *
 * Returns overall platform metrics including:
 * - Total transaction count
 * - Unique users
 * - Recent activity (last 24 hours)
 * - Breakdown by protocol
 * - Breakdown by transaction type (swaps vs bridges)
 */

import { NextRequest, NextResponse } from 'next/server'
import { getGlobalStats } from '@/lib/tracking/swaps'

export async function GET(request: NextRequest) {
  try {
    // Fetch global statistics
    const stats = await getGlobalStats()

    return NextResponse.json({
      success: true,
      data: stats,
    })
  } catch (error) {
    console.error('[Global Stats API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch global statistics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
