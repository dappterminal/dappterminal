/**
 * CoinGecko API Client
 *
 * Wrapper for CoinGecko API with Pro API key support
 * Docs: https://docs.coingecko.com/
 */

export interface CoinGeckoOHLCVResponse {
  // CoinGecko returns array of [timestamp, open, high, low, close]
  // Format: [[timestamp_ms, open, high, low, close], ...]
  data: number[][]
}

export class CoinGeckoAPIError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message)
    this.name = 'CoinGeckoAPIError'
  }
}

export class CoinGeckoClient {
  private readonly baseUrl: string
  private readonly apiKey: string | undefined
  private readonly timeout = 10000 // 10 seconds

  constructor(apiKey?: string) {
    this.apiKey = apiKey
    // Demo keys (starting with 'CG-') should use the free API endpoint
    // Only paid Pro keys (not starting with 'CG-') use pro-api endpoint
    const isDemoKey = apiKey?.startsWith('CG-')

    // Always use free API endpoint for demo keys and when no key is provided
    this.baseUrl = (apiKey && !isDemoKey)
      ? 'https://pro-api.coingecko.com/api/v3'
      : 'https://api.coingecko.com/api/v3'

    console.log(`[CoinGecko] Using ${this.baseUrl} ${isDemoKey ? '(demo key)' : apiKey ? '(pro key)' : '(no key)'}`)
  }

  /**
   * Get OHLC data (candlestick) for a coin
   * @param coinId - CoinGecko coin ID (e.g., 'ethereum', 'bitcoin')
   * @param vsCurrency - Currency for prices (default: 'usd')
   * @param days - Number of days of data (1, 7, 14, 30, 90, 180, 365, max)
   */
  async getOHLC(
    coinId: string,
    vsCurrency: string = 'usd',
    days: number | 'max' = 7
  ): Promise<number[][]> {
    const endpoint = `/coins/${coinId}/ohlc?vs_currency=${vsCurrency}&days=${days}`
    return this.fetch<number[][]>(endpoint)
  }

  /**
   * Get market chart data (price, market cap, volume)
   * @param coinId - CoinGecko coin ID
   * @param vsCurrency - Currency for prices (default: 'usd')
   * @param days - Number of days of data
   * @param interval - Data interval (optional, auto for <90 days)
   */
  async getMarketChart(
    coinId: string,
    vsCurrency: string = 'usd',
    days: number | 'max' = 7,
    interval?: 'daily'
  ): Promise<{
    prices: number[][]
    market_caps: number[][]
    total_volumes: number[][]
  }> {
    let endpoint = `/coins/${coinId}/market_chart?vs_currency=${vsCurrency}&days=${days}`
    if (interval) {
      endpoint += `&interval=${interval}`
    }
    return this.fetch(endpoint)
  }

  /**
   * Generic fetch method with error handling
   */
  private async fetch<T>(endpoint: string): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`

    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), this.timeout)

      const headers: Record<string, string> = {
        Accept: 'application/json',
      }

      // Add API key header if available
      if (this.apiKey) {
        headers['x-cg-pro-api-key'] = this.apiKey
      }

      const response = await fetch(url, {
        signal: controller.signal,
        headers,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new CoinGeckoAPIError(
          errorData.error || errorData.status?.error_message || `HTTP ${response.status}: ${response.statusText}`,
          response.status,
          errorData
        )
      }

      return (await response.json()) as T
    } catch (error) {
      if (error instanceof CoinGeckoAPIError) {
        throw error
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new CoinGeckoAPIError('Request timeout')
        }
        throw new CoinGeckoAPIError(`Network error: ${error.message}`)
      }

      throw new CoinGeckoAPIError('Unknown error occurred')
    }
  }
}

// Export singleton instance with API key from environment
export const coinGeckoClient = new CoinGeckoClient(process.env.COINGECKO_API_KEY)
