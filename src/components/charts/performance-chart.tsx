'use client'

/**
 * Performance metrics component - fetches real platform stats from the
 * analytics API and displays them in a grid.  Falls back to a "no data"
 * state (not mock data) when the API is unreachable.
 */

import { useState, useEffect, useCallback } from 'react'
import type { PerformanceMetric } from '@/types/charts'
import { formatChange } from '@/lib/charts'
import { RefreshCw } from 'lucide-react'

export interface PerformanceChartProps {
  data?: PerformanceMetric[]
  height?: number
  className?: string
  title?: string
  resizeKey?: number
}

/** Format a number with abbreviations — supports both $ values and plain counts */
function formatMetricValue(value: number, prefix = ''): string {
  if (value >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`
  if (value >= 1e6) return `${prefix}${(value / 1e6).toFixed(2)}M`
  if (value >= 1e3) return `${prefix}${(value / 1e3).toFixed(1)}K`
  return `${prefix}${value.toLocaleString()}`
}

interface GlobalStats {
  totalTransactions: number
  totalUsers: number
  recentActivity: number // last 24h tx count
}

interface ProtocolVolumeTotals {
  totalTransactions: number
  successfulTxs: number
  failedTxs: number
  uniqueUsers: number
}

export function PerformanceChart({
  data: dataProp,
  height: _height = 300,
  className = '',
  title: _title = 'Performance Metrics',
  resizeKey: _resizeKey,
}: PerformanceChartProps) {
  const [metrics, setMetrics] = useState<PerformanceMetric[] | null>(dataProp || null)
  const [isLoading, setIsLoading] = useState(!dataProp)
  const [error, setError] = useState<string | null>(null)

  const fetchStats = useCallback(async () => {
    // If the parent provided data, use that instead
    if (dataProp) {
      setMetrics(dataProp)
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      // Fetch global stats and protocol volume in parallel
      const [globalRes, volumeRes] = await Promise.all([
        fetch('/api/analytics/global-stats'),
        fetch('/api/analytics/protocol-volume'),
      ])

      // Parse global stats
      let globalStats: GlobalStats = { totalTransactions: 0, totalUsers: 0, recentActivity: 0 }
      if (globalRes.ok) {
        const globalJson = await globalRes.json()
        if (globalJson.success && globalJson.data) {
          globalStats = globalJson.data
        }
      }

      // Parse protocol volume totals
      let volumeTotals: ProtocolVolumeTotals = {
        totalTransactions: 0,
        successfulTxs: 0,
        failedTxs: 0,
        uniqueUsers: 0,
      }
      if (volumeRes.ok) {
        const volumeJson = await volumeRes.json()
        if (volumeJson.success && volumeJson.data?.totals) {
          volumeTotals = volumeJson.data.totals
        }
      }

      // Calculate success rate
      const successRate = volumeTotals.totalTransactions > 0
        ? (volumeTotals.successfulTxs / volumeTotals.totalTransactions) * 100
        : 0

      // Build metrics from real data
      const realMetrics: PerformanceMetric[] = [
        {
          label: 'Total Transactions',
          value: globalStats.totalTransactions,
          color: '#3B82F6',
        },
        {
          label: 'Transactions (24h)',
          value: globalStats.recentActivity,
          color: '#10B981',
        },
        {
          label: 'Unique Users',
          value: globalStats.totalUsers,
          color: '#8B5CF6',
        },
        {
          label: 'Success Rate',
          value: successRate,
          color: successRate >= 90 ? '#10B981' : successRate >= 70 ? '#F59E0B' : '#EF4444',
        },
        {
          label: 'Successful Txs',
          value: volumeTotals.successfulTxs,
          color: '#10B981',
        },
        {
          label: 'Failed Txs',
          value: volumeTotals.failedTxs,
          color: volumeTotals.failedTxs > 0 ? '#EF4444' : '#737373',
        },
      ]

      setMetrics(realMetrics)
    } catch (err) {
      console.error('[PerformanceChart] Error fetching stats:', err)
      setError('Failed to load stats')
    } finally {
      setIsLoading(false)
    }
  }, [dataProp])

  // Fetch on mount
  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Format value depending on metric type
  const displayValue = (metric: PerformanceMetric): string => {
    if (metric.label === 'Success Rate') {
      return `${metric.value.toFixed(1)}%`
    }
    // Non-dollar metrics (counts)
    return formatMetricValue(metric.value)
  }

  return (
    <div className={`relative ${className}`}>
      {/* Refresh button */}
      <div className="absolute top-1 right-1 z-10">
        <button
          onClick={fetchStats}
          disabled={isLoading}
          className="p-1 text-[#737373] hover:text-[#E5E5E5] transition-colors disabled:opacity-50"
          title="Refresh stats"
        >
          <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Loading state */}
      {isLoading && !metrics && (
        <div className="flex items-center justify-center p-8">
          <div className="flex flex-col items-center gap-2">
            <div className="w-6 h-6 border-2 border-[#404040] border-t-[#3B82F6] rounded-full animate-spin" />
            <span className="text-xs text-[#737373]">Loading stats...</span>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && !metrics && (
        <div className="flex items-center justify-center p-8">
          <div className="text-center">
            <div className="text-xs text-[#EF4444] mb-1">{error}</div>
            <button onClick={fetchStats} className="text-xs text-[#737373] hover:text-[#E5E5E5] underline">
              Retry
            </button>
          </div>
        </div>
      )}

      {/* Metric cards grid */}
      {metrics && (
        <div className="grid grid-cols-3 gap-2 p-3">
          {metrics.map((metric, index) => (
            <div
              key={index}
              className="rounded-lg bg-[#262626] p-3 border border-[#404040]"
            >
              <div className="text-xs text-[#737373] mb-1">{metric.label}</div>
              <div className="text-sm font-medium text-[#E5E5E5]">
                {displayValue(metric)}
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
      )}

      {/* Empty state — no transactions yet */}
      {metrics && metrics.every(m => m.value === 0) && !isLoading && (
        <div className="text-center pb-2">
          <span className="text-[10px] text-[#737373]">No transactions recorded yet</span>
        </div>
      )}
    </div>
  )
}
