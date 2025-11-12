/**
 * CoinPaprika API Client
 *
 * Wrapper for CoinPaprika REST API
 * Docs: https://api.coinpaprika.com/
 */

import type { TickerResponse, OHLCVDataPoint, CoinInfo } from '../types'

export class CoinPaprikaAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'CoinPaprikaAPIError'
  }
}

export class CoinPaprikaClient {
  private readonly baseUrl = 'https://api.coinpaprika.com/v1'
  private readonly timeout = 10000 // 10 seconds

  /**
   * Get ticker information (price, volume, market cap)
   * @param coinId - CoinPaprika coin ID (e.g., 'btc-bitcoin')
   */
  async getTicker(coinId: string): Promise<TickerResponse> {
    return this.fetch<TickerResponse>(`/tickers/${coinId}`)
  }

  /**
   * Get historical OHLCV data
   * @param coinId - CoinPaprika coin ID
   * @param start - Start date (ISO 8601)
   * @param end - End date (ISO 8601)
   * @param limit - Number of data points (default: 366, max: 366)
   * @param quote - Quote currency (default: 'usd')
   * @param interval - Data interval (default: '1d')
   */
  async getOHLCV(
    coinId: string,
    options: {
      start?: string
      end?: string
      limit?: number
      quote?: string
      interval?: '1h' | '24h' | '7d' | '14d' | '30d' | '90d' | '365d'
    } = {}
  ): Promise<OHLCVDataPoint[]> {
    const params = new URLSearchParams()
    if (options.start) params.append('start', options.start)
    if (options.end) params.append('end', options.end)
    if (options.limit) params.append('limit', options.limit.toString())
    if (options.quote) params.append('quote', options.quote)
    if (options.interval) params.append('interval', options.interval)

    const query = params.toString()
    const url = `/coins/${coinId}/ohlcv/historical${query ? `?${query}` : ''}`

    return this.fetch<OHLCVDataPoint[]>(url)
  }

  /**
   * Get detailed coin information
   * @param coinId - CoinPaprika coin ID
   */
  async getCoinInfo(coinId: string): Promise<CoinInfo> {
    return this.fetch<CoinInfo>(`/coins/${coinId}`)
  }

  /**
   * Generic fetch method with error handling
   */
  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
        },
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new CoinPaprikaAPIError(
          errorData.error || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        )
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof CoinPaprikaAPIError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new CoinPaprikaAPIError('Request timeout')
        }
        throw new CoinPaprikaAPIError(`Network error: ${error.message}`)
      }

      throw new CoinPaprikaAPIError('Unknown error occurred')
    }
  }
}

// Export singleton instance
export const coinPaprikaClient = new CoinPaprikaClient()
