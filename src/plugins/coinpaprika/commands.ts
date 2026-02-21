/**
 * CoinPaprika Plugin Commands
 */

import type { Command, ExecutionContext, CommandResult } from '@/core'
import { coinRegistry } from './data/coin-registry'
import type { TickerResponse } from './types'

/**
 * Command: cprice
 *
 * Get cryptocurrency price from CoinPaprika
 *
 * Usage: cprice <symbol>
 * Example: cprice BTC
 */
export const cpriceCommand: Command = {
  id: 'cprice',
  scope: 'G_alias',
  description: 'Get cryptocurrency price from CoinPaprika (56K+ coins)',

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const symbol = argsStr.split(' ')[0]

      if (!symbol) {
        return {
          success: false,
          error: new Error(
            'Usage: cprice <symbol>\\nExample: cprice BTC\\n         cprice ETH'
          ),
        }
      }

      // Step 1: Resolve symbol to CoinPaprika ID
      const coinId = await coinRegistry.resolveSymbol(symbol)

      if (!coinId) {
        return {
          success: false,
          error: new Error(
            `Coin '${symbol.toUpperCase()}' not found in CoinPaprika database.\\n\\nTry searching: coinsearch ${symbol}`
          ),
        }
      }

      // Step 2: Fetch price data
      const response = await fetch(`/api/coinpaprika/ticker/${coinId}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const ticker: TickerResponse = await response.json()

      // Step 3: Format price data
      const price = ticker.quotes.USD.price
      const change24h = ticker.quotes.USD.percent_change_24h
      const marketCap = ticker.quotes.USD.market_cap
      const volume24h = ticker.quotes.USD.volume_24h
      const rank = ticker.rank

      // Format large numbers
      const formatNumber = (num: number): string => {
        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
      }

      // Format price based on value
      const formatPrice = (p: number): string => {
        if (p >= 1)
          return `$${p.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })}`
        if (p >= 0.01) return `$${p.toFixed(4)}`
        if (p >= 0.0001) return `$${p.toFixed(6)}`
        return `$${p.toExponential(4)}`
      }

      // Determine change emoji
      const changeEmoji = change24h >= 0 ? '📈' : '📉'
      const changeSign = change24h >= 0 ? '+' : ''

      return {
        success: true,
        value: {
          message: [
            `${changeEmoji} ${ticker.name} (${ticker.symbol})`,
            ``,
            `  Price: ${formatPrice(price)}`,
            `  24h Change: ${changeSign}${change24h.toFixed(2)}%`,
            `  Market Cap: ${formatNumber(marketCap)} ${rank > 0 ? `(Rank #${rank})` : ''}`,
            `  Volume (24h): ${formatNumber(volume24h)}`,
            ``,
            `  Source: CoinPaprika`,
          ].join('\\n'),
          ticker,
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      // Check for rate limiting
      if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        return {
          success: false,
          error: new Error(
            'Rate limit exceeded\\n\\nCoinPaprika free tier: 25,000 requests/month\\nPlease try again in a few moments.'
          ),
        }
      }

      return {
        success: false,
        error: new Error(`Failed to fetch price: ${errorMsg}`),
      }
    }
  },
}

/**
 * Command: coinsearch
 *
 * Search for cryptocurrencies by name or symbol
 *
 * Usage: coinsearch <query>
 * Example: coinsearch bitcoin
 */
export const coinsearchCommand: Command = {
  id: 'coinsearch',
  scope: 'G_alias',
  description: 'Search for cryptocurrencies by name or symbol',

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const query = argsStr.split(' ')[0]

      if (!query) {
        return {
          success: false,
          error: new Error(
            'Usage: coinsearch <query>\\nExample: coinsearch bitcoin\\n         coinsearch doge'
          ),
        }
      }

      // Perform fuzzy search (limit to top 15 results)
      const results = await coinRegistry.fuzzySearch(query, 15)

      if (results.length === 0) {
        return {
          success: false,
          error: new Error(
            `No results found for '${query}'\\n\\nTry a different search term or check spelling`
          ),
        }
      }

      // Format results
      const formattedResults = results.map((coin, index) => {
        const rankStr = coin.rank > 0 ? `#${coin.rank}` : 'Unranked'
        const typeIcon = coin.type === 'coin' ? '🪙' : '🎫'
        return `  ${index + 1}. ${typeIcon} ${coin.symbol} - ${coin.name} (${rankStr})`
      })

      return {
        success: true,
        value: {
          message: [
            `🔍 Search results for '${query}':`,
            ``,
            ...formattedResults,
            ``,
            `💡 Use 'cprice <symbol>' to get price data`,
          ].join('\\n'),
          results,
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        error: new Error(`Search failed: ${errorMsg}`),
      }
    }
  },
}

/**
 * Command: cchart
 *
 * Add CoinPaprika price chart to analytics panel
 *
 * Usage: cchart <symbol> [--line]
 * Example: cchart BTC
 *          cchart ETH --line
 */
export const cchartCommand: Command = {
  id: 'cchart',
  scope: 'G_alias',
  description: 'Add CoinPaprika price chart to analytics panel',

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const argTokens = argsStr.split(/\\s+/).filter(Boolean)

      // Extract symbol (first non-flag argument)
      const symbol = argTokens.find(token => !token.startsWith('--'))

      if (!symbol) {
        return {
          success: false,
          error: new Error(
            'Usage: cchart <symbol> [--line]\\nExample: cchart BTC\\n         cchart ETH --line'
          ),
        }
      }

      // Check for line mode flag
      const isLineMode = argTokens.includes('--line')

      // Step 1: Resolve symbol to CoinPaprika ID
      const coinId = await coinRegistry.resolveSymbol(symbol)

      if (!coinId) {
        return {
          success: false,
          error: new Error(
            `Coin '${symbol.toUpperCase()}' not found in CoinPaprika database.\\n\\nTry searching: coinsearch ${symbol}`
          ),
        }
      }

      // Step 2: Fetch OHLCV data (30 days of daily data)
      const response = await fetch(
        `/api/coinpaprika/ohlcv/${coinId}?interval=24h&limit=30`
      )

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const chartData = await response.json()

      // Step 3: Return chart data for analytics panel
      return {
        success: true,
        value: {
          message: `📊 Added ${symbol.toUpperCase()} chart to analytics panel (CoinPaprika)`,
          chartType: isLineMode ? 'line' : 'candlestick',
          symbol: symbol.toUpperCase(),
          source: 'coinpaprika',
          interval: chartData.interval || '24h',
          dataPoints: chartData.count || 0,
          data: chartData.data,
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)

      // Check for rate limiting
      if (errorMsg.includes('429') || errorMsg.includes('rate limit')) {
        return {
          success: false,
          error: new Error(
            'Rate limit exceeded\\n\\nCoinPaprika free tier: 25,000 requests/month\\nPlease try again in a few moments.'
          ),
        }
      }

      return {
        success: false,
        error: new Error(`Failed to fetch chart data: ${errorMsg}`),
      }
    }
  },
}
