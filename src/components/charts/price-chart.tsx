'use client'

/**
 * Price chart component with candlestick and line chart modes
 */

import { useState, useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import { BaseChart } from './base-chart'
import type { OHLCData, PricePoint, ChartType, TimeRange } from '@/types/charts'
import { generateMockOHLCData, generateMockPricePoints } from '@/lib/charts'

export interface PriceChartProps {
  data?: OHLCData[] | PricePoint[]
  chartType?: ChartType
  timeRange?: TimeRange
  symbol?: string
  height?: number
  className?: string
}

export function PriceChart({
  data,
  chartType: initialChartType = 'candlestick',
  timeRange = '24H',
  symbol = 'ETH/USD',
  height = 400,
  className = '',
}: PriceChartProps) {
  const [chartType, setChartType] = useState<'candlestick' | 'line'>(initialChartType as 'candlestick' | 'line')

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

      return {
        title: {
          text: `${symbol} - ${timeRange}`,
          left: 0,
          textStyle: {
            color: '#E5E5E5',
            fontSize: 14,
            fontWeight: 'normal',
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
          left: '3%',
          right: '3%',
          bottom: '15%',
          top: '15%',
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

      return {
        title: {
          text: `${symbol} - ${timeRange}`,
          left: 0,
          textStyle: {
            color: '#E5E5E5',
            fontSize: 14,
            fontWeight: 'normal',
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
          left: '3%',
          right: '3%',
          bottom: '15%',
          top: '15%',
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

  return (
    <div className={`relative ${className}`}>
      {/* Chart type toggle */}
      <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-lg bg-[#262626] p-1">
        <button
          onClick={() => setChartType('candlestick')}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            chartType === 'candlestick'
              ? 'bg-[#404040] text-[#E5E5E5]'
              : 'text-[#737373] hover:text-[#E5E5E5]'
          }`}
        >
          Candlestick
        </button>
        <button
          onClick={() => setChartType('line')}
          className={`px-3 py-1 text-xs font-medium rounded transition-colors ${
            chartType === 'line'
              ? 'bg-[#404040] text-[#E5E5E5]'
              : 'text-[#737373] hover:text-[#E5E5E5]'
          }`}
        >
          Line
        </button>
      </div>

      <BaseChart option={option} height={height} />
    </div>
  )
}
