'use client'

/**
 * Price chart component with candlestick and line chart modes
 */

import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import type { EChartsOption } from 'echarts'
import { BaseChart } from './base-chart'
import type { OHLCData, PricePoint, ChartType, TimeRange, DataSource } from '@/types/charts'
import { generateMockOHLCData, generateMockPricePoints } from '@/lib/charts'
import { resolveTokenAddress } from '@/plugins/1inch/tokens'

/**
 * Format price with appropriate decimal places based on magnitude
 * - Prices >= $1: 2 decimals (e.g., $123.45)
 * - Prices >= $0.01: 4 decimals (e.g., $0.1234)
 * - Prices < $0.01: Show significant digits (e.g., $0.00001234)
 */
function formatPrice(price: number): string {
  if (price >= 1) {
    return price.toFixed(2)
  } else if (price >= 0.01) {
    return price.toFixed(4)
  } else if (price === 0) {
    return '0.00'
  } else {
    // For very small prices, show up to 8 significant figures
    // Remove trailing zeros
    return price.toFixed(8).replace(/\.?0+$/, '')
  }
}

export interface PriceChartProps {
  data?: OHLCData[] | PricePoint[]
  chartType?: ChartType
  timeRange?: TimeRange
  dataSource?: DataSource
  symbol?: string
  displaySymbol?: string // Display label (e.g., "WBTC/USDC" instead of contract address)
  height?: number | string
  className?: string
  resizeKey?: number
}

export function PriceChart({
  data,
  chartType: initialChartType = 'candlestick',
  timeRange: initialTimeRange = '24h',
  dataSource: initialDataSource = '1inch',
  symbol = 'ETH/USDC',
  displaySymbol,
  height = 400,
  className = '',
  resizeKey,
}: PriceChartProps) {
  const [chartType, setChartType] = useState<'candlestick' | 'line'>(initialChartType as 'candlestick' | 'line')
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange)
  const [dataSource, setDataSource] = useState<DataSource>(initialDataSource)
  const [showDropdown, setShowDropdown] = useState(false)
  const [apiData, setApiData] = useState<OHLCData[] | PricePoint[] | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const [lastRefresh, setLastRefresh] = useState<number | null>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cache for API data to avoid refetching
  const cacheRef = useRef<Map<string, OHLCData[] | PricePoint[]>>(new Map())

  // Sync props with internal state
  useEffect(() => {
    setTimeRange(initialTimeRange)
  }, [initialTimeRange])

  useEffect(() => {
    setDataSource(initialDataSource)
  }, [initialDataSource])

  useEffect(() => {
    setChartType(initialChartType as 'candlestick' | 'line')
  }, [initialChartType])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false)
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown])

  // Extracted fetch function so it can be called by both the initial effect and the polling interval
  const fetchChartData = useCallback(async (skipClientCache = false) => {
    if ((dataSource !== '1inch' && dataSource !== 'CoinGecko') || data) {
      return
    }

    // Create cache key based on chart parameters
    const cacheKey = `${symbol}-${chartType}-${timeRange}-${dataSource}`

    // Check if data is already cached (skip on polling refreshes)
    if (!skipClientCache) {
      const cachedData = cacheRef.current.get(cacheKey)
      if (cachedData) {
        setApiData(cachedData)
        return
      }
    }

    setIsLoading(true)
      try {
        // Handle CoinGecko data source
        if (dataSource === 'CoinGecko') {
          // Parse symbol (e.g., "ETH/USDC" -> base=ETH)
          const [baseSymbol] = symbol.split('/').map(s => s.trim())

          // Resolve symbol to CoinGecko coin ID via server endpoint
          const resolveRes = await fetch(`/api/coingecko/resolve?symbol=${encodeURIComponent(baseSymbol)}`)
          if (!resolveRes.ok) {
            throw new Error(`Could not resolve "${baseSymbol}" to a CoinGecko coin`)
          }
          const { id: coinId } = await resolveRes.json() as { id: string }

          // Map time range to days for CoinGecko
          const timeRangeToDays: Record<TimeRange, number | 'max'> = {
            '1m': 1,
            '5m': 1,
            '15m': 1,
            '1h': 1,
            '4h': 1,
            '12h': 1,
            '24h': 1,
            '1w': 7,
            '1M': 30,
            '1Y': 365,
            'ALL': 'max',
          }

          const days = timeRangeToDays[timeRange] || 7

          const endpoint = `/api/coingecko/ohlc/${coinId}?days=${days}&vs_currency=usd`

          const response = await fetch(endpoint)

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}))
            console.error('CoinGecko API error:', errorData)
            throw new Error('Failed to fetch CoinGecko chart data')
          }

          const result = await response.json()

          console.log('CoinGecko API response:', result)

          // Transform OHLC data to our format
          if (result.data && Array.isArray(result.data)) {
            const transformedData: OHLCData[] = result.data.map((point: any) => ({
              timestamp: new Date(point.time_open).getTime(),
              open: point.open || 0,
              high: point.high || 0,
              low: point.low || 0,
              close: point.close || 0,
              volume: point.volume || 0,
            }))

            console.log('Transformed CoinGecko data sample:', transformedData.slice(0, 3))
            cacheRef.current.set(cacheKey, transformedData)
            setApiData(transformedData)
          }

          setIsLoading(false)
          return
        }

        // Parse symbol (e.g., "ETH/USDC" -> token0=ETH, token1=USDC)
        const [token0Symbol, token1Symbol = 'USDC'] = symbol.split('/').map(s => s.trim())

        // Resolve token symbols to addresses
        const chainId = 1 // Default to Ethereum mainnet, could be made dynamic later
        const token0 = resolveTokenAddress(token0Symbol, chainId)
        const token1 = resolveTokenAddress(token1Symbol, chainId)

        // Map time range to period parameter for 1inch API
        // Candle uses seconds, Line uses period codes
        const candlePeriodMap: Record<TimeRange, string> = {
          '1m': '60',
          '5m': '300',
          '15m': '900',
          '1h': '3600',
          '4h': '14400',
          '12h': '43200',
          '24h': '86400',
          '1w': '604800',
          '1M': '2592000',
          '1Y': '31536000',
          'ALL': '31536000', // Default to 1 year for ALL
        }

        const linePeriodMap: Record<TimeRange, string> = {
          '1m': '1M',
          '5m': '5M',
          '15m': '15M',
          '1h': '1H',
          '4h': '4H',
          '12h': '12H',
          '24h': '24H',
          '1w': '1W',
          '1M': '1MON',
          '1Y': '1Y',
          'ALL': 'ALL',
        }

        const period = chartType === 'candlestick'
          ? (candlePeriodMap[timeRange] || '86400')
          : (linePeriodMap[timeRange] || '24H')

        const endpoint = chartType === 'candlestick'
          ? `/api/1inch/charts/candle?token0=${token0}&token1=${token1}&period=${period}&chainId=${chainId}`
          : `/api/1inch/charts/line?token0=${token0}&token1=${token1}&period=${period}&chainId=${chainId}`

        const response = await fetch(endpoint)

        if (!response.ok) {
          throw new Error('Failed to fetch chart data')
        }

        const result = await response.json()

        console.log('Chart API response:', result)

        // Transform API data to our format
        if (chartType === 'candlestick' && result.candles) {
          const candleData = result.candles.data || result.candles
          console.log('Raw candle data sample:', candleData.slice(0, 3))

          const transformedData: OHLCData[] = candleData.map((candle: any) => {
            // Handle array format: [time, open, high, low, close, volume]
            if (Array.isArray(candle)) {
              return {
                timestamp: candle[0] * 1000,
                open: parseFloat(candle[1]) || 0,
                high: parseFloat(candle[2]) || 0,
                low: parseFloat(candle[3]) || 0,
                close: parseFloat(candle[4]) || 0,
                volume: parseFloat(candle[5]) || 0,
              }
            }
            // Handle object format
            return {
              timestamp: candle.time * 1000,
              open: parseFloat(candle.open) || 0,
              high: parseFloat(candle.high) || 0,
              low: parseFloat(candle.low) || 0,
              close: parseFloat(candle.close) || 0,
              volume: parseFloat(candle.volume) || 0,
            }
          })
          console.log('Transformed candle data sample:', transformedData.slice(0, 3))
          console.log('First transformed candle:', transformedData[0])
          // Cache the transformed data
          cacheRef.current.set(cacheKey, transformedData)
          setApiData(transformedData)
        } else if (chartType === 'line' && result.data) {
          // Handle nested data structure: result.data.data
          const lineData = result.data.data || result.data
          const transformedData: PricePoint[] = lineData.map((point: any) => ({
            timestamp: point.time * 1000, // Convert to milliseconds
            price: parseFloat(point.value) || 0,
          }))
          console.log('Transformed line data:', transformedData)
          // Cache the transformed data
          cacheRef.current.set(cacheKey, transformedData)
          setApiData(transformedData)
        }
      } catch (error) {
        console.error('Error fetching chart data:', error)
        setApiData(null)
      } finally {
        setIsLoading(false)
        setLastRefresh(Date.now())
      }
  }, [symbol, chartType, timeRange, dataSource, data])

  // Initial fetch + refetch when parameters change
  useEffect(() => {
    if ((dataSource !== '1inch' && dataSource !== 'CoinGecko') || data) {
      setApiData(null)
      return
    }
    fetchChartData()
  }, [fetchChartData])

  // Auto-refresh polling — invalidates client cache so we get fresh server data
  useEffect(() => {
    if (!autoRefresh) return

    // Refresh interval based on time range — shorter ranges get faster updates
    const intervalMs = ['1m', '5m', '15m'].includes(timeRange) ? 15_000
      : ['1h', '4h'].includes(timeRange) ? 30_000
      : 60_000

    const id = setInterval(() => {
      // Clear the client cache entry so we actually hit the server
      const cacheKey = `${symbol}-${chartType}-${timeRange}-${dataSource}`
      cacheRef.current.delete(cacheKey)
      fetchChartData(true)
    }, intervalMs)

    return () => clearInterval(id)
  }, [autoRefresh, fetchChartData, symbol, chartType, timeRange, dataSource])

  // Generate mock data if not provided
  const mockOHLCData = useMemo(() => generateMockOHLCData(100, 2000, 0.02), [])
  const mockLineData = useMemo(() => generateMockPricePoints(100, 2000, 0.02), [])

  // Prepare chart data
  const { chartData, isMockData } = useMemo(() => {
    // Priority: provided data > API data > mock data
    if (data) {
      // Use provided data
      if (chartType === 'candlestick' && 'open' in data[0]) {
        return { chartData: data as OHLCData[], isMockData: false }
      } else if (chartType === 'line' && 'price' in data[0]) {
        return { chartData: data as PricePoint[], isMockData: false }
      }
    }

    if (apiData && apiData.length > 0) {
      return { chartData: apiData, isMockData: false }
    }

    // Use mock data as fallback
    return {
      chartData: chartType === 'candlestick' ? mockOHLCData : mockLineData,
      isMockData: true,
    }
  }, [data, apiData, chartType, mockOHLCData, mockLineData])

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
    if (chartType === 'candlestick') {
      const ohlcData = chartData as OHLCData[]

      // Check if we have data
      if (!ohlcData || ohlcData.length === 0) {
        return {
          title: { text: 'Loading...', left: 10, top: 10 },
          grid: { left: 30, right: 30, bottom: 40, top: 40 },
        }
      }

      // Format data for candlestick chart
      const dates = ohlcData.map(d => new Date(d.timestamp).toLocaleTimeString())
      const values = ohlcData.map(d => [d.open, d.close, d.low, d.high])
      const volumes = ohlcData.map(d => d.volume)

      console.log('Chart values being rendered:', values.slice(0, 3))
      console.log('First value array:', values[0])
      console.log('First ohlcData:', ohlcData[0])

      // Calculate latest price for display
      const latestCandle = ohlcData[ohlcData.length - 1]

      // Validate latest candle has required data
      // Only show "No data available" if we're not loading
      if (!latestCandle || latestCandle.close === undefined || latestCandle.open === undefined) {
        return {
          title: {
            text: isLoading ? '' : 'No data available',
            left: 10,
            top: 10,
            textStyle: {
              color: '#737373',
              fontSize: 14,
            }
          },
          grid: { left: 30, right: 30, bottom: 40, top: 40 },
        }
      }

      const latestPrice = latestCandle.close
      const priceChange = latestCandle.close - latestCandle.open
      const priceChangePercent = (priceChange / latestCandle.open) * 100

      return {
        title: {
          text: `$${formatPrice(latestPrice)}  {percent|${priceChange >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%}`,
          left: 10,
          top: 10,
          textStyle: {
            color: '#E5E5E5',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'monospace',
            rich: {
              percent: {
                color: priceChange >= 0 ? '#10B981' : '#EF4444',
                fontWeight: 600,
                fontFamily: 'monospace',
              },
            },
          },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
          },
          formatter: (params: any) => {
            const data = params[0]
            if (!data) return ''

            // ECharts adds the category index as the first element
            // So data.data is [categoryIndex, open, close, low, high]
            const [, open, close, low, high] = data.data
            const volume = volumes[data.dataIndex]

            return `
              <div style="font-family: monospace; font-size: 12px;">
                <div style="font-weight: bold; margin-bottom: 4px;">${dates[data.dataIndex]}</div>
                <div>Open: $${formatPrice(open)}</div>
                <div>Close: $${formatPrice(close)}</div>
                <div>High: $${formatPrice(high)}</div>
                <div>Low: $${formatPrice(low)}</div>
                <div>Volume: ${(volume / 1e6).toFixed(2)}M</div>
              </div>
            `
          },
        },
        grid: {
          left: 30,
          right: 30,
          bottom: 40,
          top: 50,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: dates,
          scale: true,
          boundaryGap: true,
          axisLine: { onZero: false },
          splitLine: { show: false },
        },
        yAxis: {
          scale: true,
          splitArea: {
            show: true,
          },
          axisLabel: {
            formatter: (value: number) => `$${formatPrice(value)}`,
          },
        },
        dataZoom: [
          {
            type: 'inside',
            start: 50,
            end: 100,
          },
          {
            show: true,
            type: 'slider',
            bottom: '5%',
            start: 50,
            end: 100,
          },
        ],
        series: [
          {
            name: displaySymbol || symbol,
            type: 'candlestick',
            data: values,
            itemStyle: {
              color: '#10B981', // Green for up (close > open)
              color0: '#EF4444', // Red for down (close < open)
              borderColor: '#10B981',
              borderColor0: '#EF4444',
            },
            emphasis: {
              itemStyle: {
                color: '#10B981',
                color0: '#EF4444',
                borderColor: '#10B981',
                borderColor0: '#EF4444',
              },
            },
          },
        ],
      }
    } else {
      // Line chart
      const lineData = chartData as PricePoint[]

      // Check if we have data
      if (!lineData || lineData.length === 0) {
        return {
          title: { text: 'Loading...', left: 10, top: 10 },
          grid: { left: 30, right: 30, bottom: 40, top: 40 },
        }
      }

      const dates = lineData.map(d => new Date(d.timestamp).toLocaleTimeString())
      const prices = lineData.map(d => d.price).filter(p => p !== undefined && p !== null && !isNaN(p))

      // Check if we have valid price data
      // Only show "No data available" if we're not loading
      if (prices.length === 0) {
        return {
          title: {
            text: isLoading ? '' : 'No data available',
            left: 10,
            top: 10,
            textStyle: {
              color: '#737373',
              fontSize: 14,
            }
          },
          grid: { left: 30, right: 30, bottom: 40, top: 40 },
        }
      }

      // Calculate latest price for display
      const latestPrice = prices[prices.length - 1]
      const firstPrice = prices[0]
      const priceChange = latestPrice - firstPrice
      const priceChangePercent = (priceChange / firstPrice) * 100

      return {
        title: {
          text: `$${formatPrice(latestPrice)}  {percent|${priceChange >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%}`,
          left: 10,
          top: 10,
          textStyle: {
            color: '#E5E5E5',
            fontSize: 14,
            fontWeight: 600,
            fontFamily: 'monospace',
            rich: {
              percent: {
                color: priceChange >= 0 ? '#10B981' : '#EF4444',
                fontWeight: 600,
                fontFamily: 'monospace',
              },
            },
          },
        },
        tooltip: {
          trigger: 'axis',
          axisPointer: {
            type: 'cross',
          },
          formatter: (params: any) => {
            const data = params[0]
            if (!data) return ''

            return `
              <div style="font-family: monospace; font-size: 12px;">
                <div style="font-weight: bold; margin-bottom: 4px;">${dates[data.dataIndex]}</div>
                <div>Price: $${formatPrice(data.value)}</div>
              </div>
            `
          },
        },
        grid: {
          left: 30,
          right: 30,
          bottom: 40,
          top: 50,
          containLabel: true,
        },
        xAxis: {
          type: 'category',
          data: dates,
          boundaryGap: false,
        },
        yAxis: {
          type: 'value',
          scale: true,
          axisLabel: {
            formatter: (value: number) => `$${formatPrice(value)}`,
          },
        },
        dataZoom: [
          {
            type: 'inside',
            start: 50,
            end: 100,
          },
          {
            show: true,
            type: 'slider',
            bottom: '5%',
            start: 50,
            end: 100,
          },
        ],
        series: [
          {
            name: displaySymbol || symbol,
            type: 'line',
            data: prices,
            smooth: true,
            symbol: 'none',
            lineStyle: {
              color: '#3B82F6',
              width: 2,
            },
            areaStyle: {
              color: {
                type: 'linear',
                x: 0,
                y: 0,
                x2: 0,
                y2: 1,
                colorStops: [
                  {
                    offset: 0,
                    color: 'rgba(59, 130, 246, 0.3)',
                  },
                  {
                    offset: 1,
                    color: 'rgba(59, 130, 246, 0)',
                  },
                ],
              },
            },
          },
        ],
      }
    }
  }, [chartType, chartData, symbol, timeRange, isLoading])

  return (
    <div className={`relative ${className}`}>
      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141414]/80 z-20 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#404040] border-t-[#3B82F6] rounded-full animate-spin" />
            <span className="text-sm text-[#737373]">Loading chart data...</span>
          </div>
        </div>
      )}

      {/* Chart controls - top right */}
      <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
        {/* Auto-refresh toggle */}
        <button
          onClick={() => setAutoRefresh(prev => !prev)}
          title={autoRefresh ? 'Disable auto-refresh' : 'Enable auto-refresh'}
          className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors flex items-center gap-1 ${
            autoRefresh
              ? 'bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30'
              : 'bg-[#262626] text-[#737373] hover:text-[#E5E5E5]'
          }`}
        >
          <span className={`inline-block w-1.5 h-1.5 rounded-full ${autoRefresh ? 'bg-[#10B981] animate-pulse' : 'bg-[#404040]'}`} />
          Live
        </button>
        {/* Chart type toggle */}
        <div className="flex gap-0.5 rounded bg-[#262626] p-0.5">
          <button
            onClick={() => setChartType('candlestick')}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              chartType === 'candlestick'
                ? 'bg-[#404040] text-[#E5E5E5]'
                : 'text-[#737373] hover:text-[#E5E5E5]'
            }`}
          >
            Candle
          </button>
          <button
            onClick={() => setChartType('line')}
            className={`px-1.5 py-0.5 text-[10px] font-medium rounded transition-colors ${
              chartType === 'line'
                ? 'bg-[#404040] text-[#E5E5E5]'
                : 'text-[#737373] hover:text-[#E5E5E5]'
            }`}
          >
            Line
          </button>
        </div>
      </div>

      {/* Bottom status bar */}
      <div className="absolute bottom-2 left-2 right-2 z-10 flex items-center justify-between pointer-events-none">
        {/* Mock data indicator (left) */}
        {(isMockData || dataSource === 'Mock') && !isLoading ? (
          <div className="px-1.5 py-0.5 rounded bg-[#F59E0B]/15 border border-[#F59E0B]/30">
            <span className="text-[10px] font-medium text-[#F59E0B]">MOCK DATA</span>
          </div>
        ) : <div />}
        {/* Last updated timestamp (right) */}
        {lastRefresh && !isLoading && !isMockData && (
          <div className="px-1.5 py-0.5 rounded bg-[#262626]/80">
            <span className="text-[9px] text-[#737373]">
              Updated {new Date(lastRefresh).toLocaleTimeString()}
            </span>
          </div>
        )}
      </div>

      <BaseChart option={option} height={height} resizeKey={resizeKey} />
    </div>
  )
}

export interface PriceChartDropdownProps {
  timeRange: TimeRange
  dataSource: DataSource
  onTimeRangeChange: (range: TimeRange) => void
  onDataSourceChange: (source: DataSource) => void
  showDropdown: boolean
  onToggleDropdown: () => void
}

export function PriceChartDropdown({
  timeRange,
  dataSource,
  onTimeRangeChange,
  onDataSourceChange,
  showDropdown,
  onToggleDropdown,
}: PriceChartDropdownProps) {
  const timeRanges: TimeRange[] = ['1m', '5m', '15m', '1h', '4h', '12h', '24h', '1w', '1M', '1Y', 'ALL']
  const dataSources: DataSource[] = ['1inch', 'CoinGecko', 'Coinbase', 'Kraken', 'Mock']
  const availableSources: Set<DataSource> = new Set(['1inch', 'CoinGecko', 'Mock'])
  const dropdownRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onToggleDropdown()
      }
    }

    if (showDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showDropdown, onToggleDropdown])

  if (!showDropdown) return null

  return (
    <div
      ref={dropdownRef}
      className="absolute right-0 top-full mt-1 bg-[#1a1a1a] border border-[#262626] rounded-md shadow-lg z-50 p-2.5 min-w-[200px]"
    >
      {/* Time Range Section */}
      <div className="mb-2.5">
        <div className="text-[11px] text-[#737373] font-medium mb-1.5">Time Range</div>
        <div className="grid grid-cols-4 gap-1">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => {
                onTimeRangeChange(range)
              }}
              className={`px-2 py-1 text-[11px] font-medium rounded transition-colors ${
                timeRange === range
                  ? 'bg-[#404040] text-[#E5E5E5]'
                  : 'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#262626]'
              }`}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px bg-[#262626] mb-2.5" />

      {/* Data Source Section */}
      <div>
        <div className="text-[11px] text-[#737373] font-medium mb-1.5">Data Source</div>
        <div className="flex flex-col gap-1">
          {dataSources.map((source) => {
            const isAvailable = availableSources.has(source)
            return (
              <button
                key={source}
                onClick={() => {
                  if (isAvailable) onDataSourceChange(source)
                }}
                disabled={!isAvailable}
                className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors text-left ${
                  !isAvailable
                    ? 'text-[#404040] cursor-not-allowed'
                    : dataSource === source
                    ? 'bg-[#404040] text-[#E5E5E5]'
                    : 'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#262626]'
                }`}
                title={!isAvailable ? 'Coming soon' : undefined}
              >
                {source}{!isAvailable && ' (coming soon)'}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
