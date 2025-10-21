/**
 * LiFi Test Key API
 *
 * Tests LiFi API key validity by making a simple request
 * GET /api/lifi/test-key - Test LiFi API key validity
 */

import { NextRequest, NextResponse } from 'next/server'

const LIFI_API_KEY = process.env.LIFI_API_KEY

export async function GET(request: NextRequest) {
  try {
    // Check if API key is configured
    if (!LIFI_API_KEY) {
      return NextResponse.json(
        {
          success: false,
          error: 'LIFI_API_KEY environment variable is not configured',
        },
        { status: 500 }
      )
    }

    // Test the API key by fetching chains (lightweight endpoint)
    const response = await fetch('https://li.quest/v1/chains', {
      method: 'GET',
      headers: {
        'accept': 'application/json',
        'x-lifi-api-key': LIFI_API_KEY,
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          success: false,
          error: `LiFi API returned status ${response.status}`,
          message: 'Invalid API key or API error',
        },
        { status: response.status }
      )
    }

    // API key is valid
    return NextResponse.json({
      success: true,
      data: {
        message: 'LiFi API key is valid and working',
        timestamp: new Date().toISOString(),
      },
    })
  } catch (error) {
    console.error('[LiFi Test Key API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to test LiFi API key',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
