"use client"

import { useState, useCallback, useEffect, useMemo } from 'react'
import { Terminal as TerminalIcon, Settings, BookOpen, X, ChevronDown } from "lucide-react"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { CLI } from './cli'
import { CanvasSurface } from './canvas-surface'
import { DraggableWindow } from './draggable-window'
import { PriceChart, PriceChartDropdown } from './charts/price-chart'
import { SwapWindow } from './swap/swap-window'
import { NodeProviderWindow } from './node-provider-window'
import { PerformanceChart } from './charts/performance-chart'
import { NetworkGraph } from './charts/network-graph'
import { PortfolioChart } from './charts/portfolio-chart'
import { Settings as SettingsPage } from './settings'
import type { TimeRange, DataSource } from '@/types/charts'
import type { RpcRegistry, RpcRegistryEntry } from '@/core'
import { getDefaultRpcRegistry, loadRpcRegistry, saveRpcRegistry } from '@/lib/rpc-registry'

interface Chart {
  id: string
  type: 'price' | 'performance' | 'network' | 'portfolio' | 'swap'
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
  const [swapWindows, setSwapWindows] = useState<string[]>([])
  const [nodeProviderWindows, setNodeProviderWindows] = useState<string[]>([])
  const [openMenu, setOpenMenu] = useState<string | null>(null)
  const [rpcRegistry, setRpcRegistry] = useState<RpcRegistry>(() => getDefaultRpcRegistry())
  const [rpcInputs, setRpcInputs] = useState<Record<string, string>>({})

  const PROVIDER = {
    name: 'D_D Cloud',
    color: 'from-blue-500 to-blue-600',
    placeholder: 'https://eth-mainnet.g.alchemy.com/v2/...',
  }

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

  const handleAddSwapWindow = useCallback(() => {
    setSwapWindows(prev => [...prev, `swap-${Date.now()}`])
  }, [])

  const closeSwapWindow = useCallback((windowId: string) => {
    setSwapWindows(prev => prev.filter(id => id !== windowId))
  }, [])

  const handleAddNodeProviderWindow = useCallback(() => {
    setNodeProviderWindows(prev => [...prev, `node-provider-${Date.now()}`])
  }, [])

  const closeNodeProviderWindow = useCallback((windowId: string) => {
    setNodeProviderWindows(prev => prev.filter(id => id !== windowId))
  }, [])

  const closeAllWindows = useCallback(() => {
    setCharts([])
    setSwapWindows([])
    setNodeProviderWindows([])
  }, [])

  useEffect(() => {
    const loaded = loadRpcRegistry()
    setRpcRegistry(loaded)
  }, [])

  useEffect(() => {
    saveRpcRegistry(rpcRegistry)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('rpc-registry-updated', { detail: rpcRegistry }))
    }
  }, [rpcRegistry])

  const setRegistryEntry = useCallback((entry: RpcRegistryEntry) => {
    setRpcRegistry(prev => ({
      ...prev,
      [entry.chainId]: entry,
    }))
  }, [])

  const resolveRegistryEntry = useCallback((chainId: number): RpcRegistryEntry => {
    return rpcRegistry[chainId] || { chainId, source: 'wallet' }
  }, [rpcRegistry])

  const activeRpcStatus = useMemo(() => {
    return Object.values(rpcRegistry).reduce<Record<number, string>>((acc, entry) => {
      acc[entry.chainId] = entry.source === 'custom' && entry.customRpcUrl
        ? `Custom (${entry.customRpcUrl})`
        : 'Wallet'
      return acc
    }, {})
  }, [rpcRegistry])

  const updateChartSettings = useCallback((chartId: string, timeRange: TimeRange, dataSource: DataSource) => {
    setCharts(prev => prev.map(chart =>
      chart.id === chartId
        ? { ...chart, timeRange, dataSource }
        : chart
    ))
  }, [])

  // Check if any charts are visible
  const hasVisibleCharts = charts.length > 0 || swapWindows.length > 0

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
          {currentView === 'terminal' && (
            <div className="flex items-center gap-4 px-4 md:px-8 h-10 border-b border-[#262626] bg-[#101010] flex-shrink-0 text-sm text-[#d4d4d4]">
              {[
                { id: 'edit', label: 'Edit' },
                { id: 'view', label: 'View' },
                { id: 'add', label: 'Add' },
                { id: 'settings', label: 'Settings' },
                { id: 'help', label: 'Help' },
              ].map(menu => (
                <div key={menu.id} className="relative">
                  <button
                    onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                    className={`px-2 py-1 rounded-md transition-colors ${
                      openMenu === menu.id ? 'bg-[#1a1a1a] text-white' : 'hover:bg-[#1a1a1a] hover:text-white'
                    }`}
                  >
                    {menu.label}
                  </button>
                  {openMenu === menu.id && (
                    <div className="absolute left-0 mt-2 w-52 bg-[#141414] border border-[#262626] rounded-lg shadow-lg z-50">
                      {menu.id === 'edit' && (
                        <button
                          onClick={() => {
                            closeAllWindows()
                            setOpenMenu(null)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                        >
                          Close All Windows
                        </button>
                      )}
                      {menu.id === 'view' && (
                        <>
                          <button
                            onClick={() => {
                              handleAddChart('eth')
                              setOpenMenu(null)
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                          >
                            Price Chart
                          </button>
                          <button
                            onClick={() => {
                              handleAddChart('performance')
                              setOpenMenu(null)
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                          >
                            Performance
                          </button>
                          <button
                            onClick={() => {
                              handleAddChart('network')
                              setOpenMenu(null)
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                          >
                            Network
                          </button>
                          <button
                            onClick={() => {
                              handleAddChart('portfolio')
                              setOpenMenu(null)
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                          >
                            Portfolio
                          </button>
                        </>
                      )}
                      {menu.id === 'add' && (
                        <>
                          <button
                            onClick={() => {
                              handleAddSwapWindow()
                              setOpenMenu(null)
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                          >
                            Swap Window
                          </button>
                          <button
                            onClick={() => {
                              handleAddNodeProviderWindow()
                              setOpenMenu(null)
                            }}
                            className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                          >
                            Add a node provider
                          </button>
                        </>
                      )}
                      {menu.id === 'settings' && (
                        <button
                          onClick={() => {
                            setCurrentView('settings')
                            setOpenMenu(null)
                          }}
                          className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors"
                        >
                          Open Settings
                        </button>
                      )}
                      {menu.id === 'help' && (
                        <>
                          <a
                            href="https://docs.dappterminal.com"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenMenu(null)}
                            className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors block"
                          >
                            View the Docs
                          </a>
                          <a
                            href="https://t.me/nickmura2"
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => setOpenMenu(null)}
                            className="w-full text-left px-3 py-2 text-sm text-[#d4d4d4] hover:bg-[#1f1f1f] hover:text-white transition-colors block"
                          >
                            Contact maintainer
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

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
                    defaultSize={{ width: 1000, height: 640 }}
                    minSize={{ width: 640, height: 420 }}
                    showChrome={false}
                  >
                    <CLI isFullWidth={!hasVisibleCharts} onAddChart={handleAddChart} />
                  </DraggableWindow>
                  {charts.map((chart, index) => {
                    const baseX = 1040 + index * 70
                    const baseY = 120 + index * 70
                    const windowId = `chart-${chart.id}`

                    if (chart.type === 'price') {
                      return (
                        <DraggableWindow
                          key={chart.id}
                          id={windowId}
                          scale={scale}
                          defaultPosition={{ x: baseX, y: baseY }}
                          defaultSize={{ width: 720, height: 380 }}
                          minSize={{ width: 520, height: 320 }}
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
                          defaultSize={{ width: 680, height: 360 }}
                          minSize={{ width: 500, height: 320 }}
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
                          defaultSize={{ width: 720, height: 420 }}
                          minSize={{ width: 520, height: 360 }}
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
                          defaultSize={{ width: 720, height: 420 }}
                          minSize={{ width: 520, height: 360 }}
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
                  {swapWindows.map((windowId, index) => {
                    const baseX = 1120 + index * 80
                    const baseY = 200 + index * 80

                    return (
                      <DraggableWindow
                        key={windowId}
                        id={windowId}
                        scale={scale}
                        defaultPosition={{ x: baseX, y: baseY }}
                        defaultSize={{ width: 420, height: 540 }}
                        minSize={{ width: 380, height: 480 }}
                        showChrome={false}
                      >
                        <SwapWindow onClose={() => closeSwapWindow(windowId)} />
                      </DraggableWindow>
                    )
                  })}
                  {nodeProviderWindows.map((windowId, index) => {
                    const baseX = 1080 + index * 80
                    const baseY = 140 + index * 80
                    const chainId = 1
                    const entry = resolveRegistryEntry(chainId)

                    return (
                      <DraggableWindow
                        key={windowId}
                        id={windowId}
                        scale={scale}
                        defaultPosition={{ x: baseX, y: baseY }}
                        defaultSize={{ width: 400, height: 520 }}
                        minSize={{ width: 360, height: 460 }}
                        showChrome={false}
                      >
                        <NodeProviderWindow
                          provider={PROVIDER}
                          entry={entry}
                          rpcInput={rpcInputs[windowId] ?? entry.customRpcUrl ?? ''}
                          activeStatus={activeRpcStatus[chainId] || 'Wallet'}
                          onClose={() => closeNodeProviderWindow(windowId)}
                          onRpcInputChange={(value) => {
                            setRpcInputs(prev => ({ ...prev, [windowId]: value }))
                          }}
                          onStartNode={() => {
                            const customRpcUrl = rpcInputs[windowId]?.trim()
                            setRegistryEntry({
                              chainId,
                              source: 'custom',
                              customRpcUrl: customRpcUrl || undefined,
                              customProviderName: PROVIDER.name,
                              updatedAt: new Date().toISOString(),
                            })
                          }}
                        />
                      </DraggableWindow>
                    )
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
