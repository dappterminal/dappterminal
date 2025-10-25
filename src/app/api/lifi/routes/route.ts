/**
 * LiFi Routes API Proxy
 *
 * Proxies requests to the external lifi-api-nextjs service
 * GET /api/lifi/routes - Get bridge routes from LiFi
 */

import { NextRequest, NextResponse } from 'next/server'
import { rateLimitResponse } from '@/lib/auth'
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit'

const LIFI_PROXY_URL = process.env.LIFI_PROXY_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  try {
    // Note: No authentication required - this is a public API proxy
    // Apply rate limiting (moderate for bridging queries)
    const clientId = getClientIdentifier(request)
    const rateLimitResult = await rateLimit(clientId, 'MODERATE')

    if (!rateLimitResult.success) {
      return rateLimitResponse(rateLimitResult.reset)
    }

    const body = await request.json()

    // Forward request to external LiFi proxy
    const response = await fetch(`https://li.quest/v1/advanced/routes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const data = await response.json()

    // Return with appropriate status code
    return NextResponse.json(data, { status: response.status })
  } catch (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('[LiFi Routes API] Error:', error)
    }
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch routes from LiFi API',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
