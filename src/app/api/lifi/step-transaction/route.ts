/**
 * LiFi Step Transaction API Proxy
 *
 * Proxies requests to the external lifi-api-nextjs service
 * POST /api/lifi/step-transaction - Get transaction data for a route step
 */

import { NextRequest, NextResponse } from 'next/server'

const LIFI_PROXY_URL = process.env.LIFI_PROXY_URL || 'http://localhost:3001'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { route, stepIndex } = body

    if (!route || typeof stepIndex !== 'number') {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request: route and stepIndex are required',
        },
        { status: 400 }
      )
    }

    if (stepIndex < 0 || stepIndex >= route.steps.length) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid stepIndex: ${stepIndex}. Route has ${route.steps.length} steps.`,
        },
        { status: 400 }
      )
    }

    const step = route.steps[stepIndex]

    console.log(`[LiFi Step Transaction API] Step ${stepIndex}:`, JSON.stringify(step, null, 2))

    // The LiFi stepTransaction endpoint expects just the step object
    // Forward request to LiFi API
    const response = await fetch(`https://li.quest/v1/advanced/stepTransaction`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'accept': 'application/json',
      },
      body: JSON.stringify(step),
    })

    console.log(`[LiFi Step Transaction API] LiFi API response status:`, response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[LiFi Step Transaction API] LiFi API error:', response.status, errorText)
      return NextResponse.json(
        {
          success: false,
          error: `LiFi API returned status ${response.status}`,
          details: errorText,
        },
        { status: response.status }
      )
    }

    const data = await response.json()

    console.log('[LiFi Step Transaction API] Response from LiFi:', JSON.stringify(data, null, 2))

    // LiFi can return the transaction request in different formats
    // Check if it's already a transaction request object
    let transactionRequest = null

    if (data.transactionRequest) {
      transactionRequest = data.transactionRequest
    } else if (data.to && data.data) {
      // Response is already a transaction request
      transactionRequest = data
    } else if (data.type === 'TRANSACTION') {
      // Some steps return { type: 'TRANSACTION', ... }
      transactionRequest = {
        to: data.to,
        from: data.from,
        data: data.data,
        value: data.value || '0x0',
        gasLimit: data.gasLimit,
        chainId: data.chainId || step.action.fromChainId,
      }
    }

    if (!transactionRequest) {
      console.error('[LiFi Step Transaction API] No valid transaction request in response:', data)
      return NextResponse.json(
        {
          success: false,
          error: 'LiFi API did not return a valid transaction request',
          details: JSON.stringify(data),
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: {
        transactionRequest,
      },
    })
  } catch (error) {
    console.error('[LiFi Step Transaction API] Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch step transaction from LiFi API',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    )
  }
}
