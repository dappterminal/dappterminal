'use client'

/**
 * Price chart component with candlestick and line chart modes
 */

import { useState, useMemo, useRef, useEffect } from 'react'
import type { EChartsOption } from 'echarts'
import { BaseChart } from './base-chart'
import type { OHLCData, PricePoint, ChartType, TimeRange, DataSource } from '@/types/charts'
import { generateMockOHLCData, generateMockPricePoints } from '@/lib/charts'

export interface PriceChartProps {
  data?: OHLCData[] | PricePoint[]
  chartType?: ChartType
  timeRange?: TimeRange
  dataSource?: DataSource
  symbol?: string
  height?: number
  className?: string
  resizeKey?: number
}

export function PriceChart({
  data,
  chartType: initialChartType = 'candlestick',
  timeRange: initialTimeRange = '24h',
  dataSource: initialDataSource = 'Mock',
  symbol = 'ETH/USD',
  height = 400,
  className = '',
  resizeKey,
}: PriceChartProps) {
  const [chartType, setChartType] = useState<'candlestick' | 'line'>(initialChartType as 'candlestick' | 'line')
  const [timeRange, setTimeRange] = useState<TimeRange>(initialTimeRange)
  const [dataSource, setDataSource] = useState<DataSource>(initialDataSource)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

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

  // Generate mock data if not provided
  const mockOHLCData = useMemo(() => generateMockOHLCData(100, 2000, 0.02), [])
  const mockLineData = useMemo(() => generateMockPricePoints(100, 2000, 0.02), [])

  // Prepare chart data
  const chartData = useMemo(() => {
    if (data) {
      // Use provided data
      if (chartType === 'candlestick' && 'open' in data[0]) {
        return data as OHLCData[]
      } else if (chartType === 'line' && 'price' in data[0]) {
        return data as PricePoint[]
      }
    }

    // Use mock data
    return chartType === 'candlestick' ? mockOHLCData : mockLineData
  }, [data, chartType, mockOHLCData, mockLineData])

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
    if (chartType === 'candlestick') {
      const ohlcData = chartData as OHLCData[]

      // Format data for candlestick chart
      const dates = ohlcData.map(d => new Date(d.timestamp).toLocaleTimeString())
      const values = ohlcData.map(d => [d.open, d.close, d.low, d.high])
      const volumes = ohlcData.map(d => d.volume)

      // Calculate latest price for display
      const latestCandle = ohlcData[ohlcData.length - 1]
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
            fontWeight: '600',
            rich: {
              percent: {
                color: priceChange >= 0 ? '#10B981' : '#EF4444',
                fontWeight: '600',
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

            const [open, close, low, high] = data.data
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
          top: 40,
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
            name: symbol,
            type: 'candlestick',
            data: values,
            itemStyle: {
              color: '#10B981', // Green for up
              color0: '#EF4444', // Red for down
              borderColor: '#10B981',
              borderColor0: '#EF4444',
            },
          },
        ],
      }
    } else {
      // Line chart
      const lineData = chartData as PricePoint[]

      const dates = lineData.map(d => new Date(d.timestamp).toLocaleTimeString())
      const prices = lineData.map(d => d.price)

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
            fontWeight: '600',
            rich: {
              percent: {
                color: priceChange >= 0 ? '#10B981' : '#EF4444',
                fontWeight: '600',
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
          top: 40,
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
            name: symbol,
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
  const dataSources: DataSource[] = ['Binance', 'Coinbase', 'Kraken', 'Mock']

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
  const dataSources: DataSource[] = ['Binance', 'Coinbase', 'Kraken', 'Mock']
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
