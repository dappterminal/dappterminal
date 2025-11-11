/**
 * Faucet Status API Endpoint
 *
 * GET /api/faucet/status?requestId=xxx
 * or
 * GET /api/faucet/status?txHash=xxx
 *
 * Check the status of a faucet request
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth'
import { getFaucetRequestStatus } from '@/lib/faucet/transaction'
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
    const requestId = searchParams.get('requestId')
    const txHash = searchParams.get('txHash')
    const address = searchParams.get('address')
    const network = searchParams.get('network')

    // 3. Validate that we have at least one identifier
    if (!requestId && !txHash && !address) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing query parameter: provide requestId, txHash, or address',
        },
        { status: 400 }
      )
    }

    let faucetRequest

    // 4. Query by requestId (most specific)
    if (requestId) {
      faucetRequest = await getFaucetRequestStatus(requestId)
    }
    // 5. Query by txHash
    else if (txHash) {
      faucetRequest = await prisma.faucetRequest.findFirst({
        where: { txHash: txHash },
        orderBy: { createdAt: 'desc' },
      })
    }
    // 6. Query by address (returns most recent)
    else if (address) {
      const where: any = {
        address: address.toLowerCase(),
      }

      if (network) {
        where.network = network
      }

      faucetRequest = await prisma.faucetRequest.findFirst({
        where,
        orderBy: { createdAt: 'desc' },
      })
    }

    // 7. Check if request was found
    if (!faucetRequest) {
      return NextResponse.json(
        {
          success: false,
          error: 'Request not found',
        },
        { status: 404 }
      )
    }

    // 8. Get chain config for explorer URL
    const chainConfig = getChainConfig(faucetRequest.chainId)
    const explorerUrl = chainConfig?.blockExplorerUrls[0]
    const txUrl = faucetRequest.txHash && explorerUrl
      ? `${explorerUrl}/tx/${faucetRequest.txHash}`
      : undefined

    // 9. Return status
    return NextResponse.json({
      success: true,
      data: {
        requestId: faucetRequest.id,
        address: faucetRequest.address,
        network: faucetRequest.network,
        chainId: faucetRequest.chainId,
        amount: faucetRequest.amount,
        txHash: faucetRequest.txHash,
        txUrl,
        status: faucetRequest.status,
        errorMessage: faucetRequest.errorMessage,
        createdAt: faucetRequest.createdAt.toISOString(),
        processedAt: faucetRequest.processedAt?.toISOString(),
        completedAt: faucetRequest.completedAt?.toISOString(),
      },
    })
  } catch (error: any) {
    console.error('Faucet status error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
