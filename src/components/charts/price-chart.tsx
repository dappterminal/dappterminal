'use client'

/**
 * Price chart component with candlestick and line chart modes
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import type { EChartsOption } from 'echarts'
import { BaseChart } from './base-chart'
import type { OHLCData, PricePoint, ChartType, TimeRange, DataSource } from '@/types/charts'
import { generateMockOHLCData, generateMockPricePoints } from '@/lib/charts'
import { resolveTokenAddress } from '@/plugins/1inch/tokens'

export interface PriceChartProps {
  data?: OHLCData[] | PricePoint[]
  chartType?: ChartType
  timeRange?: TimeRange
  dataSource?: DataSource
  symbol?: string
  displaySymbol?: string // Display label (e.g., "WBTC/USDC" instead of contract address)
  height?: number
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
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Cache for API data to avoid refetching
  const cacheRef = useRef<Map<string, OHLCData[] | PricePoint[]>>(new Map())

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

  // Fetch data from 1inch API
  useEffect(() => {
    if (dataSource !== '1inch' || data) {
      setApiData(null)
      return
    }

    const fetchChartData = async () => {
      // Create cache key based on chart parameters
      const cacheKey = `${symbol}-${chartType}-${timeRange}-${dataSource}`

      // Check if data is already cached
      const cachedData = cacheRef.current.get(cacheKey)
      if (cachedData) {
        console.log('Using cached chart data for:', cacheKey)
        setApiData(cachedData)
        return
      }

      setIsLoading(true)
      try {
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
      }
    }

    fetchChartData()
  }, [symbol, chartType, timeRange, dataSource, data])

  // Generate mock data if not provided
  const mockOHLCData = useMemo(() => generateMockOHLCData(100, 2000, 0.02), [])
  const mockLineData = useMemo(() => generateMockPricePoints(100, 2000, 0.02), [])

  // Prepare chart data
  const chartData = useMemo(() => {
    // Priority: provided data > API data > mock data
    if (data) {
      // Use provided data
      if (chartType === 'candlestick' && 'open' in data[0]) {
        return data as OHLCData[]
      } else if (chartType === 'line' && 'price' in data[0]) {
        return data as PricePoint[]
      }
    }

    if (apiData && apiData.length > 0) {
      return apiData
    }

    // Use mock data as fallback
    return chartType === 'candlestick' ? mockOHLCData : mockLineData
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
      if (!latestCandle || latestCandle.close === undefined || latestCandle.open === undefined) {
        return {
          title: { text: 'No data available', left: 10, top: 10 },
          grid: { left: 30, right: 30, bottom: 40, top: 40 },
        }
      }

      const latestPrice = latestCandle.close
      const priceChange = latestCandle.close - latestCandle.open
      const priceChangePercent = (priceChange / latestCandle.open) * 100

      return {
        title: {
          text: `$${latestPrice.toFixed(2)}  {percent|${priceChange >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%}`,
          left: 10,
          top: 10,
          textStyle: {
            color: '#E5E5E5',
            fontSize: 14,
            fontWeight: 600,
            rich: {
              percent: {
                color: priceChange >= 0 ? '#10B981' : '#EF4444',
                fontWeight: 600,
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
                <div>Open: $${open.toFixed(2)}</div>
                <div>Close: $${close.toFixed(2)}</div>
                <div>High: $${high.toFixed(2)}</div>
                <div>Low: $${low.toFixed(2)}</div>
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
      if (prices.length === 0) {
        return {
          title: { text: 'No data available', left: 10, top: 10 },
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
          text: `$${latestPrice.toFixed(2)}  {percent|${priceChange >= 0 ? '+' : ''}${priceChangePercent.toFixed(2)}%}`,
          left: 10,
          top: 10,
          textStyle: {
            color: '#E5E5E5',
            fontSize: 14,
            fontWeight: 600,
            rich: {
              percent: {
                color: priceChange >= 0 ? '#10B981' : '#EF4444',
                fontWeight: 600,
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
                <div>Price: $${data.value.toFixed(2)}</div>
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
  }, [chartType, chartData, symbol, timeRange])

  const timeRanges: TimeRange[] = ['1m', '5m', '15m', '1h', '4h', '12h', '24h', '1w', '1M', '1Y', 'ALL']
  const dataSources: DataSource[] = ['1inch', 'Binance', 'Coinbase', 'Kraken', 'Mock']

  return (
    <div className={`relative ${className}`}>
      {/* Chart type toggle - Simple inline controls */}
      <div className="absolute top-2 right-2 z-10 flex gap-0.5 rounded bg-[#262626] p-0.5">
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
  const dataSources: DataSource[] = ['1inch', 'Binance', 'Coinbase', 'Kraken', 'Mock']
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
          {dataSources.map((source) => (
            <button
              key={source}
              onClick={() => {
                onDataSourceChange(source)
              }}
              className={`px-2.5 py-1 text-[11px] font-medium rounded transition-colors text-left ${
                dataSource === source
                  ? 'bg-[#404040] text-[#E5E5E5]'
                  : 'text-[#737373] hover:text-[#E5E5E5] hover:bg-[#262626]'
              }`}
            >
              {source}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
