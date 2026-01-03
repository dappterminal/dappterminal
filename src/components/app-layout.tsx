"use client"

import { useState, useCallback, useEffect } from 'react'
import { Terminal as TerminalIcon, Settings, Zap, BarChart3, BookOpen, X, ChevronDown } from "lucide-react"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount } from 'wagmi'
import { CLI } from './cli'
import { PriceChart, PriceChartDropdown } from './charts/price-chart'
import { PerformanceChart } from './charts/performance-chart'
import { NetworkGraph } from './charts/network-graph'
import { PortfolioChart, getPortfolioDisplayAddress } from './charts/portfolio-chart'
import { Analytics } from './analytics'
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
  const { address } = useAccount()
  const [cliWidth, setCliWidth] = useState(55) // percentage - CLI at 55%, charts at 45%
  const [isDragging, setIsDragging] = useState(false)
  const [resizeKey, setResizeKey] = useState(0)
  const [charts, setCharts] = useState<Chart[]>([])
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [isMobile, setIsMobile] = useState(false)
  const [currentView, setCurrentView] = useState<'terminal' | 'settings'>('terminal')

  const handleMouseDown = useCallback(() => {
    setIsDragging(true)
  }, [])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return

      const container = document.querySelector('.content-container')
      if (!container) return

      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const percentage = (x / rect.width) * 100

      // Clamp between 30% and 70% (ensures charts panel stays at least 30%)
      const newWidth = Math.max(30, Math.min(70, percentage))
      setCliWidth(newWidth)
    },
    [isDragging]
  )

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

  // Check if mobile/stacked layout on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1536) // Stack vertically below 1536px (2xl breakpoint)
    }

    checkMobile()
    window.addEventListener('resize', checkMobile)

    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Trigger resize when cliWidth changes
  useEffect(() => {
    setResizeKey(prev => prev + 1)
  }, [cliWidth])

  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove)
      document.addEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    } else {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [isDragging, handleMouseMove, handleMouseUp])
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
              <img src="/dappterminal-logo-horizontal-white.svg" alt="dappTerminal" className="h-6 md:h-8" />
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
            <div className="flex-1 flex flex-col 2xl:flex-row overflow-hidden content-container">
              {/* CLI - fixed height when stacked with charts, full height when alone, resizable width on large screens */}
              <div
                style={{ width: !isMobile && hasVisibleCharts ? `${cliWidth}%` : undefined }}
                className={`w-full ${
                  hasVisibleCharts
                    ? 'h-[50vh] 2xl:h-full 2xl:flex-1 2xl:flex-initial 2xl:w-auto 2xl:flex-shrink-0'
                    : 'flex-1'
                }`}
              >
                <CLI isFullWidth={!hasVisibleCharts} onAddChart={handleAddChart} />
              </div>

            {/* Resize Handle - only show on large screens if charts are visible */}
            {hasVisibleCharts && (
              <div
                className="hidden 2xl:block w-1 bg-[#0A0A0A] hover:bg-[#404040] cursor-col-resize transition-colors flex-shrink-0"
                onMouseDown={handleMouseDown}
              />
            )}



    
            {/* Charts - remaining width */}
            {/* <div
              className="flex-1 min-w-0"
              style={{ width: `${100 - cliWidth}%` }}
            >
              <Analytics panelWidth={100 - cliWidth} />
            </div> */}

            {/* Charts - auto height when stacked, remaining width on large screens */}
            {hasVisibleCharts && (
              <div
                className="flex-initial 2xl:flex-1 min-w-0 w-full h-auto 2xl:h-full bg-transparent overflow-y-auto overflow-x-hidden p-2 md:p-4 pb-3 space-y-3 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#0A0A0A] [&::-webkit-scrollbar-thumb]:bg-[#404040] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-[#525252]"
                style={{ width: !isMobile && hasVisibleCharts ? `${100 - cliWidth}%` : '100%' }}
              >
              {/* Render all charts dynamically */}
              {charts.map((chart) => {
                if (chart.type === 'price') {
                  return (
                    <div key={chart.id} className="bg-[#141414] rounded-xl border border-[#262626] overflow-visible min-w-0">
                      <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center justify-between relative">
                        <span className="text-sm text-white">{chart.displayLabel || chart.symbol}</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setOpenDropdown(openDropdown === chart.id ? null : chart.id)}
                            className="text-[#737373] hover:text-white transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => closeChart(chart.id)}
                            className="text-[#737373] hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
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
                        height={280}
                        className="p-1"
                        resizeKey={resizeKey}
                      />
                    </div>
                  )
                } else if (chart.type === 'performance') {
                  return (
                    <div key={chart.id} className="bg-[#141414] rounded-xl border border-[#262626] overflow-visible min-w-0">
                      <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center justify-between">
                        <span className="text-sm text-white">Performance</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => closeChart(chart.id)}
                            className="text-[#737373] hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <PerformanceChart
                        title=""
                        height={250}
                        className="p-2"
                        resizeKey={resizeKey}
                      />
                    </div>
                  )
                } else if (chart.type === 'network') {
                  return (
                    <div key={chart.id} className="bg-[#141414] rounded-xl border border-[#262626] overflow-visible min-w-0">
                      <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center justify-between">
                        <span className="text-sm text-white">Network</span>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => closeChart(chart.id)}
                            className="text-[#737373] hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <NetworkGraph
                        title=""
                        height={350}
                        className="p-2"
                        resizeKey={resizeKey}
                      />
                    </div>
                  )
                } else if (chart.type === 'portfolio') {
                  return (
                    <div key={chart.id} className="bg-[#141414] rounded-xl border border-[#262626] overflow-visible min-w-0">
                      <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center justify-between">
                        <span className="text-sm text-white">Portfolio</span>
                        <div className="flex items-center gap-2">
                          <button
                            className="text-[#737373] hover:text-white transition-colors"
                          >
                            <ChevronDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => closeChart(chart.id)}
                            className="text-[#737373] hover:text-red-400 transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <PortfolioChart
                        chainIds={chart.chainIds}
                        walletAddress={chart.walletAddress}
                        height={350}
                        className="p-2"
                        resizeKey={resizeKey}
                      />
                    </div>
                  )
                }
                return null
              })}
              </div>
            )}
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
