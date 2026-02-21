/**
 * Chart types and interfaces for price data and analytics
 */

export type ChartType = 'candlestick' | 'line' | 'bar' | 'area' | 'graph' | 'portfolio'
export type TimeRange = '1m' | '5m' | '15m' | '1h' | '4h' | '12h' | '24h' | '1w' | '1M' | '1Y' | 'ALL'
export type DataSource = '1inch' | 'CoinGecko' | 'DexScreener' | 'Coinbase' | 'Kraken' | 'Mock' | 'Custom'

/**
 * OHLC data for candlestick charts
 */
export interface OHLCData {
  timestamp: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

/**
 * Simple price point for line charts
 */
export interface PricePoint {
  timestamp: number
  price: number
}

/**
 * Performance metric data
 */
export interface PerformanceMetric {
  label: string
  value: number
  change?: number // percentage change
  color?: string
}

/**
 * Network graph node
 */
export interface GraphNode {
  id: string
  name: string
  type: 'protocol' | 'chain' | 'token'
  value?: number // size of node
  color?: string
  category?: number
}

/**
 * Network graph edge/link
 */
export interface GraphLink {
  source: string
  target: string
  value?: number // strength of connection
  label?: string
}

/**
 * Network graph data
 */
export interface NetworkGraphData {
  nodes: GraphNode[]
  links: GraphLink[]
  categories?: Array<{ name: string }>
}

/**
 * Chart data wrapper for API responses
 */
export interface ChartDataResponse<T> {
  data: T
  symbol?: string
  lastUpdate?: number
  timeRange?: TimeRange
}

/**
 * Chart configuration options
 */
export interface ChartConfig {
  height?: number
  showGrid?: boolean
  showTooltip?: boolean
  showLegend?: boolean
  theme?: 'dark' | 'light'
  autoRefresh?: boolean
  refreshInterval?: number // milliseconds
}

/**
 * Portfolio token balance for pie chart
 */
export interface PortfolioTokenBalance {
  symbol: string
  name: string
  tokenAddress: string
  chainId: number
  chainName?: string
  balance: string // raw balance
  formattedBalance: string // human-readable
  usdValue: number
  percentage: number
}

/**
 * Portfolio data for pie chart
 */
export interface PortfolioData {
  tokens: PortfolioTokenBalance[]
  totalUsdValue: number
  chains: number[]
}
