'use client'

/**
 * Network graph component for visualizing protocol/chain/token relationships
 */

import { useMemo } from 'react'
import type { EChartsOption } from 'echarts'
import { BaseChart } from './base-chart'
import type { NetworkGraphData } from '@/types/charts'
import { generateMockNetworkGraph } from '@/lib/charts'

export interface NetworkGraphProps {
  data?: NetworkGraphData
  height?: number | string
  className?: string
  title?: string
  resizeKey?: number
}

export function NetworkGraph({
  data,
  height = 400,
  className = '',
  title = 'Protocol Network',
  resizeKey,
}: NetworkGraphProps) {
  // Generate mock data if not provided
  const isMockData = !data
  const graphData = useMemo(() => data || generateMockNetworkGraph(), [data])

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
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
        formatter: (params: any) => {
          if (params.dataType === 'node') {
            const node = params.data
            return `
              <div style="font-family: monospace; font-size: 12px;">
                <div style="font-weight: bold; margin-bottom: 4px;">${node.name}</div>
                <div>Type: ${node.type}</div>
                ${node.value ? `<div>Value: ${node.value}</div>` : ''}
              </div>
            `
          } else if (params.dataType === 'edge') {
            const link = params.data
            return `
              <div style="font-family: monospace; font-size: 12px;">
                <div style="font-weight: bold; margin-bottom: 4px;">Connection</div>
                <div>From: ${link.source}</div>
                <div>To: ${link.target}</div>
                ${link.value ? `<div>Strength: ${link.value}</div>` : ''}
                ${link.label ? `<div>Type: ${link.label}</div>` : ''}
              </div>
            `
          }
          return ''
        },
      },
      legend: [
        {
          data: graphData.categories?.map(c => c.name) || [],
          orient: 'vertical',
          left: 'right',
          top: 'center',
          textStyle: {
            color: '#E5E5E5',
          },
        },
      ],
      series: [
        {
          name: 'Network',
          type: 'graph',
          layout: 'force',
          data: graphData.nodes.map(node => ({
            id: node.id,
            name: node.name,
            value: node.value,
            category: node.category,
            symbolSize: Math.sqrt(node.value || 50) * 2,
            itemStyle: {
              color: node.color,
            },
          })),
          links: graphData.links.map(link => ({
            source: link.source,
            target: link.target,
            value: link.value,
            label: {
              show: false,
              formatter: link.label || '',
            },
            lineStyle: {
              width: link.value ? Math.sqrt(link.value) / 5 : 1,
              opacity: 0.6,
            },
          })),
          categories: graphData.categories,
          roam: true,
          label: {
            show: true,
            position: 'right',
            formatter: '{b}',
            fontSize: 10,
          },
          labelLayout: {
            hideOverlap: true,
          },
          force: {
            repulsion: 150,
            gravity: 0.1,
            edgeLength: [50, 100],
            layoutAnimation: true,
          },
          emphasis: {
            focus: 'adjacency',
            label: {
              show: true,
              fontSize: 12,
            },
            lineStyle: {
              width: 3,
            },
          },
        },
      ],
    }
  }, [graphData, title])

  return (
    <div className={`relative flex min-h-0 flex-col ${className}`}>
      {/* Mock data indicator */}
      {isMockData && (
        <div className="absolute top-1 right-1 z-10 px-1.5 py-0.5 rounded bg-[#F59E0B]/15 border border-[#F59E0B]/30">
          <span className="text-[10px] font-medium text-[#F59E0B]">MOCK DATA</span>
        </div>
      )}
      <BaseChart option={option} height={height} className="flex-1 min-h-0" resizeKey={resizeKey} />

      {/* Legend info */}
      <div className="mt-2 flex flex-shrink-0 gap-4 px-2 text-xs text-[#737373]">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#3B82F6]" />
          <span>Protocol</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#10B981]" />
          <span>Chain</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full bg-[#F59E0B]" />
          <span>Token</span>
        </div>
      </div>
    </div>
  )
}
