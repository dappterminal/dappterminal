/**
 * API Client utilities for protocol commands
 *
 * Provides type-safe methods for calling protocol API endpoints
 */

import type { ProtocolId } from '@/core/types'

/**
 * Standard API response format
 */
export interface ApiResponse<T = unknown> {
  success: boolean
  data?: T
  error?: string
}

/**
 * API request options
 */
export interface ApiRequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE'
  body?: unknown
  headers?: Record<string, string>
}

/**
 * Make an API call to a protocol endpoint
 *
 * @param protocol - Protocol ID (e.g., 'uniswap-v4', 'aave-v3')
 * @param action - Action name (e.g., 'quote', 'swap', 'supply')
 * @param options - Request options
 * @returns Promise with typed API response
 */
export async function callProtocolApi<T = unknown>(
  protocol: ProtocolId,
  action: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'POST', body, headers = {} } = options

  try {
    const url = `/api/${protocol}/${action}`

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return data as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Make a GET request to a protocol endpoint
 */
export async function getProtocolData<T = unknown>(
  protocol: ProtocolId,
  action: string,
  params?: Record<string, string>
): Promise<ApiResponse<T>> {
  try {
    const searchParams = params ? `?${new URLSearchParams(params).toString()}` : ''
    const url = `/api/${protocol}/${action}${searchParams}`

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return data as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Call a core API endpoint (not protocol-specific)
 */
export async function callCoreApi<T = unknown>(
  action: string,
  options: ApiRequestOptions = {}
): Promise<ApiResponse<T>> {
  const { method = 'POST', body, headers = {} } = options

  try {
    const url = `/api/core/${action}`

    const response = await fetch(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      ...(body ? { body: JSON.stringify(body) } : {}),
    })

    if (!response.ok) {
      const errorData = await response.json()
      return {
        success: false,
        error: errorData.error || `HTTP ${response.status}: ${response.statusText}`,
      }
    }

    const data = await response.json()
    return data as ApiResponse<T>
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Network error',
    }
  }
}

/**
 * Helper to convert API response to CommandResult
 */
export function apiToCommandResult<T>(apiResponse: ApiResponse<T>) {
  if (apiResponse.success && apiResponse.data !== undefined) {
    return {
      success: true as const,
      value: apiResponse.data,
    }
  } else {
    return {
      success: false as const,
      error: new Error(apiResponse.error || 'API call failed'),
    }
  }
}
