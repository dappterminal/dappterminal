/**
 * Chart utilities and configuration for ECharts
 */

import type {
  OHLCData,
  PricePoint,
  PerformanceMetric,
  NetworkGraphData,
  GraphNode,
  GraphLink,
  ChartConfig,
} from '@/types/charts'

/**
 * Dark theme configuration for ECharts matching terminal colors
 */
export const darkTheme = {
  backgroundColor: '#141414',
  textStyle: {
    color: '#E5E5E5',
    fontFamily: 'monospace',
  },
  title: {
    textStyle: {
      color: '#E5E5E5',
    },
  },
  tooltip: {
    backgroundColor: '#262626',
    borderColor: '#404040',
    textStyle: {
      color: '#E5E5E5',
    },
  },
  grid: {
    borderColor: '#262626',
    backgroundColor: '#141414',
  },
  xAxis: {
    axisLine: {
      lineStyle: {
        color: '#404040',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#404040',
      },
    },
    axisLabel: {
      color: '#737373',
    },
    splitLine: {
      lineStyle: {
        color: '#262626',
      },
    },
  },
  yAxis: {
    axisLine: {
      lineStyle: {
        color: '#404040',
      },
    },
    axisTick: {
      lineStyle: {
        color: '#404040',
      },
    },
    axisLabel: {
      color: '#737373',
    },
    splitLine: {
      lineStyle: {
        color: '#262626',
      },
    },
  },
  color: [
    '#10B981', // Green (up)
    '#EF4444', // Red (down)
    '#3B82F6', // Blue
    '#F59E0B', // Amber
    '#8B5CF6', // Purple
    '#EC4899', // Pink
  ],
}

/**
 * Generate mock OHLC candlestick data
 */
export function generateMockOHLCData(
  count: number = 100,
  startPrice: number = 2000,
  volatility: number = 0.02
): OHLCData[] {
  const data: OHLCData[] = []
  const now = Date.now()
  const interval = 60 * 60 * 1000 // 1 hour intervals

  let currentPrice = startPrice

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * interval

    // Random price movement
    const change = (Math.random() - 0.5) * 2 * volatility * currentPrice
    const open = currentPrice
    const close = currentPrice + change

    // High and low based on open/close
    const [lower, upper] = open < close ? [open, close] : [close, open]
    const high = upper + Math.random() * volatility * currentPrice * 0.5
    const low = lower - Math.random() * volatility * currentPrice * 0.5

    // Random volume
    const volume = Math.random() * 1000000 + 500000

    data.push({
      timestamp,
      open,
      high,
      low,
      close,
      volume,
    })

    currentPrice = close
  }

  return data
}

/**
 * Generate mock price points for line charts
 */
export function generateMockPricePoints(
  count: number = 100,
  startPrice: number = 2000,
  volatility: number = 0.02
): PricePoint[] {
  const data: PricePoint[] = []
  const now = Date.now()
  const interval = 60 * 60 * 1000 // 1 hour intervals

  let currentPrice = startPrice

  for (let i = 0; i < count; i++) {
    const timestamp = now - (count - i) * interval
    const change = (Math.random() - 0.5) * 2 * volatility * currentPrice
    currentPrice += change

    data.push({
      timestamp,
      price: currentPrice,
    })
  }

  return data
}

/**
 * Generate mock performance metrics
 */
export function generateMockPerformanceMetrics(): PerformanceMetric[] {
  return [
    {
      label: 'TVL',
      value: 1250000000,
      change: 12.5,
      color: '#10B981',
    },
    {
      label: 'Volume 24h',
      value: 45000000,
      change: -3.2,
      color: '#EF4444',
    },
    {
      label: 'Fees 24h',
      value: 125000,
      change: 8.7,
      color: '#10B981',
    },
    {
      label: 'Users 24h',
      value: 15420,
      change: 5.3,
      color: '#10B981',
    },
    {
      label: 'Transactions',
      value: 87650,
      change: -1.2,
      color: '#EF4444',
    },
    {
      label: 'Gas Used',
      value: 2340000,
      change: 15.8,
      color: '#F59E0B',
    },
  ]
}

/**
 * Generate mock network graph data
 */
export function generateMockNetworkGraph(): NetworkGraphData {
  const protocols = [
    { id: '1inch', name: '1inch', type: 'protocol' as const, value: 100 },
    { id: 'lifi', name: 'LiFi', type: 'protocol' as const, value: 90 },
    { id: 'wormhole', name: 'Wormhole', type: 'protocol' as const, value: 85 },
    { id: 'stargate', name: 'Stargate', type: 'protocol' as const, value: 80 },
    { id: 'uniswap', name: 'Uniswap', type: 'protocol' as const, value: 120 },
    { id: 'aave', name: 'Aave', type: 'protocol' as const, value: 110 },
  ]

  const chains = [
    { id: 'ethereum', name: 'Ethereum', type: 'chain' as const, value: 150, category: 1 },
    { id: 'arbitrum', name: 'Arbitrum', type: 'chain' as const, value: 100, category: 1 },
    { id: 'optimism', name: 'Optimism', type: 'chain' as const, value: 95, category: 1 },
    { id: 'polygon', name: 'Polygon', type: 'chain' as const, value: 90, category: 1 },
    { id: 'base', name: 'Base', type: 'chain' as const, value: 85, category: 1 },
  ]

  const tokens = [
    { id: 'eth', name: 'ETH', type: 'token' as const, value: 140, category: 2 },
    { id: 'usdc', name: 'USDC', type: 'token' as const, value: 130, category: 2 },
    { id: 'usdt', name: 'USDT', type: 'token' as const, value: 125, category: 2 },
    { id: 'wbtc', name: 'WBTC', type: 'token' as const, value: 100, category: 2 },
  ]

  const nodes: GraphNode[] = [...protocols, ...chains, ...tokens]

  const links: GraphLink[] = [
    // Protocols to chains
    { source: '1inch', target: 'ethereum', value: 50, label: 'swaps' },
    { source: '1inch', target: 'arbitrum', value: 30 },
    { source: '1inch', target: 'polygon', value: 25 },

    { source: 'lifi', target: 'ethereum', value: 40 },
    { source: 'lifi', target: 'arbitrum', value: 35 },
    { source: 'lifi', target: 'optimism', value: 30 },
    { source: 'lifi', target: 'base', value: 25 },

    { source: 'wormhole', target: 'ethereum', value: 45 },
    { source: 'wormhole', target: 'arbitrum', value: 40 },
    { source: 'wormhole', target: 'optimism', value: 38 },
    { source: 'wormhole', target: 'polygon', value: 35 },
    { source: 'wormhole', target: 'base', value: 30 },

    { source: 'stargate', target: 'ethereum', value: 42 },
    { source: 'stargate', target: 'arbitrum', value: 38 },
    { source: 'stargate', target: 'optimism', value: 36 },
    { source: 'stargate', target: 'polygon', value: 33 },

    { source: 'uniswap', target: 'ethereum', value: 60 },
    { source: 'uniswap', target: 'arbitrum', value: 45 },
    { source: 'uniswap', target: 'optimism', value: 43 },
    { source: 'uniswap', target: 'polygon', value: 40 },
    { source: 'uniswap', target: 'base', value: 38 },

    { source: 'aave', target: 'ethereum', value: 55 },
    { source: 'aave', target: 'arbitrum', value: 42 },
    { source: 'aave', target: 'optimism', value: 40 },
    { source: 'aave', target: 'polygon', value: 38 },

    // Chains to tokens
    { source: 'ethereum', target: 'eth', value: 100 },
    { source: 'ethereum', target: 'usdc', value: 90 },
    { source: 'ethereum', target: 'usdt', value: 85 },
    { source: 'ethereum', target: 'wbtc', value: 75 },

    { source: 'arbitrum', target: 'eth', value: 70 },
    { source: 'arbitrum', target: 'usdc', value: 65 },
    { source: 'arbitrum', target: 'usdt', value: 60 },

    { source: 'optimism', target: 'eth', value: 65 },
    { source: 'optimism', target: 'usdc', value: 60 },
    { source: 'optimism', target: 'usdt', value: 55 },

    { source: 'polygon', target: 'usdc', value: 60 },
    { source: 'polygon', target: 'usdt', value: 58 },
    { source: 'polygon', target: 'eth', value: 55 },

    { source: 'base', target: 'eth', value: 60 },
    { source: 'base', target: 'usdc', value: 55 },
  ]

  return {
    nodes,
    links,
    categories: [
      { name: 'Protocol' },
      { name: 'Chain' },
      { name: 'Token' },
    ],
  }
}

/**
 * Format number with abbreviations (K, M, B)
 */
export function formatNumber(value: number): string {
  if (value >= 1e9) {
    return `$${(value / 1e9).toFixed(2)}B`
  }
  if (value >= 1e6) {
    return `$${(value / 1e6).toFixed(2)}M`
  }
  if (value >= 1e3) {
    return `$${(value / 1e3).toFixed(2)}K`
  }
  return `$${value.toFixed(2)}`
}

/**
 * Format percentage change
 */
export function formatChange(change: number): string {
  const sign = change >= 0 ? '+' : ''
  return `${sign}${change.toFixed(2)}%`
}

/**
 * Get default chart config
 */
export function getDefaultChartConfig(): ChartConfig {
  return {
    height: 400,
    showGrid: true,
    showTooltip: true,
    showLegend: false,
    theme: 'dark',
    autoRefresh: false,
    refreshInterval: 60000, // 1 minute
  }
}
