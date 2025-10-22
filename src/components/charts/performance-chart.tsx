'use client'

/**
 * Performance metrics chart component
 */

import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import { BaseChart } from './base-chart'
import type { PerformanceMetric } from '@/types/charts'
import { generateMockPerformanceMetrics, formatNumber, formatChange } from '@/lib/charts'

export interface PerformanceChartProps {
  data?: PerformanceMetric[]
  height?: number
  className?: string
  title?: string
  resizeKey?: number
}

export function PerformanceChart({
  data,
  height = 300,
  className = '',
  title = 'Performance Metrics',
  resizeKey,
}: PerformanceChartProps) {
  // Generate mock data if not provided
  const metrics = useMemo(() => data || generateMockPerformanceMetrics(), [data])

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
    const labels = metrics.map(m => m.label)
    const values = metrics.map(m => m.value)
    const changes = metrics.map(m => m.change || 0)

    return {
      title: {
        text: title,
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
          type: 'shadow',
        },
        formatter: (params: any) => {
          const data = params[0]
          if (!data) return ''

          const metric = metrics[data.dataIndex]
          const changeColor = metric.change && metric.change >= 0 ? '#10B981' : '#EF4444'

          return `
            <div style="font-family: monospace; font-size: 12px;">
              <div style="font-weight: bold; margin-bottom: 4px;">${metric.label}</div>
              <div>Value: ${formatNumber(metric.value)}</div>
              ${
                metric.change !== undefined
                  ? `<div style="color: ${changeColor}">Change: ${formatChange(metric.change)}</div>`
                  : ''
              }
            </div>
          `
        },
      },
      grid: {
        left: 30,
        right: 30,
        bottom: 30,
        top: 40,
        containLabel: true,
      },
      xAxis: {
        type: 'category',
        data: labels,
        axisLabel: {
          rotate: 45,
          interval: 0,
        },
      },
      yAxis: {
        type: 'value',
        axisLabel: {
          formatter: (value: number) => {
            if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`
            if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`
            if (value >= 1e3) return `${(value / 1e3).toFixed(1)}K`
            return value.toString()
          },
        },
      },
      series: [
        {
          name: 'Value',
          type: 'bar',
          data: values.map((value, index) => ({
            value,
            itemStyle: {
              color: metrics[index].color || '#3B82F6',
            },
          })),
          barWidth: '60%',
          label: {
            show: false,
          },
        },
      ],
    }
  }, [metrics, title])

  return (
    <div className={className}>
      <BaseChart option={option} height={height} resizeKey={resizeKey} />

      {/* Metric cards below chart */}
      <div className="mt-4 grid grid-cols-3 gap-2 px-2">
        {metrics.map((metric, index) => (
          <div
            key={index}
            className="rounded-lg bg-[#262626] p-3 border border-[#404040]"
          >
            <div className="text-xs text-[#737373] mb-1">{metric.label}</div>
            <div className="text-sm font-medium text-[#E5E5E5]">
              {formatNumber(metric.value)}
            </div>
            {metric.change !== undefined && (
              <div
                className={`text-xs mt-1 ${
                  metric.change >= 0 ? 'text-[#10B981]' : 'text-[#EF4444]'
                }`}
              >
                {formatChange(metric.change)}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
