import { NextRequest, NextResponse } from 'next/server'
import { OneInchAPI } from '@/plugins/1inch/api'
import { authenticateRequest, unauthorizedResponse, rateLimitResponse } from '@/lib/auth'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

export async function GET(request: NextRequest) {
  try {
    // 1. Authenticate request
    const auth = authenticateRequest(request)
    if (!auth.authenticated) {
      return unauthorizedResponse(auth.reason)
    }

    // 2. Apply rate limiting (moderate for gas price queries)
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await rateLimit(clientId, 'MODERATE')

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult.reset)
    }

    const searchParams = request.nextUrl.searchParams
    const chainId = searchParams.get('chainId') || '1'

    const api = new OneInchAPI(process.env.ONEINCH_API_KEY || '')
    const data = await api.getGasPrice({ chainId: parseInt(chainId) })

    return NextResponse.json(data)
  } catch (error: unknown) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Gas price API error:', error)
    }
    const errorMessage = error instanceof Error ? error.message : 'Failed to get gas prices'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
