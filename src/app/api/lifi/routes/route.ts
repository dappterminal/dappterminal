/**
 * LiFi Routes API Proxy
 *
 * Proxies requests to the external lifi-api-nextjs service
 * GET /api/lifi/routes - Get bridge routes from LiFi
 */

import { NextRequest, NextResponse } from 'next/server'

const LIFI_PROXY_URL = process.env.LIFI_PROXY_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  try {
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
    console.error('[LiFi Routes API] Error:', error)
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
