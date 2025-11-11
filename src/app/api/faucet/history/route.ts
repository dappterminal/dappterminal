/**
 * Faucet History API Endpoint
 *
 * GET /api/faucet/history?address=xxx&network=xxx&limit=10&offset=0
 *
 * Get faucet request history for an address
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth'
import { getFaucetRequestHistory } from '@/lib/faucet/transaction'
import { getChainConfig } from '@/lib/chains'

export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const auth = authenticateRequest(request)
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.reason)
    }

    // 2. Get query parameters
    const searchParams = request.nextUrl.searchParams
    const address = searchParams.get('address')
    const network = searchParams.get('network') || undefined
    const limit = parseInt(searchParams.get('limit') || '10', 10)
    const offset = parseInt(searchParams.get('offset') || '0', 10)

    // 3. Validate address
    if (!address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required parameter: address',
        },
        { status: 400 }
      )
    }

    if (!isAddress(address)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Ethereum address format',
        },
        { status: 400 }
      )
    }

    // 4. Validate pagination parameters
    if (limit < 1 || limit > 100) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid limit: must be between 1 and 100',
        },
        { status: 400 }
      )
    }

    if (offset < 0) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid offset: must be >= 0',
        },
        { status: 400 }
      )
    }

    // 5. Get request history
    const history = await getFaucetRequestHistory(address.toLowerCase(), {
      network,
      limit,
      offset,
    })

    // 6. Enhance response with explorer URLs
    const requestsWithUrls = history.requests.map((req) => {
      const chainConfig = getChainConfig(req.chainId)
      const explorerUrl = chainConfig?.blockExplorerUrls[0]
      const txUrl = req.txHash && explorerUrl
        ? `${explorerUrl}/tx/${req.txHash}`
        : undefined

      return {
        requestId: req.id,
        address: req.address,
        network: req.network,
        chainId: req.chainId,
        amount: req.amount,
        txHash: req.txHash,
        txUrl,
        status: req.status,
        errorMessage: req.errorMessage,
        createdAt: req.createdAt.toISOString(),
        processedAt: req.processedAt?.toISOString(),
        completedAt: req.completedAt?.toISOString(),
      }
    })

    // 7. Return paginated history
    return NextResponse.json({
      success: true,
      data: {
        requests: requestsWithUrls,
        pagination: {
          total: history.total,
          limit: history.limit,
          offset: history.offset,
          hasMore: history.offset + history.limit < history.total,
        },
      },
    })
  } catch (error: any) {
    console.error('Faucet history error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
