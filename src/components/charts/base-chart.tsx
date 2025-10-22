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
  resizeKey?: number
}

export function BaseChart({ option, height = 400, className = '', onChartReady, resizeKey }: BaseChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)

  const enforceFillDimensions = () => {
    if (chartRef.current) {
      chartRef.current.style.width = '100%'
      chartRef.current.style.height = '100%'
    }
  }

  // Initialize chart once
  useEffect(() => {
    if (!chartRef.current) return

    // Initialize chart
    const chart = echarts.init(chartRef.current, 'dark', {
      renderer: 'canvas',
    })
    enforceFillDimensions()

    chartInstanceRef.current = chart

    // Call ready callback
    if (onChartReady) {
      onChartReady(chart)
    }

    // Handle resize
    const handleResize = () => {
      enforceFillDimensions()
      chart.resize()
    }

    window.addEventListener('resize', handleResize)

    // Use ResizeObserver to detect container size changes
    const resizeObserver = new ResizeObserver(() => {
      if (!chart || chart.isDisposed()) {
        return
      }

      enforceFillDimensions()
      chart.resize()
    })

    // Observe the outer container rather than the chart DOM,
    // so flexbox size changes (both grow and shrink) are captured.
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    // Cleanup
    return () => {
      window.removeEventListener('resize', handleResize)
      resizeObserver.disconnect()
      chart.dispose()
      chartInstanceRef.current = null
    }
  }, [onChartReady])

  // Set initial option and update when it changes
  useEffect(() => {
    if (chartInstanceRef.current) {
      const mergedOption: EChartsOption = {
        ...darkTheme,
        ...option,
      }
      chartInstanceRef.current.setOption(mergedOption, { notMerge: true })
      // Trigger resize after setting option to ensure proper fit
      enforceFillDimensions()
      chartInstanceRef.current.resize()
    }
  }, [option])

  // Handle resize key changes from parent
  useEffect(() => {
    if (resizeKey !== undefined && chartInstanceRef.current) {
      // Wait for layout to complete before reading dimensions
      // Use double RAF to ensure layout and paint are done
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (chartInstanceRef.current) {
            enforceFillDimensions()
            chartInstanceRef.current.resize()
          }
        })
      })
    }
  }, [resizeKey])

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: `${height}px`,
        minWidth: 0,
        boxSizing: 'border-box',
        backgroundColor: '#141414',
        overflow: 'hidden',
      }}
    >
      <div
        ref={chartRef}
        style={{
          width: '100%',
          height: '100%',
          minWidth: 0,
          minHeight: 0,
        }}
      />
    </div>
  )
}
