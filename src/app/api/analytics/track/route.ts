/**
 * API Route: Track Swap/Bridge Transaction
 *
 * POST /api/analytics/track
 *
 * Server-side endpoint for recording swap and bridge transactions.
 * Plugin handlers run client-side and cannot use Prisma directly,
 * so they call this route instead.
 */

import { NextRequest, NextResponse } from 'next/server'
import { trackSwapTransaction } from '@/lib/tracking/swaps'
import type { TransactionType } from '@/lib/tracking/types'

interface TrackRequestBody {
  txHash: string
  chainId: number
  protocol: string
  command: string
  txType: TransactionType
  walletAddress: string
  tokenIn: string
  tokenOut: string
  amountIn: string
  amountOut: string
  gasUsed?: string
  gasPrice?: string
  route?: unknown
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TrackRequestBody

    // Validate required fields
    if (!body.txHash || !body.chainId || !body.protocol || !body.walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields: txHash, chainId, protocol, walletAddress' },
        { status: 400 }
      )
    }

    if (!body.txType || !['swap', 'bridge'].includes(body.txType)) {
      return NextResponse.json(
        { error: 'txType must be "swap" or "bridge"' },
        { status: 400 }
      )
    }

    await trackSwapTransaction({
      txHash: body.txHash,
      chainId: body.chainId,
      protocol: body.protocol,
      command: body.command || 'unknown',
      txType: body.txType,
      walletAddress: body.walletAddress,
      tokenIn: body.tokenIn || 'unknown',
      tokenOut: body.tokenOut || 'unknown',
      amountIn: body.amountIn || '0',
      amountOut: body.amountOut || '0',
      gasUsed: body.gasUsed,
      gasPrice: body.gasPrice,
      route: body.route,
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[Track API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to track transaction' },
      { status: 500 }
    )
  }
}
