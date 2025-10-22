'use client'

/**
 * Charts panel component - displays multiple charts in a vertical layout
 * Takes up ~30% of screen width on the right side
 */

import { PriceChart } from './charts/price-chart'
import { PerformanceChart } from './charts/performance-chart'
import { NetworkGraph } from './charts/network-graph'

export interface ChartsPanelProps {
  className?: string
}

export function ChartsPanel({ className = '' }: ChartsPanelProps) {
  return (
    <div
      className={`flex flex-col gap-4 bg-[#0A0A0A] p-4 overflow-y-auto ${className}`}
      style={{
        height: '100vh',
        borderLeft: '1px solid #262626',
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium text-[#E5E5E5]">Market Analytics</h2>
        <div className="text-xs text-[#737373]">
          {new Date().toLocaleTimeString()}
        </div>
      </div>

      {/* Price Chart - Top 50% */}
      <div className="flex-1 min-h-0 rounded-lg bg-[#141414] border border-[#262626] overflow-hidden">
        <PriceChart
          symbol="ETH/USD"
          timeRange="24H"
          height={400}
          className="p-4"
        />
      </div>

      {/* Performance Metrics - Middle 25% */}
      <div className="flex-shrink-0 rounded-lg bg-[#141414] border border-[#262626] overflow-hidden">
        <PerformanceChart
          title="DeFi Metrics"
          height={250}
          className="p-4"
        />
      </div>

      {/* Network Graph - Bottom 25% */}
      <div className="flex-shrink-0 rounded-lg bg-[#141414] border border-[#262626] overflow-hidden">
        <NetworkGraph
          title="Protocol Network"
          height={300}
          className="p-4"
        />
      </div>

      {/* Footer info */}
      <div className="text-xs text-[#737373] text-center pb-2">
        Mock data • Charts update in real-time with protocol integration
      </div>
    </div>
  )
}
