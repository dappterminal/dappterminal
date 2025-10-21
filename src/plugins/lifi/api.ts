/**
 * LiFi API Client
 *
 * Thin wrapper around fetch calls to the LiFi API proxy
 * All endpoints forward requests to the lifi-api-nextjs proxy
 */

import type {
  LiFiQuoteRequest,
  LiFiQuoteResponse,
  LiFiStepTransactionRequest,
  LiFiStepTransactionResponse,
  LiFiStatusRequest,
  LiFiStatusResponse,
  LiFiHealthResponse,
} from './types'

export class LiFiAPI {
  private baseUrl: string

  constructor(baseUrl: string = '/api/lifi') {
    this.baseUrl = baseUrl
  }

  /**
   * Test API key validity
   */
  async testKey(): Promise<LiFiHealthResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/test-key`, {
        method: 'GET',
      })

      if (!response.ok) {
        return {
          success: false,
          error: `API returned ${response.status}: ${response.statusText}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: {
          valid: data.valid || true,
          message: data.message,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get bridge routes
   */
  async getRoutes(request: LiFiQuoteRequest): Promise<LiFiQuoteResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/routes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromChainId: Number(request.fromChain),
          toChainId: Number(request.toChain),
          fromTokenAddress: request.fromToken,
          toTokenAddress: request.toToken,
          fromAmount: request.fromAmount,
          fromAddress: request.fromAddress,
          toAddress: request.toAddress,
          options: {
            slippage: request.slippage || 0.5,
            allowBridges: request.allowBridges,
            denyBridges: request.denyBridges,
            allowExchanges: request.allowExchanges,
            denyExchanges: request.denyExchanges,
          },
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error || `API returned ${response.status}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: {
          routes: data.routes || [],
          selectedRoute: data.routes?.[0],
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get transaction data for a specific route step
   */
  async getStepTransaction(
    request: LiFiStepTransactionRequest
  ): Promise<LiFiStepTransactionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/step-transaction`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          route: request.route,
          stepIndex: request.stepIndex,
        }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error || `API returned ${response.status}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data: {
          transactionRequest: data.transactionRequest,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }

  /**
   * Get bridge status
   */
  async getStatus(request: LiFiStatusRequest): Promise<LiFiStatusResponse> {
    try {
      const params = new URLSearchParams({
        bridge: request.bridge,
        fromChain: request.fromChain.toString(),
        toChain: request.toChain.toString(),
        txHash: request.txHash,
      })

      const response = await fetch(`${this.baseUrl}/status?${params}`, {
        method: 'GET',
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        return {
          success: false,
          error: errorData.error || `API returned ${response.status}`,
        }
      }

      const data = await response.json()
      return {
        success: true,
        data,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }
    }
  }
}

// Singleton instance
export const lifiAPI = new LiFiAPI()
