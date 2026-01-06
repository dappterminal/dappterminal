"use client"

import { useState, useCallback, useEffect } from 'react'
import { Terminal as TerminalIcon, Settings, BookOpen, X, ChevronDown } from "lucide-react"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { CLI } from './cli'
import { CanvasSurface } from './canvas-surface'
import { DraggableWindow } from './draggable-window'
import { PriceChart, PriceChartDropdown } from './charts/price-chart'
import { PerformanceChart } from './charts/performance-chart'
import { NetworkGraph } from './charts/network-graph'
import { PortfolioChart } from './charts/portfolio-chart'
import { Settings as SettingsPage } from './settings'
import type { TimeRange, DataSource } from '@/types/charts'

interface Chart {
  id: string
  type: 'price' | 'performance' | 'network' | 'portfolio'
  symbol?: string // For price charts (can be contract address)
  displayLabel?: string // Display name for the chart (e.g., "WBTC/USDC")
  timeRange?: TimeRange
  dataSource?: DataSource
  chartMode?: 'candlestick' | 'line'
  chainIds?: number[] // For portfolio charts
  walletAddress?: string // For portfolio charts - optional address to view
}

export function AppLayout() {
  const [resizeKey, setResizeKey] = useState(0)
  const [charts, setCharts] = useState<Chart[]>([])
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [currentView, setCurrentView] = useState<'terminal' | 'settings'>('terminal')

  const closeChart = useCallback((chartId: string) => {
    setCharts(prev => prev.filter(chart => chart.id !== chartId))
  }, [])

  const handleAddChart = useCallback((
    chartType: string,
    chartMode?: 'candlestick' | 'line',
    chainIds?: number[],
    walletAddress?: string,
    tokenSymbol?: string,
    tokenName?: string,
    protocol?: string
  ) => {
    // Check if chartType is a contract address (0x followed by 40 hex characters)
    const isContractAddress = /^0x[a-fA-F0-9]{40}$/.test(chartType)

    // Map chart types to symbols or contract addresses
    let symbol = chartType
    let displayLabel = chartType

    // If it's a contract address, use it as the symbol with /USDC
    if (isContractAddress) {
      symbol = `${chartType}/USDC`
      // Use tokenSymbol for display if available, otherwise use truncated address
      if (tokenSymbol) {
        displayLabel = `${tokenSymbol}/USDC`
      } else {
        const truncated = `${chartType.slice(0, 6)}...${chartType.slice(-4)}`
        displayLabel = `${truncated}/USDC`
      }
    } else {
      // For normal symbols, uppercase and append /USDC
      symbol = `${chartType.toUpperCase()}/USDC`
      displayLabel = `${chartType.toUpperCase()}/USDC`
    }

    // For WBTC, use the Ethereum mainnet contract address
    if (chartType.toLowerCase() === 'wbtc') {
      symbol = '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599/USDC'
      displayLabel = 'WBTC/USDC'
    }

    const newChart: Chart = {
      id: `${tokenSymbol || chartType}-${Date.now()}`,
      type: 'price',
      symbol,
      displayLabel,
      timeRange: '24h',
      dataSource: '1inch',
      chartMode: chartMode || 'candlestick',
    }

    // Handle special chart types
    if (chartType === 'performance') {
      newChart.type = 'performance'
      newChart.symbol = undefined
      newChart.displayLabel = undefined
    } else if (chartType === 'network' || chartType === 'network-graph') {
      newChart.type = 'network'
      newChart.symbol = undefined
      newChart.displayLabel = undefined
    } else if (chartType === 'portfolio') {
      newChart.type = 'portfolio'
      newChart.symbol = undefined
      newChart.displayLabel = undefined
      newChart.chainIds = chainIds || [1] // Default to Ethereum if not specified
      newChart.walletAddress = walletAddress // Optional address to view
    }

    setCharts(prev => [...prev, newChart])
  }, [])

  const updateChartSettings = useCallback((chartId: string, timeRange: TimeRange, dataSource: DataSource) => {
    setCharts(prev => prev.map(chart =>
      chart.id === chartId
        ? { ...chart, timeRange, dataSource }
        : chart
    ))
  }, [])

  // Check if any charts are visible
  const hasVisibleCharts = charts.length > 0

  // Trigger chart resize on viewport changes
  useEffect(() => {
    const handleResize = () => setResizeKey(prev => prev + 1)
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])
  return (
    <div className="flex h-screen flex-col terminal-canvas">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar - hidden on mobile */}
        <aside className="hidden md:flex w-20 flex-col items-center bg-[#141414] py-6 border-r border-[#262626]">
          <div className="p-2 mb-10">
            <span className="text-white text-lg font-semibold" style={{ fontFamily: 'var(--font-fira-code)' }}>dT</span>
          </div>
          <nav className="flex flex-col items-center space-y-8 flex-1">
            {/* Terminal Icon with Tooltip */}
            <div className="relative group">
              <button
                onClick={() => setCurrentView('terminal')}
                className={`block p-2 rounded-lg transition-colors ${
                  currentView === 'terminal' ? 'text-white bg-[#1a1a1a]' : 'text-[#737373] hover:text-white'
                }`}
              >
                <TerminalIcon className="w-6 h-6" />
              </button>
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-[#262626]">
                Terminal
              </div>
            </div>



            
          </nav>

          {/* Bottom Icons */}
          <div className="mt-auto flex flex-col items-center space-y-6">
            {/* Docs Icon with Tooltip */}
            <div className="relative group">
              <a href="https://docs.dappterminal.com" target='_blank' rel="noopener noreferrer" className="text-[#737373] hover:text-white block p-2 rounded-lg transition-colors">
                <BookOpen className="w-6 h-6" />
              </a>
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-[#262626]">
                Docs
              </div>
            </div>

            {/* Settings Icon with Tooltip */}
            <div className="relative group">
              <button
                onClick={() => setCurrentView('settings')}
                className={`block p-2 rounded-lg transition-colors ${
                  currentView === 'settings' ? 'text-white bg-[#1a1a1a]' : 'text-[#737373] hover:text-white'
                }`}
              >
                <Settings className="w-6 h-6" />
              </button>
              <div className="absolute left-full ml-2 px-3 py-1.5 bg-[#1a1a1a] text-white text-sm rounded-md opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 whitespace-nowrap z-50 border border-[#262626]">
                Settings
              </div>
            </div>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header - responsive height and padding */}
          <header className="flex items-center justify-between h-16 md:h-20 px-4 md:px-8 border-b border-[#262626] flex-shrink-0">
            <div className="flex items-center space-x-8 text-base">
              <span className="text-white text-lg md:text-xl font-semibold tracking-tight">dappTerminal.</span>
            </div>
            <div className="flex items-center space-x-2 md:space-x-4">
              <ConnectButton.Custom>
                {({
                  account,
                  chain,
                  openAccountModal,
                  openChainModal,
                  openConnectModal,
                  mounted,
                }) => {
                  const ready = mounted
                  const connected = ready && account && chain

                  return (
                    <div
                      {...(!ready && {
                        'aria-hidden': true,
                        style: {
                          opacity: 0,
                          pointerEvents: 'none',
                          userSelect: 'none',
                        },
                      })}
                    >
                      {(() => {
                        if (!connected) {
                          return (
                            <button
                              onClick={openConnectModal}
                              className="bg-[#141414] border border-[#262626] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#262626] transition-colors"
                            >
                              Connect Wallet
                            </button>
                          )
                        }

                        if (chain.unsupported) {
                          return (
                            <button
                              onClick={openChainModal}
                              className="bg-[#141414] border border-red-500/50 text-red-400 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-500/10 transition-colors"
                            >
                              Wrong network
                            </button>
                          )
                        }

                        return (
                          <div className="flex items-center gap-2">
                            <button
                              onClick={openChainModal}
                              className="bg-[#141414] border border-[#262626] text-white px-3 py-2 rounded-lg text-sm font-medium hover:bg-[#262626] transition-colors flex items-center gap-2"
                            >
                              {chain.hasIcon && (
                                <div
                                  style={{
                                    background: chain.iconBackground,
                                    width: 16,
                                    height: 16,
                                    borderRadius: 999,
                                    overflow: 'hidden',
                                  }}
                                >
                                  {chain.iconUrl && (
                                    <img
                                      alt={chain.name ?? 'Chain icon'}
                                      src={chain.iconUrl}
                                      style={{ width: 16, height: 16 }}
                                    />
                                  )}
                                </div>
                              )}
                              {chain.name}
                            </button>

                            <button
                              onClick={openAccountModal}
                              className="bg-[#141414] border border-[#262626] text-white px-3 md:px-4 py-2 rounded-lg text-xs md:text-sm font-medium hover:bg-[#262626] transition-colors"
                            >
                              {account.displayName}
                              {account.displayBalance && (
                                <span className="ml-2 text-[#737373] hidden md:inline">
                                  {account.displayBalance}
                                </span>
                              )}
                            </button>
                          </div>
                        )
                      })()}
                    </div>
                  )
                }}
              </ConnectButton.Custom>
            </div>
          </header>

          {/* Content Area - Show Settings page or Terminal + Charts */}
          {currentView === 'settings' ? (
            <div className="flex-1 overflow-hidden">
              <SettingsPage onBack={() => setCurrentView('terminal')} />
            </div>
          ) : (
            <div className="flex-1 overflow-hidden">
              <CanvasSurface>
                {({ scale }) => (
                  <>
                  <DraggableWindow
                    id="cli"
                    scale={scale}
                    defaultPosition={{ x: 96, y: 96 }}
                    defaultSize={{ width: 900, height: 560 }}
                    minSize={{ width: 640, height: 420 }}
                    showChrome={false}
                  >
                    <CLI isFullWidth={!hasVisibleCharts} onAddChart={handleAddChart} />
                  </DraggableWindow>
                  {charts.map((chart, index) => {
                    const baseX = 160 + index * 60
                    const baseY = 140 + index * 60
                    const windowId = `chart-${chart.id}`

                    if (chart.type === 'price') {
                      return (
                        <DraggableWindow
                          key={chart.id}
                          id={windowId}
                          scale={scale}
                          defaultPosition={{ x: baseX, y: baseY }}
                          defaultSize={{ width: 520, height: 360 }}
                          minSize={{ width: 420, height: 320 }}
                          showChrome={false}
                        >
                          <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-visible min-w-0 h-full flex flex-col">
                            <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2.5 flex items-center justify-between relative">
                              <span className="text-base font-semibold text-white">{chart.displayLabel || chart.symbol}</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => setOpenDropdown(openDropdown === chart.id ? null : chart.id)}
                                  className="text-[#737373] hover:text-white transition-colors"
                                  data-no-drag
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => closeChart(chart.id)}
                                  className="text-[#737373] hover:text-red-400 transition-colors"
                                  data-no-drag
                                >
                                  <X className="w-4 h-4" />
                                </button>
                                <PriceChartDropdown
                                  timeRange={chart.timeRange || '24h'}
                                  dataSource={chart.dataSource || 'Mock'}
                                  onTimeRangeChange={(range) => updateChartSettings(chart.id, range, chart.dataSource || 'Mock')}
                                  onDataSourceChange={(source) => updateChartSettings(chart.id, chart.timeRange || '24h', source)}
                                  showDropdown={openDropdown === chart.id}
                                  onToggleDropdown={() => setOpenDropdown(null)}
                                />
                              </div>
                            </div>
                            <PriceChart
                              symbol={chart.symbol}
                              displaySymbol={chart.displayLabel}
                              timeRange={chart.timeRange}
                              dataSource={chart.dataSource}
                              chartType={chart.chartMode}
                              height="100%"
                              className="p-1 flex-1 min-h-0"
                              resizeKey={resizeKey}
                            />
                          </div>
                        </DraggableWindow>
                      )
                    }

                    if (chart.type === 'performance') {
                      return (
                        <DraggableWindow
                          key={chart.id}
                          id={windowId}
                          scale={scale}
                          defaultPosition={{ x: baseX, y: baseY }}
                          defaultSize={{ width: 520, height: 340 }}
                          minSize={{ width: 420, height: 320 }}
                          showChrome={false}
                        >
                          <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-visible min-w-0 h-full flex flex-col">
                            <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2.5 flex items-center justify-between">
                              <span className="text-base font-semibold text-white">Performance</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => closeChart(chart.id)}
                                  className="text-[#737373] hover:text-red-400 transition-colors"
                                  data-no-drag
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <PerformanceChart
                              title=""
                              className="flex-1 min-h-0 p-2 overflow-auto"
                              resizeKey={resizeKey}
                            />
                          </div>
                        </DraggableWindow>
                      )
                    }

                    if (chart.type === 'network') {
                      return (
                        <DraggableWindow
                          key={chart.id}
                          id={windowId}
                          scale={scale}
                          defaultPosition={{ x: baseX, y: baseY }}
                          defaultSize={{ width: 560, height: 420 }}
                          minSize={{ width: 460, height: 360 }}
                          showChrome={false}
                        >
                          <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-visible min-w-0 h-full flex flex-col">
                            <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2.5 flex items-center justify-between">
                              <span className="text-base font-semibold text-white">Network</span>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => closeChart(chart.id)}
                                  className="text-[#737373] hover:text-red-400 transition-colors"
                                  data-no-drag
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <NetworkGraph
                              title=""
                              height="100%"
                              className="flex-1 min-h-0 p-2"
                              resizeKey={resizeKey}
                            />
                          </div>
                        </DraggableWindow>
                      )
                    }

                    if (chart.type === 'portfolio') {
                      return (
                        <DraggableWindow
                          key={chart.id}
                          id={windowId}
                          scale={scale}
                          defaultPosition={{ x: baseX, y: baseY }}
                          defaultSize={{ width: 560, height: 420 }}
                          minSize={{ width: 460, height: 360 }}
                          showChrome={false}
                        >
                          <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-visible min-w-0 h-full flex flex-col">
                            <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2.5 flex items-center justify-between">
                              <span className="text-base font-semibold text-white">Portfolio</span>
                              <div className="flex items-center gap-2">
                                <button
                                  className="text-[#737373] hover:text-white transition-colors"
                                  data-no-drag
                                >
                                  <ChevronDown className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => closeChart(chart.id)}
                                  className="text-[#737373] hover:text-red-400 transition-colors"
                                  data-no-drag
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                            <PortfolioChart
                              chainIds={chart.chainIds}
                              walletAddress={chart.walletAddress}
                              height="100%"
                              className="p-2"
                              resizeKey={resizeKey}
                            />
                          </div>
                        </DraggableWindow>
                      )
                    }

                    return null
                  })}
                  </>
                )}
              </CanvasSurface>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
