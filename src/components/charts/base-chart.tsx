'use client'

/**
 * Base chart component wrapping ECharts with dark theme
 */

import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { darkTheme } from '@/lib/charts'

export interface BaseChartProps {
  option: EChartsOption
  height?: number
  className?: string
  onChartReady?: (chart: echarts.ECharts) => void
}

export function BaseChart({ option, height = 400, className = '', onChartReady }: BaseChartProps) {
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return

    // Initialize chart
    const chart = echarts.init(chartRef.current, 'dark', {
      renderer: 'canvas',
    })

    chartInstanceRef.current = chart

    // Apply theme and options
    const mergedOption: EChartsOption = {
      ...darkTheme,
      ...option,
    }

    chart.setOption(mergedOption)

    // Call ready callback
    if (onChartReady) {
      onChartReady(chart)
    }

    // Handle resize
    const handleResize = () => {
      chart.resize()
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      chart.dispose()
      chartInstanceRef.current = null
    }
  }, [option, onChartReady])

  // Update chart when option changes
  useEffect(() => {
    if (chartInstanceRef.current) {
      const mergedOption: EChartsOption = {
        ...darkTheme,
        ...option,
      }
      chartInstanceRef.current.setOption(mergedOption, { notMerge: true })
    }
  }, [option])

  return (
    <div
      ref={chartRef}
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        backgroundColor: '#141414',
      }}
    />
  )
}
