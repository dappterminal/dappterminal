/**
 * API Route: Protocol Volume Statistics
 *
 * GET /api/analytics/protocol-volume
 *
 * Returns aggregated volume statistics for protocols
 *
 * Query parameters:
 * - protocol (optional): Filter by specific protocol
 * - chainId (optional): Filter by chain ID
 * - startDate (optional): Start date for filtering (ISO format)
 * - endDate (optional): End date for filtering (ISO format)
 * - groupBy (optional): Grouping interval ("day", "week", "month") - default: "day"
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProtocolVolumeStats } from '@/lib/tracking/swaps'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams

    // Parse optional filters
    const protocol = searchParams.get('protocol') || undefined
    const chainIdStr = searchParams.get('chainId')
    const chainId = chainIdStr ? parseInt(chainIdStr, 10) : undefined

    // Parse date range
    const startDateStr = searchParams.get('startDate')
    const endDateStr = searchParams.get('endDate')

    let startDate: Date | undefined
    let endDate: Date | undefined

    if (startDateStr) {
      startDate = new Date(startDateStr)
      if (isNaN(startDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid startDate parameter' },
          { status: 400 }
        )
      }
    }

    if (endDateStr) {
      endDate = new Date(endDateStr)
      if (isNaN(endDate.getTime())) {
        return NextResponse.json(
          { error: 'Invalid endDate parameter' },
          { status: 400 }
        )
      }
    }

    // Fetch protocol volume statistics
    const volumeStats = await getProtocolVolumeStats({
      protocol,
      chainId,
      startDate,
      endDate,
    })

    // Calculate aggregate totals
    const totals = volumeStats.reduce(
      (acc, stat) => ({
        totalTransactions: acc.totalTransactions + stat.totalTransactions,
        successfulTxs: acc.successfulTxs + stat.successfulTxs,
        failedTxs: acc.failedTxs + stat.failedTxs,
        uniqueUsers: Math.max(acc.uniqueUsers, stat.uniqueUsers), // Approximation
      }),
      {
        totalTransactions: 0,
        successfulTxs: 0,
        failedTxs: 0,
        uniqueUsers: 0,
      }
    )

    // Group by protocol if no specific protocol filter
    const byProtocol = volumeStats.reduce((acc, stat) => {
      if (!acc[stat.protocol]) {
        acc[stat.protocol] = {
          protocol: stat.protocol,
          totalTransactions: 0,
          successfulTxs: 0,
          failedTxs: 0,
          uniqueUsers: 0,
          volumeIn: BigInt(0),
          volumeOut: BigInt(0),
        }
      }

      acc[stat.protocol].totalTransactions += stat.totalTransactions
      acc[stat.protocol].successfulTxs += stat.successfulTxs
      acc[stat.protocol].failedTxs += stat.failedTxs
      acc[stat.protocol].uniqueUsers = Math.max(
        acc[stat.protocol].uniqueUsers,
        stat.uniqueUsers
      )
      acc[stat.protocol].volumeIn += BigInt(stat.totalVolumeIn)
      acc[stat.protocol].volumeOut += BigInt(stat.totalVolumeOut)

      return acc
    }, {} as Record<string, any>)

    return NextResponse.json({
      success: true,
      data: {
        volumeStats,
        totals,
        byProtocol: Object.values(byProtocol).map(p => ({
          ...p,
          volumeIn: p.volumeIn.toString(),
          volumeOut: p.volumeOut.toString(),
        })),
        filters: {
          protocol,
          chainId,
          startDate: startDateStr,
          endDate: endDateStr,
        },
      },
    })
  } catch (error) {
    console.error('[Protocol Volume API] Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch protocol volume statistics',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
