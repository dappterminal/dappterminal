'use client'

/**
 * Performance metrics component - displays key metrics in a grid
 */

import { useMemo } from 'react'
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

  return (
    <div className={className}>
      {/* Metric cards grid */}
      <div className="grid grid-cols-3 gap-2 p-3">
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
