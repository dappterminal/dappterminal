/**
 * Faucet Request API Endpoint
 *
 * POST /api/faucet/request
 * Request testnet tokens from the faucet
 */

import { NextRequest, NextResponse } from 'next/server'
import { isAddress } from 'viem'
import { authenticateRequest, unauthorizedResponse } from '@/lib/auth'
import { checkFaucetRateLimit } from '@/lib/faucet/rate-limit-db'
import { processFaucetRequest } from '@/lib/faucet/transaction'
import { isFaucetNetworkSupported } from '@/lib/faucet/config'
import { getClientIdentifier } from '@/lib/rate-limit'

export async function POST(request: NextRequest) {
  try {
    // 1. Authentication
    const auth = authenticateRequest(request)
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.reason)
    }

    // 2. Parse request body
    const body = await request.json()
    const { address, network } = body

    // 3. Validate required fields
    if (!address || !network) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing required fields: address and network are required',
        },
        { status: 400 }
      )
    }

    // 4. Validate address format
    if (!isAddress(address)) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid Ethereum address format',
        },
        { status: 400 }
      )
    }

    // 5. Validate network
    if (!isFaucetNetworkSupported(network)) {
      return NextResponse.json(
        {
          success: false,
          error: `Network "${network}" is not supported. Supported networks: sepolia, holesky, optimism-sepolia`,
        },
        { status: 400 }
      )
    }

    // 6. Get client IP address
    const forwardedFor = request.headers.get('x-forwarded-for')
    const realIp = request.headers.get('x-real-ip')
    const ipAddress = forwardedFor?.split(',')[0].trim() || realIp || 'unknown'

    // 7. Check rate limits
    const rateLimitResult = await checkFaucetRateLimit(
      address.toLowerCase(),
      ipAddress,
      network
    )

    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: rateLimitResult.reason || 'Rate limit exceeded',
          resetTime: rateLimitResult.resetTime?.toISOString(),
        },
        { status: 429 }
      )
    }

    // 8. Process faucet request
    const result = await processFaucetRequest({
      address: address.toLowerCase(),
      network,
      ipAddress,
    })

    // 9. Handle result
    if (result.status === 'failed') {
      return NextResponse.json(
        {
          success: false,
          error: result.error || 'Failed to process faucet request',
          requestId: result.requestId,
        },
        { status: 500 }
      )
    }

    // 10. Success response
    return NextResponse.json({
      success: true,
      data: {
        requestId: result.requestId,
        txHash: result.txHash,
        status: result.status,
        network,
        address,
        message: `Tokens sent successfully! Transaction: ${result.txHash}`,
      },
    })
  } catch (error: any) {
    console.error('Faucet request error:', error)

    // Handle specific errors
    if (error.message?.includes('insufficient balance')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faucet is currently out of funds. Please try again later or contact support.',
        },
        { status: 503 }
      )
    }

    if (error.message?.includes('not configured')) {
      return NextResponse.json(
        {
          success: false,
          error: 'Faucet service is not properly configured. Please contact support.',
        },
        { status: 503 }
      )
    }

    // Generic error response
    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred while processing your request',
      },
      { status: 500 }
    )
  }
}

// GET method to show API info
export async function GET() {
  return NextResponse.json({
    endpoint: '/api/faucet/request',
    method: 'POST',
    description: 'Request testnet tokens from the faucet',
    requiredFields: {
      address: 'Ethereum address to receive tokens',
      network: 'Network name (sepolia, holesky, optimism-sepolia)',
    },
    rateLimit: {
      perAddress: '1 request per 24 hours per network',
      perIP: '5 requests per hour, 10 requests per day',
    },
    example: {
      address: '0x1234567890123456789012345678901234567890',
      network: 'sepolia',
    },
  })
}
