/**
 * Template API route for protocol actions
 *
 * Copy this template to create new protocol API endpoints.
 * Path: src/app/api/[protocol-id]/[action-name]/route.ts
 */

import { NextRequest, NextResponse } from 'next/server'

/**
 * Type definitions for request/response
 */
interface ActionRequest {
  // Define your request parameters here
  param1: string
  param2: number
  // Add more as needed
}

interface ActionResponse {
  // Define your response data structure here
  result: string
  // Add more as needed
}

/**
 * POST handler for this action
 */
export async function POST(request: NextRequest) {
  try {
    // Parse and validate request body
    const body: ActionRequest = await request.json()

    // TODO: Add validation
    if (!body.param1) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameter: param1' },
        { status: 400 }
      )
    }

    // TODO: Implement your protocol-specific logic here
    const result: ActionResponse = {
      result: `Processed ${body.param1} with value ${body.param2}`
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * GET handler (optional)
 */
export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const { searchParams } = new URL(request.url)
    const param = searchParams.get('param')

    // TODO: Implement GET logic
    const result = {
      message: 'GET endpoint',
      param
    }

    return NextResponse.json({
      success: true,
      data: result
    })
  } catch (error) {
    console.error('API Error:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
