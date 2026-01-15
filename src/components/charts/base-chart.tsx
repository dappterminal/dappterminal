'use client'

/**
 * Base chart component wrapping ECharts with dark theme
 */

import { useEffect, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { EChartsOption } from 'echarts'
import { darkTheme } from '@/lib/charts'

export interface BaseChartProps {
  option: EChartsOption
  height?: number | string
  className?: string
  onChartReady?: (chart: echarts.ECharts) => void
  resizeKey?: number
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

const scaleFontSizes = (value: unknown, scale: number): unknown => {
  if (scale === 1) return value
  if (Array.isArray(value)) {
    return value.map(item => scaleFontSizes(item, scale))
  }
  if (!value || typeof value !== 'object') return value

  const entries = Object.entries(value as Record<string, unknown>)
  const result: Record<string, unknown> = {}
  for (const [key, val] of entries) {
    if (key === 'fontSize' && typeof val === 'number') {
      result[key] = Math.max(9, Math.round(val * scale))
      continue
    }
    result[key] = scaleFontSizes(val, scale)
  }
  return result
}

export function BaseChart({ option, height = 400, className = '', onChartReady, resizeKey }: BaseChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<HTMLDivElement>(null)
  const chartInstanceRef = useRef<echarts.ECharts | null>(null)
  const [fontScale, setFontScale] = useState(1)
  const fontScaleRef = useRef(1)

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
    const resizeObserver = new ResizeObserver(entries => {
      if (!chart || chart.isDisposed()) {
        return
      }

      const entry = entries[0]
      if (entry) {
        const { width, height } = entry.contentRect
        const widthScale = width / 520
        const heightScale = height / 320
        const nextScale = clamp(Math.min(widthScale, heightScale), 0.85, 1.35)
        if (Math.abs(nextScale - fontScaleRef.current) > 0.05) {
          fontScaleRef.current = nextScale
          setFontScale(nextScale)
        }
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
      const mergedOption = scaleFontSizes(
        {
          ...darkTheme,
          ...option,
        },
        fontScale
      ) as EChartsOption
      chartInstanceRef.current.setOption(mergedOption, { notMerge: true })
      // Trigger resize after setting option to ensure proper fit
      enforceFillDimensions()
      chartInstanceRef.current.resize()
    }
  }, [option, fontScale])

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
        height: typeof height === 'number' ? `${height}px` : height,
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
