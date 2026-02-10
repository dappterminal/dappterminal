'use client'

/**
 * Charts panel component - displays multiple charts in a vertical layout
 * Takes up ~30% of screen width on the right side
 */

import { useState, useEffect } from 'react'
import { Settings, X } from 'lucide-react'
import { PriceChart } from './charts/price-chart'
import { PerformanceChart } from './charts/performance-chart'
import { NetworkGraph } from './charts/network-graph'

interface AnalyticsProps {
  panelWidth?: number
}

export function Analytics({ panelWidth }: AnalyticsProps) {
  const [showSettings, setShowSettings] = useState(false)
  const [visibleCharts, setVisibleCharts] = useState({
    btc: true,
    eth: true,
    sol: true,
    performance: true,
    network: true,
  })
  const [resizeKey, setResizeKey] = useState(0)

  // Trigger chart resize when panel width changes
  useEffect(() => {
    if (panelWidth !== undefined) {
      setResizeKey(prev => prev + 1)
    }
  }, [panelWidth])

  const closeChart = (chartId: keyof typeof visibleCharts) => {
    setVisibleCharts(prev => ({ ...prev, [chartId]: false }))
  }

  return (
    <div className="h-full bg-[#0A0A0A] p-4 pl-2 pr-2 flex flex-col relative overflow-hidden min-w-0 w-full">
      <div className="h-full bg-[#141414] rounded-xl border border-[#262626] flex flex-col overflow-hidden">
        {/* Tab bar matching terminal style */}
        <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center gap-2 rounded-t-xl flex-shrink-0">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-[#262626]">
            <span className="text-sm text-white">analytics</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-1.5 text-[#737373] hover:text-white transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Charts Content - scrollable */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#0A0A0A] [&::-webkit-scrollbar-thumb]:bg-[#404040] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-[#525252]">
          {/* BTC Price Chart Window */}
          {visibleCharts.btc && (
            <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-hidden min-w-0">
              <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-white">BTC/USD</span>
                <button
                  onClick={() => closeChart('btc')}
                  className="text-[#737373] hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <PriceChart
                symbol="BTC/USD"
                timeRange="24h"
                height={280}
                className="p-1"
                resizeKey={resizeKey}
              />
            </div>
          )}

          {/* ETH Price Chart Window */}
          {visibleCharts.eth && (
            <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-hidden min-w-0">
              <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-white">ETH/USD</span>
                <button
                  onClick={() => closeChart('eth')}
                  className="text-[#737373] hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <PriceChart
                symbol="ETH/USD"
                timeRange="24h"
                height={280}
                className="p-1"
                resizeKey={resizeKey}
              />
            </div>
          )}

          {/* SOL Price Chart Window */}
          {visibleCharts.sol && (
            <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-hidden min-w-0">
              <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center justify-between">
                <span className="text-sm text-white">SOL/USD</span>
                <button
                  onClick={() => closeChart('sol')}
                  className="text-[#737373] hover:text-red-400 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
              <PriceChart
                symbol="SOL/USD"
                timeRange="24h"
                height={280}
                className="p-1"
                resizeKey={resizeKey}
              />
            </div>
          )}

          {/* Performance Metrics Window */}
          {visibleCharts.performance && (
            <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-hidden min-w-0">
              <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2.5 flex items-center justify-between">
                <span className="text-base font-semibold text-white">Performance</span>
                <button
                  onClick={() => closeChart('performance')}
                  className="text-[#737373] hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <PerformanceChart
                title=""
                height={250}
                className="p-2"
                resizeKey={resizeKey}
              />
            </div>
          )}

          {/* Network Graph Window */}
          {visibleCharts.network && (
            <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-hidden min-w-0">
              <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2.5 flex items-center justify-between">
                <span className="text-base font-semibold text-white">Network</span>
                <button
                  onClick={() => closeChart('network')}
                  className="text-[#737373] hover:text-red-400 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <NetworkGraph
                title=""
                height={300}
                className="p-2"
                resizeKey={resizeKey}
              />
            </div>
          )}

          {/* Footer info */}
          <div className="text-xs text-[#737373] text-center pb-2">
            Network graph uses sample data
          </div>
        </div>
      </div>
    </div>
  )
}
