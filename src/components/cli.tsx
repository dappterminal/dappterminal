"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { Plus, X, ChevronDown } from "lucide-react"
import { useAccount, useEnsName } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { registry, registerCoreCommands, createExecutionContext, updateExecutionContext } from "@/core"
import type { ExecutionContext, CommandResult, TransactionRequest, TypedDataPayload } from "@/core"
import { pluginLoader } from "@/plugins/plugin-loader"
import { oneInchPlugin } from "@/plugins/1inch"
import { stargatePlugin } from "@/plugins/stargate"
import { wormholePlugin } from "@/plugins/wormhole"
import { lifiPlugin } from "@/plugins/lifi"
import { aaveV3Plugin } from "@/plugins/aave-v3"
import { uniswapV4Plugin } from "@/plugins/uniswap-v4"

interface OutputSegment {
  text: string
  color?: string
  bold?: boolean
}

interface HistoryItem {
  command: string
  output: string[]
  timestamp: Date
  links?: { text: string; url: string }[] // Optional links to render
  styledOutput?: OutputSegment[][] // Optional styled output (array of lines, each line is array of segments)
  prompt?: string // Store the prompt at the time of execution
}

interface TerminalTab {
  id: string
  name: string
  history: HistoryItem[]
  executionContext: ExecutionContext
  currentInput: string
  commandHistory: string[]
  historyIndex: number
}

const MAX_COMMAND_HISTORY = 1000 // Maximum commands to keep in history

// Protocol color mapping
const PROTOCOL_COLORS: Record<string, string> = {
  stargate: '#0FB983',
  '1inch': '#94A6FF',
  wormhole: '#9CA3AF', // Gray
  lifi: '#A855F7',
  'aave-v3': '#2F7CF6',
  'uniswap-v4': '#FF69B4', // Hot pink
  // Add more protocols here as needed
}

/**
 * Format price with appropriate decimal places based on magnitude
 * - Prices >= $1: 2 decimals (e.g., $123.45)
 * - Prices >= $0.01: 4 decimals (e.g., $0.1234)
 * - Prices < $0.01: Show significant digits (e.g., $0.00001234)
 */
function formatPrice(price: number): string {
  if (price >= 1) {
    return price.toFixed(2)
  } else if (price >= 0.01) {
    return price.toFixed(4)
  } else if (price === 0) {
    return '0.00'
  } else {
    // For very small prices, show up to 8 significant figures
    // Remove trailing zeros
    return price.toFixed(8).replace(/\.?0+$/, '')
  }
}

// Helper to format terminal prompt based on wallet state and active protocol
function formatPrompt(ensName?: string | null, address?: `0x${string}`, activeProtocol?: string): string {
  const protocolSuffix = activeProtocol || 'defi'

  if (ensName) {
    return `${ensName}@${protocolSuffix}>`
  }
  if (address) {
    // Truncate address: 0x1234...5678
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`
    return `${truncated}@${protocolSuffix}>`
  }
  return `user@${protocolSuffix}>`
}

// Format command result for terminal display
function formatCommandResult(result: CommandResult): string[] {
  if (!result.success) {
    return [`Error: ${result.error.message}`]
  }

  const value = result.value

  // Handle special cases
  if (typeof value === 'object' && value !== null) {
    // Handle cleared flag
    if ('cleared' in value && value.cleared) {
      return []
    }

    // Handle help command output
    if ('message' in value && ('core' in value || 'fiber' in value)) {
      const helpOutput = value as {
        message: string
        core?: Array<{ id: string; description: string; aliases?: string[] }>
        fiber?: unknown
        commands?: Array<{ id: string; description: string; aliases?: string[] }>
        globals?: Array<{ id: string; description: string; aliases?: string[] }>
        aliases?: Array<{ id: string; description: string; aliases?: string[] }>
        exitHint?: string
        protocols?: Array<{
          id: string
          name: string
          description?: string
          commandCount: number
          commands?: Array<{ id: string; description: string }>
        }>
      }
      const lines: string[] = [helpOutput.message, '']

      // Fiber help (when in M_p)
      if (helpOutput.fiber && Array.isArray(helpOutput.commands)) {
        for (const cmd of helpOutput.commands) {
          const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : ''
          lines.push(`  ${cmd.id.padEnd(12)} - ${cmd.description}${aliases}`)
        }

        // Show essential globals
        if (Array.isArray(helpOutput.globals) && helpOutput.globals.length > 0) {
          lines.push('')
          lines.push('Global Commands:')
          for (const cmd of helpOutput.globals) {
            const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : ''
            lines.push(`  ${cmd.id.padEnd(12)} - ${cmd.description}${aliases}`)
          }
        }

        if (helpOutput.exitHint) {
          lines.push('')
          lines.push(`💡 ${helpOutput.exitHint}`)
        }
        return lines
      }

      // Global help (when in M_G)
      // Core commands
      if (Array.isArray(helpOutput.core) && helpOutput.core.length > 0) {
        lines.push('Core Commands:')
        for (const cmd of helpOutput.core) {
          const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : ''
          lines.push(`  ${cmd.id.padEnd(12)} - ${cmd.description}${aliases}`)
        }
        lines.push('')
      }

      // Aliased commands
      if (Array.isArray(helpOutput.aliases) && helpOutput.aliases.length > 0) {
        lines.push('Aliased Commands:')
        for (const cmd of helpOutput.aliases) {
          const aliases = cmd.aliases?.length ? ` (${cmd.aliases.join(', ')})` : ''
          lines.push(`  ${cmd.id.padEnd(12)} - ${cmd.description}${aliases}`)
        }
        lines.push('')
      }

      // Protocols
      if (Array.isArray(helpOutput.protocols) && helpOutput.protocols.length > 0) {
        lines.push('Available Protocols:')
        for (const protocol of helpOutput.protocols) {
          lines.push(`  ${protocol.id} - ${protocol.name}`)
          if (protocol.commands && protocol.commands.length > 0) {
            for (const cmd of protocol.commands) {
              lines.push(`    ${cmd.id.padEnd(12)} - ${cmd.description}`)
            }
          }
        }
      }

      return lines
    }

    // Handle arrays - need to check specific types first
    if (Array.isArray(value) && value.length > 0) {
      const firstItem = value[0]

      // Handle history (has command and timestamp)
      if ('command' in firstItem && 'timestamp' in firstItem) {
        return value.map((item: unknown) => {
          const historyItem = item as { command: string }
          return `  ${historyItem.command}`
        })
      }

      // Handle protocols list (has id, name, commandCount)
      if ('id' in firstItem && 'commandCount' in firstItem) {
        return value.map((item: unknown) => {
          const protocolItem = item as {
            id: string
            name?: string
            description?: string
            commandCount?: number
          }
          return `  ${protocolItem.id.padEnd(15)} ${protocolItem.name || ''} ${protocolItem.description ? `- ${protocolItem.description}` : ''} ${protocolItem.commandCount !== undefined ? `(${protocolItem.commandCount} commands)` : ''}`
        })
      }

      // Handle generic arrays
      return value.map((item: unknown) => JSON.stringify(item, null, 2))
    }

    // Handle empty arrays
    if (Array.isArray(value)) {
      return []
    }

    // Handle 1inch token price
    if ('tokenPrice' in value) {
      const priceData = value as {
        tokenPrice: number
        chainId: number
        token: string
        tokenAddress: string
        price: string | number
      }
      const networkNames: Record<number, string> = {
        1: 'Ethereum',
        10: 'Optimism',
        137: 'Polygon',
        42161: 'Arbitrum',
        8453: 'Base',
        56: 'BSC',
        43114: 'Avalanche',
      }
      const networkName = networkNames[priceData.chainId] || `Chain ${priceData.chainId}`

      // Map token symbols to their unicode symbols
      const tokenSymbols: Record<string, string> = {
        eth: 'Ξ',
        weth: 'Ξ',
        btc: '₿',
        wbtc: '₿',
        bnb: 'BNB',
        matic: 'MATIC',
        avax: 'AVAX',
      }

      const tokenSymbol = tokenSymbols[priceData.token.toLowerCase()] || priceData.token.toUpperCase()

      // Format price - with currency=USD, the API returns price directly in USD
      const priceInUsd = typeof priceData.price === 'string' ? parseFloat(priceData.price) : priceData.price
      const formattedPrice = formatPrice(priceInUsd)

      return [
        `${tokenSymbol} ${priceData.token.toUpperCase()} Price:`,
        `  Price: $${formattedPrice} USD`,
        `  Network: ${networkName}`,
        `  Address: ${priceData.tokenAddress}`,
      ]
    }

    // Handle 1inch gas prices
    if ('gasPrices' in value) {
      const gasData = value as {
        gasPrices: unknown
        chainId: number
        low?: { maxFeePerGas: string }
        medium?: { maxFeePerGas: string }
        high?: { maxFeePerGas: string }
        baseFee?: string
      }
      const networkNames: Record<number, string> = {
        1: 'Ethereum',
        10: 'Optimism',
        137: 'Polygon',
        42161: 'Arbitrum',
        8453: 'Base',
        56: 'BSC',
        43114: 'Avalanche',
      }
      const networkName = networkNames[gasData.chainId] || `Chain ${gasData.chainId}`

      const formatGwei = (value: string) => (parseInt(value) / 1e9).toFixed(2)
      const lines = [`⛽ Gas Prices on ${networkName}:`]

      if (gasData.low) {
        const lowGwei = formatGwei(gasData.low.maxFeePerGas)
        lines.push(`  🟢 Low: ${lowGwei} Gwei`)
      }
      if (gasData.medium) {
        const mediumGwei = formatGwei(gasData.medium.maxFeePerGas)
        lines.push(`  🟡 Medium: ${mediumGwei} Gwei`)
      }
      if (gasData.high) {
        const highGwei = formatGwei(gasData.high.maxFeePerGas)
        lines.push(`  🔴 High: ${highGwei} Gwei`)
      }
      if (gasData.baseFee) {
        lines.push(`  📊 Base Fee: ${formatGwei(gasData.baseFee)} Gwei`)
      }

      return lines
    }

    // Handle 1inch swap request
    if ('swapRequest' in value) {
      const swapData = value as {
        swapRequest: boolean
        fromToken: string
        toToken: string
        amountIn: string
        amountOut: string
        gas?: string
        slippage: number
      }
      return [
        `📊 Swap Quote Retrieved:`,
        `  ${swapData.fromToken.toUpperCase()} → ${swapData.toToken.toUpperCase()}`,
        `  Input: ${swapData.amountIn}`,
        `  Output: ${swapData.amountOut}`,
        `  Gas: ${swapData.gas || 'estimating...'}`,
        `  Slippage: ${swapData.slippage}%`,
        ``,
        `⚠️  Feature Status: COMING SOON`,
        `Swap transaction signing and execution is under development.`,
        `Quote fetching is functional, but the final swap step is not yet implemented.`,
      ]
    }

    // Handle message objects
    if ('message' in value) {
      const lines = [value.message as string]
      Object.entries(value).forEach(([key, val]) => {
        if (key !== 'message') {
          lines.push(`${key}: ${JSON.stringify(val)}`)
        }
      })
      return lines
    }

    // Default: JSON stringify
    return [JSON.stringify(value, null, 2)]
  }

  // Primitive values
  return [String(value)]
}

export interface CLIProps {
  className?: string
  isFullWidth?: boolean
  onAddChart?: (chartType: string, chartMode?: 'candlestick' | 'line', chainIds?: number[], walletAddress?: string, symbol?: string, name?: string, protocol?: string) => void
}

export function CLI({ className = '', isFullWidth = false, onAddChart }: CLIProps = {}) {
  const [mounted, setMounted] = useState(false)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>("")
  const [showSettings, setShowSettings] = useState(false)
  const [showSettingsPage, setShowSettingsPage] = useState(false)
  const [showDocsPage, setShowDocsPage] = useState(false)
  const [fontSize, setFontSize] = useState(15)
  const [fuzzyMatches, setFuzzyMatches] = useState<string[]>([])
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0)
  const [isExecuting, setIsExecuting] = useState(false)
  const [pluginsLoading, setPluginsLoading] = useState(true)
  const [loadedPlugins, setLoadedPlugins] = useState<string[]>([])
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  // Get wallet state from wagmi
  const { address, chainId, isConnected, isConnecting } = useAccount()
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
  })

  // Get active tab and its execution context
  const activeTab = tabs.find(tab => tab.id === activeTabId)
  const executionContext = activeTab?.executionContext ?? null

  // Get tab-specific input values
  const currentInput = activeTab?.currentInput ?? ""
  const commandHistory = activeTab?.commandHistory ?? []
  const historyIndex = activeTab?.historyIndex ?? -1

  // Helper to update tab-specific input
  const updateTabInput = (input: string) => {
    if (!activeTabId) return
    setTabs(prevTabs => prevTabs.map(tab =>
      tab.id === activeTabId ? { ...tab, currentInput: input } : tab
    ))
  }

  const updateTabHistory = (history: string[]) => {
    if (!activeTabId) return
    setTabs(prevTabs => prevTabs.map(tab =>
      tab.id === activeTabId ? { ...tab, commandHistory: history } : tab
    ))
  }

  const updateTabHistoryIndex = (index: number) => {
    if (!activeTabId) return
    setTabs(prevTabs => prevTabs.map(tab =>
      tab.id === activeTabId ? { ...tab, historyIndex: index } : tab
    ))
  }

  // Generate prompt based on wallet state and active protocol
  const activeProtocol = executionContext?.activeProtocol
  const prompt = formatPrompt(ensName, address, activeProtocol)

  // Debug: log active protocol changes
  useEffect(() => {
    if (activeProtocol) {
      console.log('Active protocol changed to:', activeProtocol)
    }
  }, [activeProtocol])

  // Debug: log active tab changes
  useEffect(() => {
    console.log('[Tab State] activeTabId changed to:', activeTabId)
    console.log('[Tab State] Available tabs:', tabs.map(t => ({ id: t.id, name: t.name })))
    console.log('[Tab State] Active tab found:', !!activeTab)
    console.log('[Tab State] Active tab details:', activeTab ? { id: activeTab.id, name: activeTab.name } : 'none')
  }, [activeTabId, tabs, activeTab])

  // Update active tab name when protocol changes
  useEffect(() => {
    console.log('[Tab Update Effect] Triggered - activeProtocol:', activeProtocol, 'activeTabId:', activeTabId)
    if (activeTabId) {
      const newTabName = activeProtocol || 'defi'
      console.log('[Tab Update Effect] Updating tab name to:', newTabName, 'for tab:', activeTabId)
      setTabs(prevTabs => {
        console.log('[Tab Update Effect] Current tabs:', prevTabs)
        const updatedTabs = prevTabs.map(tab =>
          tab.id === activeTabId
            ? { ...tab, name: newTabName }
            : tab
        )
        console.log('[Tab Update Effect] Updated tabs:', updatedTabs)
        return updatedTabs
      })
    }
  }, [activeProtocol, activeTabId])

  useEffect(() => {
    setMounted(true)

    // Register core commands
    registerCoreCommands()

    // Create execution context
    const context = createExecutionContext()

    // Track plugin loading
    const pluginsToLoad = [
      { name: '1inch', plugin: oneInchPlugin },
      { name: 'Stargate', plugin: stargatePlugin },
      { name: 'Wormhole', plugin: wormholePlugin },
      { name: 'LiFi', plugin: lifiPlugin },
      { name: 'Aave v3', plugin: aaveV3Plugin },
      { name: 'Uniswap V4', plugin: uniswapV4Plugin },
    ]

    const loadedPluginNames: string[] = []

    // Load all plugins
    Promise.all(
      pluginsToLoad.map(({ name, plugin }) =>
        pluginLoader.loadPlugin(plugin, undefined, context).then(result => {
          if (result.success) {
            console.log(`${name} plugin loaded successfully`)
            loadedPluginNames.push(name)
            setLoadedPlugins(prev => [...prev, name])
          } else {
            console.error(`Failed to load ${name} plugin:`, result.error)
          }
          return result
        })
      )
    ).then(() => {
      setPluginsLoading(false)
      console.log('All plugins loaded')
    })

    // Load command history from localStorage
    const savedHistory = localStorage.getItem('defi-terminal-command-history')
    let loadedHistory: string[] = []
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        if (Array.isArray(parsed)) {
          // Apply sliding window in case saved history exceeds limit
          loadedHistory = parsed.length > MAX_COMMAND_HISTORY
            ? parsed.slice(-MAX_COMMAND_HISTORY)
            : parsed
        }
      } catch {
        // Invalid JSON, ignore
      }
    }

    const initialTab: TerminalTab = {
      id: "1",
      name: "defi",
      history: [
        {
          command: "welcome",
          output: [
            "Welcome to dApp Terminal. This is an experimental snapshot release (alpha 0.1.1). Use at your own risk.",
            "",
            "⏳ Loading protocols...",
            "",
            "Type 'help' to see available commands."
          ],
          timestamp: new Date()
        }
      ],
      executionContext: context,
      currentInput: "",
      commandHistory: loadedHistory,
      historyIndex: -1
    }
    setTabs([initialTab])
    setActiveTabId("1")

    // Load fontSize from localStorage
    const savedFontSize = localStorage.getItem('defi-terminal-font-size')
    if (savedFontSize) {
      setFontSize(Number(savedFontSize))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(event.target as Node)) {
        setShowSettings(false)
      }
    }

    if (showSettings) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showSettings])

  const history = activeTab?.history || []

  // Simple, reliable auto-scroll to bottom when history changes
  useEffect(() => {
    if (terminalRef.current) {
      // Use requestAnimationFrame to ensure DOM has updated
      requestAnimationFrame(() => {
        if (terminalRef.current) {
          terminalRef.current.scrollTop = terminalRef.current.scrollHeight
        }
      })
    }
  }, [history])

  // Save fontSize to localStorage whenever it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('defi-terminal-font-size', fontSize.toString())
    }
  }, [fontSize, mounted])

  // Save command history to localStorage whenever active tab's history changes
  useEffect(() => {
    if (mounted && activeTab) {
      localStorage.setItem('defi-terminal-command-history', JSON.stringify(activeTab.commandHistory))
    }
  }, [activeTab?.commandHistory, mounted])

  // Update welcome message once plugins are loaded
  useEffect(() => {
    if (!pluginsLoading && loadedPlugins.length > 0) {
      setTabs(prevTabs => prevTabs.map(tab => {
        if (tab.id === '1' && tab.history.length > 0 && tab.history[0].command === 'welcome') {
          // Create styled output with colored protocol names
          const protocolLine: OutputSegment[] = [
            { text: `Loaded ${loadedPlugins.length} protocols: `, color: '#d1d5db' }
          ]

          // Add each protocol with its color
          loadedPlugins.forEach((plugin, index) => {
            // Map plugin names to protocol color keys and display names
            const protocolKeyMap: Record<string, string> = {
              '1inch': '1inch',
              'Stargate': 'stargate',
              'Wormhole': 'wormhole',
              'LiFi': 'lifi',
              'Aave v3': 'aave-v3',
              'Uniswap V4': 'uniswap-v4',
            }
            const displayNameMap: Record<string, string> = {
              '1inch': '1inch',
              'Stargate': 'stargate',
              'Wormhole': 'wormhole',
              'LiFi': 'lifi',
              'Aave v3': 'aave-v3',
              'Uniswap V4': 'uniswap-v4',
            }
            const protocolKey = protocolKeyMap[plugin] || plugin.toLowerCase()
            const displayName = displayNameMap[plugin] || plugin.toLowerCase()
            const color = PROTOCOL_COLORS[protocolKey] || '#d1d5db'

            protocolLine.push({
              text: displayName,
              color: color,
              bold: true
            })

            // Add comma separator if not last
            if (index < loadedPlugins.length - 1) {
              protocolLine.push({ text: ', ', color: '#d1d5db' })
            }
          })

          return {
            ...tab,
            history: [{
              ...tab.history[0],
              output: [],
              styledOutput: [
                [{ text: "Welcome to dApp Terminal. This is an experimental snapshot release (alpha 0.1.1). Use at your own risk.", color: '#d1d5db' }],
                [{ text: "", color: '#d1d5db' }],
                protocolLine,
                [{ text: "", color: '#d1d5db' }],
                [{ text: "Type 'help' to see available commands.", color: '#d1d5db' }]
              ]
            }, ...tab.history.slice(1)]
          }
        }
        return tab
      }))
    }
  }, [pluginsLoading, loadedPlugins])

  // Sync wallet state to execution context
  useEffect(() => {
    if (activeTabId) {
      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId
          ? {
              ...tab,
              executionContext: {
                ...tab.executionContext,
                wallet: {
                  address,
                  chainId,
                  isConnected,
                  isConnecting,
                  isDisconnecting: false, // wagmi v2 doesn't expose this
                }
              }
            }
          : tab
      ))
    }
  }, [address, chainId, isConnected, isConnecting, activeTabId])

  const addNewTab = () => {
    const newId = (tabs.length + 1).toString()
    console.log('[Add Tab] Creating new tab with id:', newId)
    console.log('[Add Tab] Current tabs before add:', tabs.map(t => ({ id: t.id, name: t.name })))

    // Create a new execution context for this tab
    const newContext = createExecutionContext()

    // Load plugins for the new context
    pluginLoader.loadPlugin(oneInchPlugin, undefined, newContext)
    pluginLoader.loadPlugin(stargatePlugin, undefined, newContext)
    pluginLoader.loadPlugin(wormholePlugin, undefined, newContext)
    pluginLoader.loadPlugin(lifiPlugin, undefined, newContext)
    pluginLoader.loadPlugin(aaveV3Plugin, undefined, newContext)
    pluginLoader.loadPlugin(uniswapV4Plugin, undefined, newContext)

    const newTab: TerminalTab = {
      id: newId,
      name: "defi",
      history: [
        {
          command: "welcome",
          output: ["Welcome to dApp Terminal. This is an experimental snapshot release (alpha 0.1.1). Use at your own risk. Type 'help' to see available commands."],
          timestamp: new Date()
        }
      ],
      executionContext: newContext,
      currentInput: "",
      commandHistory: [],
      historyIndex: -1
    }
    setTabs([...tabs, newTab])
    console.log('[Add Tab] New tab created, setting active to:', newId)
    setActiveTabId(newId)
  }

  const closeTab = (tabId: string) => {
    console.log('[Close Tab] Attempting to close tab:', tabId)
    console.log('[Close Tab] Current tabs:', tabs.map(t => ({ id: t.id, name: t.name })))
    console.log('[Close Tab] Current activeTabId:', activeTabId)

    if (tabs.length === 1) {
      console.log('[Close Tab] Cannot close last tab')
      return // Don't close last tab
    }

    const newTabs = tabs.filter(tab => tab.id !== tabId)
    console.log('[Close Tab] New tabs after filter:', newTabs.map(t => ({ id: t.id, name: t.name })))
    setTabs(newTabs)

    if (activeTabId === tabId) {
      console.log('[Close Tab] Closed tab was active, switching to:', newTabs[0].id)
      setActiveTabId(newTabs[0].id)
    } else {
      console.log('[Close Tab] Closed tab was not active, keeping activeTabId:', activeTabId)
    }
  }

  const executeCommand = async (input: string) => {
    const trimmedInput = input.trim()

    if (!trimmedInput || !executionContext) return

    // Prevent executing multiple commands simultaneously
    if (isExecuting) {
      return
    }

    // Prevent execution while plugins are still loading
    if (pluginsLoading) {
      const warningItem: HistoryItem = {
        command: trimmedInput,
        output: ['⏳ Please wait for protocols to finish loading...'],
        timestamp: new Date(),
        prompt: String(prompt)
      }
      setTabs(prevTabs => prevTabs.map(tab =>
        tab.id === activeTabId
          ? { ...tab, history: [...tab.history, warningItem] }
          : tab
      ))
      updateTabInput("")
      return
    }

    // Set executing state to disable input and clear fuzzy matches
    setIsExecuting(true)
    setFuzzyMatches([])
    setSelectedMatchIndex(0)

    // Ensure lock is always released using try-finally
    try {

    // Parse command and arguments
    const parts = trimmedInput.split(' ')
    const commandName = parts[0]
    const args = parts.slice(1).join(' ')

    // Check for --protocol flag
    const protocolMatch = args.match(/--protocol\s+(\S+)/)
    const explicitProtocol = protocolMatch ? protocolMatch[1] : undefined

    // Resolve command using ρ (exact resolver)
    const resolved = registry.ρ({
      input: commandName,
      explicitProtocol,
      preferences: {
        defaults: executionContext.protocolPreferences,
        priority: [],
      },
      executionContext,
    })

    let output: string[] = []

    if (!resolved) {
      output = [`Command not found: ${commandName}. Type 'help' for available commands.`]
    } else {
      try {
        // Execute command
        // If protocolNameAsCommand is set, use it as the argument instead
        const commandArgs = resolved.protocolNameAsCommand || args
        const result = await resolved.command.run(commandArgs, executionContext)

        // Handle special client-side commands
        if (result.success && typeof result.value === 'object' && result.value !== null) {
          // Handle chart command - add chart to analytics panel
          if ('addChart' in result.value && result.value.addChart) {
            const chartData = result.value as {
              addChart: boolean
              chartType: string
              chartMode?: 'candlestick' | 'line'
              chainIds?: number[]
              walletAddress?: string
              symbol?: string // Token symbol (for display)
              name?: string // Token name (for display)
              protocol?: string // Protocol used for search
            }

            if (onAddChart) {
              onAddChart(chartData.chartType, chartData.chartMode, chartData.chainIds, chartData.walletAddress, chartData.symbol, chartData.name, chartData.protocol)
              const displayName = chartData.symbol || chartData.chartType
              output = [`Added ${displayName} chart to analytics panel`]
            } else {
              output = [`Chart panel not available`]
            }
          }
          // Handle whoami command - enhance with ENS
          else if (resolved.command.id === 'whoami' && 'address' in result.value) {
            const valueData = result.value as { address: `0x${string}`; chainId?: number }
            const lines: string[] = []
            lines.push('Wallet Identity:')
            lines.push(`  Address: ${valueData.address}`)
            if (ensName) {
              lines.push(`  ENS: ${ensName}`)
            }
            if (valueData.chainId) {
              lines.push(`  Chain ID: ${valueData.chainId}`)
            }
            output = lines
          }
          // Handle transfer command - send ETH transaction
          else if (resolved.command.id === 'transfer' && 'transferRequest' in result.value) {
            const valueData = result.value as {
              transferRequest: boolean
              amount: string
              toAddress: string
              fromAddress: `0x${string}`
              chainId: number
            }

            // Show preparing transaction message
            output = ['Preparing transaction...']

            // Add temporary history item
            const transferTimestamp = new Date()
            const tempHistoryItem: HistoryItem = {
              command: trimmedInput,
              output,
              timestamp: transferTimestamp,
              prompt: String(prompt)
            }

            setTabs(prevTabs => prevTabs.map(tab =>
              tab.id === activeTabId
                ? { ...tab, history: [...tab.history, tempHistoryItem] }
                : tab
            ))

            // Send transaction using wagmi
            try {
              const { sendTransaction } = await import('wagmi/actions')
              const { config } = await import('@/lib/wagmi-config')
              const { parseEther } = await import('viem')

              // Send the transaction
              const hash = await sendTransaction(config, {
                to: valueData.toAddress as `0x${string}`,
                value: parseEther(valueData.amount),
              })

              // Update with success
              const successLines: string[] = []
              successLines.push(`Transaction sent successfully!`)
              successLines.push(`  Amount: ${valueData.amount} ETH`)
              successLines.push(`  To: ${valueData.toAddress}`)
              successLines.push(`  Tx Hash: ${hash}`)

              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === transferTimestamp
                      ? { ...item, output: successLines }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            } catch (error) {
              // Update with error
              const errorMsg = error instanceof Error ? error.message : String(error)
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === transferTimestamp
                      ? { ...item, output: [`Error sending transaction: ${errorMsg}`] }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            }

            // Add to command history and return early
            updateTabHistory((() => {
              const newHistory = [...commandHistory, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })())
            updateTabInput("")
            updateTabHistoryIndex(-1)
            return
          }
          // Handle balance command - fetch balance client-side
          else if (resolved.command.id === 'balance' && 'fetchBalance' in result.value) {
            const valueData = result.value as { fetchBalance: boolean; address: `0x${string}`; chainId: number }

            // Async balance fetch - we'll show loading state then update
            output = ['Fetching balance...']

            // Add temporary history item and capture its timestamp for identification
            const balanceTimestamp = new Date()
            const tempHistoryItem: HistoryItem = {
              command: trimmedInput,
              output,
              timestamp: balanceTimestamp,
              prompt: String(prompt)
            }

            setTabs(prevTabs => prevTabs.map(tab =>
              tab.id === activeTabId
                ? { ...tab, history: [...tab.history, tempHistoryItem] }
                : tab
            ))

            // Fetch balance using wagmi (we'll need to import the config)
            try {
              const { getBalance } = await import('wagmi/actions')
              const { config } = await import('@/lib/wagmi-config')

              const balance = await getBalance(config, {
                address: valueData.address,
              })

              // Update the specific history item by finding it via timestamp
              const balanceLines: string[] = []
              balanceLines.push(`Balance on Chain ${valueData.chainId}:`)
              balanceLines.push(`  ${formatUnits(balance.value, balance.decimals)} ${balance.symbol}`)

              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === balanceTimestamp
                      ? { ...item, output: balanceLines }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            } catch (error) {
              // Update with error using timestamp to find the correct item
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === balanceTimestamp
                      ? { ...item, output: [`Error fetching balance: ${error instanceof Error ? error.message : String(error)}`] }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            }

            // Add to command history and return early
            updateTabHistory((() => {
              const newHistory = [...commandHistory, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })())
            updateTabInput("")
            updateTabHistoryIndex(-1)
            return
          }
          // ========================================
          // HANDLER DISPATCH SYSTEM
          // Check if command has a registered handler in its plugin
          // ========================================
          else if (resolved.protocol) {
            // Get the plugin for this protocol
            const pluginEntry = pluginLoader.getPlugin(resolved.protocol)
            const handler = pluginEntry?.plugin.handlers?.[resolved.command.id]

            if (handler) {
              // Command has a handler - use it!
              const commandTimestamp = new Date()

              // Add initial empty history item
              const tempHistoryItem: HistoryItem = {
                command: trimmedInput,
                output: [],
                timestamp: commandTimestamp,
                prompt: String(prompt)
              }

              setTabs(prevTabs => prevTabs.map(tab =>
                tab.id === activeTabId
                  ? { ...tab, history: [...tab.history, tempHistoryItem] }
                  : tab
              ))

              // Create CLI context
              const cliContext = {
                updateHistory: (lines: string[]) => {
                  setTabs(prevTabs => prevTabs.map(tab => {
                    if (tab.id === activeTabId) {
                      const updatedHistory = tab.history.map(item =>
                        item.timestamp === commandTimestamp
                          ? { ...item, output: lines }
                          : item
                      )
                      return { ...tab, history: updatedHistory }
                    }
                    return tab
                  }))
                },
                updateStyledHistory: (lines: { text: string; color: string }[][]) => {
                  setTabs(prevTabs => prevTabs.map(tab => {
                    if (tab.id === activeTabId) {
                      const updatedHistory = tab.history.map(item =>
                        item.timestamp === commandTimestamp
                          ? { ...item, styledOutput: lines }
                          : item
                      )
                      return { ...tab, history: updatedHistory }
                    }
                    return tab
                  }))
                },
                addHistoryLinks: (links: { text: string; url: string }[]) => {
                  setTabs(prevTabs => prevTabs.map(tab => {
                    if (tab.id === activeTabId) {
                      const updatedHistory = tab.history.map(item =>
                        item.timestamp === commandTimestamp
                          ? { ...item, links }
                          : item
                      )
                      return { ...tab, history: updatedHistory }
                    }
                    return tab
                  }))
                },
                signTransaction: async (tx: TransactionRequest) => {
                  const { sendTransaction } = await import('wagmi/actions')
                  const { config } = await import('@/lib/wagmi-config')
                  return sendTransaction(config, tx)
                },
                signTypedData: async (typedData: TypedDataPayload) => {
                  const { signTypedData } = await import('wagmi/actions')
                  const { config } = await import('@/lib/wagmi-config')
                  return signTypedData(config, typedData)
                },
                sendTransaction: async (tx: TransactionRequest) => {
                  const { sendTransaction } = await import('wagmi/actions')
                  const { config } = await import('@/lib/wagmi-config')
                  return sendTransaction(config, tx)
                },
                activeTabId,
                walletAddress: executionContext.wallet.address,
                chainId: executionContext.wallet.chainId || undefined,
              }

              // Execute the handler
              await handler(result.value, { ...executionContext, ...cliContext })

              // Update command history
              updateTabHistory((() => {
                const newHistory = [...commandHistory, trimmedInput]
                if (newHistory.length > MAX_COMMAND_HISTORY) {
                  return newHistory.slice(-MAX_COMMAND_HISTORY)
                }
                return newHistory
              })())
              updateTabInput("")
              updateTabHistoryIndex(-1)
              return
            }
          }
          else {
            // Normal formatting
            output = formatCommandResult(result)
          }
        } else {
          // Format output
          output = formatCommandResult(result)
        }

        // Update execution context
        const updatedContext = updateExecutionContext(
          executionContext,
          resolved.command,
          args,
          result,
          resolved.protocol
        )
        console.log('[executeCommand] Before update - context.activeProtocol:', executionContext.activeProtocol)
        console.log('[executeCommand] After update - updatedContext.activeProtocol:', updatedContext.activeProtocol)
        console.log('[executeCommand] Setting new execution context...')

        // Update the active tab's execution context
        setTabs(prevTabs => prevTabs.map(tab =>
          tab.id === activeTabId
            ? { ...tab, executionContext: updatedContext }
            : tab
        ))

        // Handle clear command
        if (output.length === 0 && result.success && 'cleared' in (result.value as object)) {
          setTabs(prevTabs => prevTabs.map(tab =>
            tab.id === activeTabId ? { ...tab, history: [] } : tab
          ))
          updateTabInput("")
          updateTabHistoryIndex(-1)
          return
        }
      } catch (error) {
        output = [`Error executing command: ${error instanceof Error ? error.message : String(error)}`]
      }
    }

    const newHistoryItem: HistoryItem = {
      command: trimmedInput,
      output,
      timestamp: new Date(),
      prompt: String(prompt) // Ensure we store a string value, not a reference
    }

    setTabs(prevTabs => prevTabs.map(tab =>
      tab.id === activeTabId
        ? { ...tab, history: [...tab.history, newHistoryItem] }
        : tab
    ))

    // Add to command history with sliding window
    updateTabHistory((() => {
      const newHistory = [...commandHistory, trimmedInput]
      // Keep only the last MAX_COMMAND_HISTORY commands
      if (newHistory.length > MAX_COMMAND_HISTORY) {
        return newHistory.slice(-MAX_COMMAND_HISTORY)
      }
      return newHistory
    })())

    updateTabHistoryIndex(-1)
    } finally {
      // Clear input and release the execution lock
      updateTabInput("")
      setIsExecuting(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    // Handle fuzzy match navigation
    if (fuzzyMatches.length > 0) {
      if (e.key === "ArrowUp") {
        e.preventDefault()
        setSelectedMatchIndex((prev) => Math.max(0, prev - 1))
        return
      } else if (e.key === "ArrowDown") {
        e.preventDefault()
        setSelectedMatchIndex((prev) => Math.min(fuzzyMatches.length - 1, prev + 1))
        return
      } else if (e.key === "Tab" || e.key === "Enter") {
        e.preventDefault()
        updateTabInput(fuzzyMatches[selectedMatchIndex])
        setFuzzyMatches([])
        setSelectedMatchIndex(0)
        if (e.key === "Enter") {
          executeCommand(fuzzyMatches[selectedMatchIndex])
        }
        return
      } else if (e.key === "Escape") {
        e.preventDefault()
        setFuzzyMatches([])
        setSelectedMatchIndex(0)
        return
      }
    }

    if (e.key === "Enter") {
      executeCommand(currentInput)
      setFuzzyMatches([])
      setSelectedMatchIndex(0)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        updateTabHistoryIndex(newIndex)
        updateTabInput(commandHistory[newIndex])
        setFuzzyMatches([])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          updateTabHistoryIndex(-1)
          updateTabInput("")
        } else {
          updateTabHistoryIndex(newIndex)
          updateTabInput(commandHistory[newIndex])
        }
        setFuzzyMatches([])
      }
    } else if (e.key === "Tab") {
      e.preventDefault()

      if (!currentInput.trim() || !executionContext) return

      // Use ρ_f (fuzzy resolver) for autocomplete
      const fuzzyResults = registry.ρ_f(
        {
          input: currentInput,
          preferences: {
            defaults: executionContext.protocolPreferences,
            priority: [],
          },
          executionContext,
        },
        0.3 // Lower threshold for more suggestions
      )

      if (fuzzyResults.length === 0) {
        // No matches
        setFuzzyMatches([])
      } else {
        // Always show suggestions menu (even for single match)
        // Deduplicate matches (in case aliases match the same command)
        const matches = Array.from(new Set(fuzzyResults.map(r => r.command.id)))
        setFuzzyMatches(matches)
        setSelectedMatchIndex(0)
      }
    }
  }

  const handleTerminalClick = () => {
    // Only focus input if user isn't selecting text
    const selection = window.getSelection()
    if (!selection || selection.toString().length === 0) {
      if (inputRef.current) {
        inputRef.current.focus()
      }
    }
  }

  if (!mounted) {
    return null
  }

  return (
    <div className={`w-full h-full bg-[#0A0A0A] p-2 md:p-4 flex flex-col relative overflow-hidden`}>
            <div className="h-full bg-[#141414] rounded-xl border border-[#262626] flex flex-col overflow-hidden">
              {/* Window Management Bar with Tabs */}
              <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center gap-2 rounded-t-xl flex-shrink-0">
                {tabs.map(tab => {
                  // Get protocol color if tab is in a protocol fiber
                  const protocolColor = tab.name !== 'defi' && PROTOCOL_COLORS[tab.name]
                    ? PROTOCOL_COLORS[tab.name]
                    : undefined

                  return (
                    <div
                      key={tab.id}
                      className={`flex items-center gap-2 px-2 py-1 md:px-3 md:py-1.5 rounded-md cursor-pointer transition-colors ${
                        activeTabId === tab.id
                          ? "bg-[#262626]"
                          : "hover:bg-[#242424]"
                      }`}
                      style={{
                        color: activeTabId === tab.id && protocolColor
                          ? protocolColor
                          : activeTabId === tab.id
                            ? 'white'
                            : protocolColor
                              ? `${protocolColor}88` // Add opacity for inactive tabs
                              : '#737373'
                      }}
                      onClick={() => {
                        console.log(`[Tab Switch] Clicked tab ${tab.id} (${tab.name})`)
                        console.log(`[Tab Switch] Current activeTabId: ${activeTabId}`)
                        console.log(`[Tab Switch] All tabs:`, tabs.map(t => ({ id: t.id, name: t.name })))
                        if (activeTabId !== tab.id) {
                          console.log(`[Tab Switch] Switching from ${activeTabId} to ${tab.id}`)
                          setActiveTabId(tab.id)
                        } else {
                          console.log(`[Tab Switch] Already on tab ${tab.id}, no action needed`)
                        }
                      }}
                    >
                      <span
                        className="text-xs md:text-sm"
                      >
                        {tab.name}
                      </span>
                      {tabs.length > 1 && (
                        <button
                          onClick={(e) => {
                            console.log('[Close Button] Clicked close button for tab:', tab.id)
                            e.stopPropagation()
                            closeTab(tab.id)
                          }}
                          className="hover:text-red-400 transition-colors"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  )
                })}
                <button
                  onClick={addNewTab}
                  className="flex items-center justify-center w-7 h-7 rounded-md hover:bg-[#262626] text-[#737373] hover:text-white transition-colors"
                >
                  <Plus className="w-4 h-4" />
                </button>
                <div className="ml-auto flex items-center gap-2">
                  <button
                    onClick={() => setShowSettings(!showSettings)}
                    className="p-1.5 text-[#737373] hover:text-white transition-colors"
                  >
                    <ChevronDown className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Terminal Content */}
              <div
                ref={terminalRef}
                className={`flex-1 font-mono overflow-y-scroll select-text min-h-0 text-xs md:text-sm p-3 md:p-6 pr-3 md:pr-4 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#0A0A0A] [&::-webkit-scrollbar-thumb]:bg-[#404040] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-[#525252]`}
                style={{ fontSize: `${fontSize}px` }}
                onClick={handleTerminalClick}
              >
                {/* Command History */}
                {history.map((item, index) => (
                  <div key={index} className="mb-2">
                    {item.command !== "welcome" && (
                      <div className="flex select-text">
                        <span className="text-white-400">
                          {(item.prompt || prompt).split('@')[0]}
                          <span className="font-semibold">@</span>
                          <span
                            className="font-semibold"
                            style={{
                              color: PROTOCOL_COLORS[(item.prompt || prompt).split('@')[1]?.replace('>', '')] || '#d1d5db'
                            }}
                          >
                            {(item.prompt || prompt).split('@')[1]}
                          </span>
                        </span>
                        <span className="text-whiteMa-400 ml-2 font-semibold">{item.command}</span>
                      </div>
                    )}
                    {/* Styled output (if available) */}
                    {item.styledOutput ? (
                      item.styledOutput.map((line, lineIndex) => (
                        <p key={`styled-${lineIndex}`} className="mt-1 select-text whitespace-pre-wrap">
                          {line.map((segment, segIndex) => (
                            <span
                              key={`seg-${segIndex}`}
                              style={{ color: segment.color || '#d1d5db' }}
                              className={segment.bold ? 'font-bold' : ''}
                            >
                              {segment.text}
                            </span>
                          ))}
                        </p>
                      ))
                    ) : (
                      item.output.map((line, lineIndex) => (
                        <p key={lineIndex} className="mt-1 text-gray-300 select-text whitespace-pre-wrap">
                          {line}
                        </p>
                      ))
                    )}
                    {item.links && item.links.length > 0 && (
                      <div className="mt-1">
                        {item.links.map((link, linkIndex) => (
                          <a
                            key={linkIndex}
                            href={link.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 underline select-text block ml-2"
                          >
                            {link.text}
                          </a>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {/* Current Input - sticky on mobile */}
                <div className="relative md:static sticky bottom-0 bg-[#141414] md:bg-transparent backdrop-blur-sm md:backdrop-blur-none -mx-3 md:mx-0 px-3 md:px-0 py-2 md:py-0">
                  <div className={`flex items-center bg-[#1a1a1a] pl-1 pr-2 py-1 rounded ${isExecuting ? 'opacity-60' : ''}`}>
                    <span className="text-gray-100">
                      {prompt.split('@')[0]}
                      <span className="font-semibold">@</span>
                      <span
                        className="font-semibold"
                        style={{
                          color: PROTOCOL_COLORS[prompt.split('@')[1]?.replace('>', '')] || '#d1d5db'
                        }}
                      >
                        {prompt.split('@')[1]}
                      </span>
                    </span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={currentInput}
                      onChange={(e) => updateTabInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      disabled={isExecuting}
                      className="bg-transparent border-none text-gray-100 focus:ring-0 flex-grow ml-2 p-0 font-mono outline-none caret-gray-400 font-bold disabled:cursor-not-allowed"
                      style={{ fontSize: `${fontSize}px` }}
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>

                  {/* Fuzzy match suggestions - only show when not executing */}
                  {!isExecuting && fuzzyMatches.length > 0 && (
                    <div className="absolute bottom-full left-0 mb-1 bg-[#1a1a1a] border border-[#262626] rounded-md shadow-lg max-h-48 overflow-y-auto z-10">
                      {fuzzyMatches.map((match, index) => (
                        <div
                          key={`fuzzy-${index}`}
                          className={`px-3 py-1.5 font-mono cursor-pointer ${
                            index === selectedMatchIndex
                              ? 'bg-[#262626] text-yellow-400'
                              : 'text-gray-300 hover:bg-[#202020]'
                          }`}
                          style={{ fontSize: `${fontSize}px` }}
                          onClick={() => {
                            updateTabInput(match)
                            setFuzzyMatches([])
                            setSelectedMatchIndex(0)
                          }}
                        >
                          {match}
                        </div>
                      ))}
                      <div className="px-3 py-1 text-xs text-gray-500 border-t border-[#262626]">
                        ↑↓ navigate • Tab/Enter select • Esc cancel
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Settings Panel */}
              {showSettings && (
                <div ref={settingsRef} className="absolute top-24 right-12 bg-black/40 backdrop-blur-sm border border-white/10 rounded-lg px-6 py-4 z-20">
                  <div className="w-80 space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-white/50 text-sm">
                        Text Size
                      </label>
                      <span className="text-white/70 text-sm">{fontSize}px</span>
                    </div>
                    <input
                      type="range"
                      min="15"
                      max="32"
                      value={fontSize}
                      onChange={(e) => setFontSize(Number(e.target.value))}
                      className="w-full h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white/70"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>
  )
}
