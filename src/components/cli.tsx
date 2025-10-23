"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { Terminal as TerminalIcon, Settings, Plus, X, Bell, Zap, BarChart3, BookOpen, ChevronDown } from "lucide-react"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useEnsName, useBalance } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { formatUnits, encodeFunctionData, erc20Abi } from 'viem'
import { registry, registerCoreCommands, createExecutionContext, updateExecutionContext } from "@/core"
import type { ExecutionContext, CommandResult } from "@/core"
import { pluginLoader } from "@/plugins/plugin-loader"
import { oneInchPlugin } from "@/plugins/1inch"
import { stargatePlugin } from "@/plugins/stargate"
import { wormholePlugin } from "@/plugins/wormhole"
import { lifiPlugin } from "@/plugins/lifi"
import { aaveV3Plugin } from "@/plugins/aave-v3"
import { getChainName } from "@/lib/lifi"
import { getTxUrl } from "@/lib/explorers"

interface HistoryItem {
  command: string
  output: string[]
  timestamp: Date
  links?: { text: string; url: string }[] // Optional links to render
}

interface TerminalTab {
  id: string
  name: string
  history: HistoryItem[]
  executionContext: ExecutionContext
}

const MAX_COMMAND_HISTORY = 1000 // Maximum commands to keep in history

// Protocol color mapping
const PROTOCOL_COLORS: Record<string, string> = {
  stargate: '#0FB983',
  '1inch': '#94A6FF',
  wormhole: '#FF6B9D',
  lifi: '#A855F7',
  'aave-v3': '#2F7CF6',
  // Add more protocols here as needed
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
      const helpOutput = value as any
      const lines: string[] = [helpOutput.message as string, '']

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
        return value.map((item: any) => `  ${item.command}`)
      }

      // Handle protocols list (has id, name, commandCount)
      if ('id' in firstItem && 'commandCount' in firstItem) {
        return value.map((item: any) => {
          return `  ${item.id.padEnd(15)} ${item.name || ''} ${item.description ? `- ${item.description}` : ''} ${item.commandCount !== undefined ? `(${item.commandCount} commands)` : ''}`
        })
      }

      // Handle generic arrays
      return value.map((item: any) => JSON.stringify(item, null, 2))
    }

    // Handle empty arrays
    if (Array.isArray(value)) {
      return []
    }

    // Handle 1inch token price
    if ('tokenPrice' in value) {
      const priceData = value as any
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
      const formattedPrice = priceInUsd.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })

      return [
        `${tokenSymbol} ${priceData.token.toUpperCase()} Price:`,
        `  Price: $${formattedPrice} USD`,
        `  Network: ${networkName}`,
        `  Address: ${priceData.tokenAddress}`,
      ]
    }

    // Handle 1inch gas prices
    if ('gasPrices' in value) {
      const gasData = value as any
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
      const swapData = value as any
      return [
        `📊 Swap Quote:`,
        `  ${swapData.fromToken.toUpperCase()} → ${swapData.toToken.toUpperCase()}`,
        `  Input: ${swapData.amountIn}`,
        `  Output: ${swapData.amountOut}`,
        `  Gas: ${swapData.gas || 'estimating...'}`,
        `  Slippage: ${swapData.slippage}%`,
        ``,
        `⚠️  Swap execution not yet implemented - coming soon!`,
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
  onAddChart?: (chartType: string, chartMode?: 'candlestick' | 'line') => void
}

export function CLI({ className = '', isFullWidth = false, onAddChart }: CLIProps = {}) {
  const [mounted, setMounted] = useState(false)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>("")
  const [currentInput, setCurrentInput] = useState("")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showSettings, setShowSettings] = useState(false)
  const [showSettingsPage, setShowSettingsPage] = useState(false)
  const [showDocsPage, setShowDocsPage] = useState(false)
  const [fontSize, setFontSize] = useState(15)
  const [fuzzyMatches, setFuzzyMatches] = useState<string[]>([])
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0)
  const [isExecuting, setIsExecuting] = useState(false)
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

    // Load 1inch plugin
    pluginLoader.loadPlugin(oneInchPlugin, undefined, context).then(result => {
      if (result.success) {
        console.log('1inch plugin loaded successfully')
      } else {
        console.error('Failed to load 1inch plugin:', result.error)
      }
    })

    // Load Stargate plugin
    pluginLoader.loadPlugin(stargatePlugin, undefined, context).then(result => {
      if (result.success) {
        console.log('Stargate plugin loaded successfully')
      } else {
        console.error('Failed to load Stargate plugin:', result.error)
      }
    })

    // Load Wormhole plugin
    pluginLoader.loadPlugin(wormholePlugin, undefined, context).then(result => {
      if (result.success) {
        console.log('Wormhole plugin loaded successfully')
      } else {
        console.error('Failed to load Wormhole plugin:', result.error)
      }
    })

    // Load LiFi plugin
    pluginLoader.loadPlugin(lifiPlugin, undefined, context).then(result => {
      if (result.success) {
        console.log('LiFi plugin loaded successfully')
      } else {
        console.error('Failed to load LiFi plugin:', result.error)
      }
    })

    // Load Aave v3 plugin
    pluginLoader.loadPlugin(aaveV3Plugin, undefined, context).then(result => {
      if (result.success) {
        console.log('Aave v3 plugin loaded successfully')
      } else {
        console.error('Failed to load Aave v3 plugin:', result.error)
      }
    })

    // Load command history from localStorage
    const savedHistory = localStorage.getItem('defi-terminal-command-history')
    if (savedHistory) {
      try {
        const parsed = JSON.parse(savedHistory)
        if (Array.isArray(parsed)) {
          // Apply sliding window in case saved history exceeds limit
          const limitedHistory = parsed.length > MAX_COMMAND_HISTORY
            ? parsed.slice(-MAX_COMMAND_HISTORY)
            : parsed
          setCommandHistory(limitedHistory)
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
          output: ["Welcome to The DeFi Terminal. Type 'help' to see available commands."],
          timestamp: new Date()
        }
      ],
      executionContext: context
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

  // Save command history to localStorage whenever it changes
  useEffect(() => {
    if (mounted) {
      localStorage.setItem('defi-terminal-command-history', JSON.stringify(commandHistory))
    }
  }, [commandHistory, mounted])

  // Sync wallet state to execution context
  useEffect(() => {
    if (executionContext && activeTabId) {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId, isConnected, isConnecting])

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

    const newTab: TerminalTab = {
      id: newId,
      name: "defi",
      history: [
        {
          command: "welcome",
          output: ["Welcome to The DeFi Terminal. Type 'help' to see available commands."],
          timestamp: new Date()
        }
      ],
      executionContext: newContext
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

    setIsExecuting(true)

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
            const chartData = result.value as { addChart: boolean; chartType: string; chartMode?: 'candlestick' | 'line' }

            if (onAddChart) {
              onAddChart(chartData.chartType, chartData.chartMode)
              output = [`✅ Added ${chartData.chartType} chart to analytics panel`]
            } else {
              output = [`⚠️  Chart panel not available`]
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
              timestamp: transferTimestamp
            }

            setTabs(tabs.map(tab =>
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
            setCommandHistory(prev => {
              const newHistory = [...prev, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })
            setCurrentInput("")
            setHistoryIndex(-1)
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
              timestamp: balanceTimestamp
            }

            setTabs(tabs.map(tab =>
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
            setCommandHistory(prev => {
              const newHistory = [...prev, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })
            setCurrentInput("")
            setHistoryIndex(-1)
            return
          }
          // Handle swap command - execute swap transaction
          else if (resolved.command.id === 'swap' && resolved.protocol === '1inch' && 'swapRequest' in result.value) {
            const swapData = result.value as any

            // Show preparing swap message
            output = [
              `📊 Swap Quote:`,
              `  ${swapData.fromToken.toUpperCase()} → ${swapData.toToken.toUpperCase()}`,
              `  Input: ${swapData.amountIn}`,
              `  Output: ${swapData.amountOut}`,
              `  Gas: ${swapData.gas}`,
              `  Slippage: ${swapData.slippage}%`,
              ``,
              `⏳ Checking token approval...`,
            ]

            const swapTimestamp = new Date()
            const tempHistoryItem: HistoryItem = {
              command: trimmedInput,
              output,
              timestamp: swapTimestamp
            }

            setTabs(tabs.map(tab =>
              tab.id === activeTabId
                ? { ...tab, history: [...tab.history, tempHistoryItem] }
                : tab
            ))

            // Helper function to update history
            const updateHistory = (lines: string[]) => {
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === swapTimestamp
                      ? { ...item, output: lines }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            }

            // Execute swap flow with approval check
            try {
              const { sendTransaction } = await import('wagmi/actions')
              const { config } = await import('@/lib/wagmi-config')

              // Skip allowance check for native ETH
              const isNativeEth = swapData.srcAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

              if (!isNativeEth) {
                // Check allowance
                const allowanceResponse = await fetch(
                  `/api/1inch/swap/allowance?chainId=${swapData.chainId}&tokenAddress=${swapData.srcAddress}&walletAddress=${swapData.walletAddress}`
                )

                if (!allowanceResponse.ok) {
                  throw new Error('Failed to check token allowance')
                }

                const allowanceData = await allowanceResponse.json()
                const allowance = BigInt(allowanceData.allowance || '0')
                const requiredAmount = BigInt(swapData.amount)

                // If allowance is insufficient, request approval
                if (allowance < requiredAmount) {
                  updateHistory([
                    `📊 Swap Quote:`,
                    `  ${swapData.fromToken.toUpperCase()} → ${swapData.toToken.toUpperCase()}`,
                    `  Input: ${swapData.amountIn}`,
                    `  Output: ${swapData.amountOut}`,
                    `  Gas: ${swapData.gas}`,
                    `  Slippage: ${swapData.slippage}%`,
                    ``,
                    `⚠️  Insufficient allowance`,
                    `  Current: ${allowance.toString()}`,
                    `  Required: ${requiredAmount.toString()}`,
                    ``,
                    `📝 Requesting token approval...`,
                  ])

                  // Get approve transaction for the exact swap amount
                  const approveResponse = await fetch(
                    `/api/1inch/swap/approve/transaction?chainId=${swapData.chainId}&tokenAddress=${swapData.srcAddress}&amount=${swapData.amount}`
                  )

                  if (!approveResponse.ok) {
                    throw new Error('Failed to get approval transaction')
                  }

                  const approveTx = await approveResponse.json()

                  console.log('[Swap] Approval transaction data:', approveTx)

                  // Send approval transaction
                  const approveHash = await sendTransaction(config, {
                    to: approveTx.to as `0x${string}`,
                    data: approveTx.data as `0x${string}`,
                    value: BigInt(0),
                    gas: approveTx.gas ? BigInt(approveTx.gas) : approveTx.gasLimit ? BigInt(approveTx.gasLimit) : undefined,
                  })

                  console.log('[Swap] Approval transaction hash:', approveHash)

                  updateHistory([
                    `📊 Swap Quote:`,
                    `  ${swapData.fromToken.toUpperCase()} → ${swapData.toToken.toUpperCase()}`,
                    `  Input: ${swapData.amountIn}`,
                    `  Output: ${swapData.amountOut}`,
                    `  Gas: ${swapData.gas}`,
                    `  Slippage: ${swapData.slippage}%`,
                    ``,
                    `✅ Token approved!`,
                    `  Approval Tx: ${approveHash}`,
                    ``,
                    `⏳ Executing swap...`,
                  ])
                }
              }

              // Now execute the swap
              const swapResponse = await fetch(
                `/api/1inch/swap/classic/swap?chainId=${swapData.chainId}&src=${swapData.srcAddress}&dst=${swapData.dstAddress}&amount=${swapData.amount}&from=${swapData.walletAddress}&slippage=${swapData.slippage}`
              )

              if (!swapResponse.ok) {
                const errorData = await swapResponse.json()
                throw new Error(errorData.error || 'Failed to get swap transaction')
              }

              const swapTx = await swapResponse.json()

              // Send the swap transaction
              const hash = await sendTransaction(config, {
                to: swapTx.tx.to as `0x${string}`,
                data: swapTx.tx.data as `0x${string}`,
                value: BigInt(swapTx.tx.value || '0'),
                gas: BigInt(swapTx.tx.gas || '0'),
              })

              // Update with success
              updateHistory([
                `✅ Swap executed successfully!`,
                `  ${swapData.fromToken.toUpperCase()} → ${swapData.toToken.toUpperCase()}`,
                `  Input: ${swapData.amountIn}`,
                `  Output: ${swapData.amountOut}`,
                `  Tx Hash: ${hash}`,
              ])
            } catch (error) {
              // Update with error
              const errorMsg = error instanceof Error ? error.message : String(error)
              updateHistory([`❌ Swap failed: ${errorMsg}`])
            }

            setCommandHistory(prev => {
              const newHistory = [...prev, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })
            setCurrentInput("")
            setHistoryIndex(-1)
            return
          }
          // Handle limit order command - create limit order on 1inch orderbook
          else if (resolved.command.id === 'limitorder' && resolved.protocol === '1inch' && 'limitOrderRequest' in result.value) {
            const limitOrderData = result.value as any

            // Show creating limit order message
            output = [
              `📝 Creating Limit Order:`,
              `  ${limitOrderData.fromToken.toUpperCase()} → ${limitOrderData.toToken.toUpperCase()}`,
              `  Amount: ${limitOrderData.amount}`,
              `  Rate: ${limitOrderData.rate}`,
              ``,
              `⏳ Preparing order...`,
            ]

            const limitOrderTimestamp = new Date()
            const tempHistoryItem: HistoryItem = {
              command: trimmedInput,
              output,
              timestamp: limitOrderTimestamp
            }

            setTabs(tabs.map(tab =>
              tab.id === activeTabId
                ? { ...tab, history: [...tab.history, tempHistoryItem] }
                : tab
            ))

            // Helper function to update history
            const updateHistory = (lines: string[]) => {
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === limitOrderTimestamp
                      ? { ...item, output: lines }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            }

            // Execute limit order flow
            try {
              const { signTypedData } = await import('wagmi/actions')
              const { config } = await import('@/lib/wagmi-config')

              // Call create endpoint to get EIP-712 typed data
              const createResponse = await fetch('/api/1inch/orderbook/limit/create', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  fromChainId: limitOrderData.chainId,
                  fromToken: {
                    address: limitOrderData.fromAddress,
                    decimals: limitOrderData.fromDecimals,
                  },
                  toToken: {
                    address: limitOrderData.toAddress,
                    decimals: limitOrderData.toDecimals,
                  },
                  amount: limitOrderData.amount,
                  price: limitOrderData.rate,
                  userAddress: limitOrderData.walletAddress,
                }),
              })

              if (!createResponse.ok) {
                const errorData = await createResponse.json()
                throw new Error(errorData.error || 'Failed to create limit order')
              }

              const orderData = await createResponse.json()

              updateHistory([
                `📝 Creating Limit Order:`,
                `  ${limitOrderData.fromToken.toUpperCase()} → ${limitOrderData.toToken.toUpperCase()}`,
                `  Amount: ${limitOrderData.amount}`,
                `  Rate: ${limitOrderData.rate}`,
                ``,
                `✍️  Requesting signature...`,
              ])

              // Sign the order with EIP-712 (off-chain signature, no gas)
              const signature = await signTypedData(config, orderData.typedData)

              console.log('[LimitOrder] Signature:', signature)

              updateHistory([
                `📝 Creating Limit Order:`,
                `  ${limitOrderData.fromToken.toUpperCase()} → ${limitOrderData.toToken.toUpperCase()}`,
                `  Amount: ${limitOrderData.amount}`,
                `  Rate: ${limitOrderData.rate}`,
                ``,
                `⏳ Submitting order to 1inch orderbook...`,
              ])

              // Submit the signed order to 1inch orderbook
              const submitResponse = await fetch('/api/1inch/orderbook/limit/submit', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  fromChainId: orderData.fromChainId,
                  build: orderData.build,
                  extension: orderData.extension,
                  signature,
                }),
              })

              if (!submitResponse.ok) {
                const errorData = await submitResponse.json()
                throw new Error(errorData.error || 'Failed to submit limit order')
              }

              await submitResponse.json()

              // Update with success (no tx hash for limit orders)
              updateHistory([
                `✅ Limit Order Created!`,
                `  ${limitOrderData.fromToken.toUpperCase()} → ${limitOrderData.toToken.toUpperCase()}`,
                `  Amount: ${limitOrderData.amount}`,
                `  Rate: ${limitOrderData.rate}`,
                ``,
                `📋 Order placed on 1inch orderbook`,
                `  The order will execute when the target rate is reached`,
              ])
            } catch (error) {
              // Update with error
              const errorMsg = error instanceof Error ? error.message : String(error)
              updateHistory([`❌ Limit order failed: ${errorMsg}`])
            }

            setCommandHistory(prev => {
              const newHistory = [...prev, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })
            setCurrentInput("")
            setHistoryIndex(-1)
            return
          }
          // Handle bridge command - execute LiFi route
          // Handle bridge command - execute cross-chain bridge via Stargate
          else if (resolved.command.id === 'bridge' && resolved.protocol === 'stargate' && 'bridgeRequest' in result.value) {
            const bridgeData = result.value as any

            // Get chain names for display
            const chainNames: Record<number, string> = {
              1: 'Ethereum',
              10: 'Optimism',
              137: 'Polygon',
              42161: 'Arbitrum',
              8453: 'Base',
              56: 'BSC',
              43114: 'Avalanche',
            }
            const fromChainName = chainNames[bridgeData.fromChain] || `Chain ${bridgeData.fromChain}`
            const toChainName = chainNames[bridgeData.toChain] || `Chain ${bridgeData.toChain}`

            // Show bridge quote
            output = [
              `🌉 Bridge Quote:`,
              `  ${fromChainName} → ${toChainName}`,
              `  Token: ${bridgeData.fromToken.toUpperCase()}`,
              `  Amount: ${bridgeData.amountIn}`,
              `  Receive: ${bridgeData.amountOut}`,
              `  Slippage: ${bridgeData.slippage}%`,
              ``,
              `⏳ Executing bridge...`,
            ]

            const bridgeTimestamp = new Date()
            const tempHistoryItem: HistoryItem = {
              command: trimmedInput,
              output,
              timestamp: bridgeTimestamp
            }

            setTabs(tabs.map(tab =>
              tab.id === activeTabId
                ? { ...tab, history: [...tab.history, tempHistoryItem] }
                : tab
            ))

            // Helper function to update history
            const updateHistory = (lines: string[], links?: { text: string; url: string }[]) => {
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === bridgeTimestamp
                      ? { ...item, output: lines, links }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            }

            // Execute bridge flow - iterate through Stargate steps
            try {
              const { sendTransaction } = await import('wagmi/actions')
              const { config } = await import('@/lib/wagmi-config')

              const stargateSteps = bridgeData.stargateSteps || []
              const txHashes: string[] = []

              if (!stargateSteps.length) {
                throw new Error('No bridge steps received from Stargate')
              }

              // Execute each step sequentially (approval + bridge)
              for (let i = 0; i < stargateSteps.length; i++) {
                const step = stargateSteps[i]
                const stepNumber = i + 1

                updateHistory([
                  `🌉 Bridge Quote:`,
                  `  ${fromChainName} → ${toChainName}`,
                  `  Token: ${bridgeData.fromToken.toUpperCase()}`,
                  `  Amount: ${bridgeData.amountIn}`,
                  ``,
                  `⏳ Executing step ${stepNumber}/${stargateSteps.length}: ${step.type}...`,
                ])

                if (!step.transaction) {
                  console.warn(`Step ${stepNumber} has no transaction data, skipping`)
                  continue
                }

                const tx = step.transaction
                const txHash = await sendTransaction(config, {
                  to: tx.to as `0x${string}`,
                  data: tx.data as `0x${string}`,
                  value: BigInt(tx.value || '0'),
                  gas: tx.gas ? BigInt(tx.gas) : tx.gasLimit ? BigInt(tx.gasLimit) : undefined,
                })

                txHashes.push(txHash)
                console.log(`[Bridge] Step ${stepNumber} tx hash:`, txHash)
              }

              // All steps complete - create LayerZeroScan link
              const lastTxHash = txHashes[txHashes.length - 1]
              const layerZeroScanLink = `https://layerzeroscan.com/tx/${lastTxHash}`

              updateHistory(
                [
                  `✅ Bridge executed successfully!`,
                  `  ${fromChainName} → ${toChainName}`,
                  `  Token: ${bridgeData.fromToken.toUpperCase()}`,
                  `  Amount: ${bridgeData.amountIn}`,
                  ``,
                  `Transaction Hashes:`,
                  ...txHashes.map((hash, idx) => `  Step ${idx + 1}: ${hash}`),
                  ``,
                  `🔍 Track on LayerZeroScan:`,
                ],
                [{ text: layerZeroScanLink, url: layerZeroScanLink }]
              )
            } catch (error) {
              // Update with error
              const errorMsg = error instanceof Error ? error.message : String(error)
              updateHistory([`❌ Bridge failed: ${errorMsg}`])
            }

            setCommandHistory(prev => {
              const newHistory = [...prev, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })
            setCurrentInput("")
            setHistoryIndex(-1)
            return
          }
          // Handle bridge command - execute cross-chain bridge via Wormhole
          else if (resolved.command.id === 'bridge' && resolved.protocol === 'wormhole' && 'wormholeBridgeRequest' in result.value) {
            const bridgeData = result.value as any

            // Get Wormhole chain names mapping
            const chainNames: Record<string, string> = {
              base: 'Base',
              arbitrum: 'Arbitrum',
              ethereum: 'Ethereum',
              optimism: 'Optimism',
              polygon: 'Polygon',
              bsc: 'BSC',
              avalanche: 'Avalanche',
            }
            const fromChainName = chainNames[bridgeData.fromChain] || bridgeData.fromChain
            const toChainName = chainNames[bridgeData.toChain] || bridgeData.toChain

            // Show initial message
            output = [
              bridgeData.message,
              ``,
              `Protocol: Wormhole`,
              `From: ${fromChainName}`,
              `To: ${toChainName}`,
              `Token: ${bridgeData.fromToken.toUpperCase()}${bridgeData.toToken && bridgeData.toToken !== bridgeData.fromToken ? ` → ${bridgeData.toToken.toUpperCase()}` : ''}`,
              `Amount: ${bridgeData.amount}`,
              ``,
              `⏳ Initializing Wormhole SDK...`,
            ]

            const wormholeTimestamp = new Date()
            const tempHistoryItem: HistoryItem = {
              command: trimmedInput,
              output,
              timestamp: wormholeTimestamp
            }

            setTabs(tabs.map(tab =>
              tab.id === activeTabId
                ? { ...tab, history: [...tab.history, tempHistoryItem] }
                : tab
            ))

            // Helper function to update history
            const updateHistory = (lines: string[], links?: { text: string; url: string }[]) => {
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === wormholeTimestamp
                      ? { ...item, output: lines, links }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            }

            // Execute Wormhole bridge flow - entirely client-side
            try {
              // Import Wormhole SDK and helpers
              const { routes, Wormhole } = await import('@wormhole-foundation/sdk')
              const { initWormholeSDK } = await import('@/lib/wormhole-sdk')
              const { getWormholeChainName, getChainIdFromName, resolveTokenAddress, formatETA, getRouteInfo } = await import('@/lib/wormhole')
              const { sendTransaction } = await import('wagmi/actions')
              const { config } = await import('@/lib/wagmi-config')

              // Get chain IDs
              const destChainId = getChainIdFromName(bridgeData.toChain)
              if (!destChainId) {
                throw new Error(`Unsupported destination chain: ${bridgeData.toChain}`)
              }

              updateHistory([
                bridgeData.message,
                ``,
                `Protocol: Wormhole`,
                `From: ${fromChainName}`,
                `To: ${toChainName}`,
                `Token: ${bridgeData.fromToken.toUpperCase()}`,
                `Amount: ${bridgeData.amount}`,
                ``,
                `⏳ Initializing Wormhole SDK...`,
              ])

              // Initialize Wormhole SDK using our helper that has static imports
              const wh = await initWormholeSDK()

              updateHistory([
                bridgeData.message,
                ``,
                `⏳ Finding optimal routes...`,
              ])

              // Get Wormhole chain names
              const sourceChain = getWormholeChainName(bridgeData.chainId)
              const destChain = getWormholeChainName(destChainId)

              if (!sourceChain || !destChain) {
                throw new Error('Invalid chain configuration')
              }

              // Resolve token addresses
              const fromTokenAddress = resolveTokenAddress(bridgeData.chainId, bridgeData.fromToken) || bridgeData.fromToken

              // Create resolver
              const resolver = wh.resolver([
                routes.AutomaticCCTPRoute,
                routes.CCTPRoute,
                routes.AutomaticTokenBridgeRoute,
                routes.TokenBridgeRoute,
              ])

              // Get chain contexts (cast to any to avoid TypeScript strict chain type)
              const srcChain = wh.getChain(sourceChain as any)
              const dstChain = wh.getChain(destChain as any)

              // Create token ID
              const isNative = fromTokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
              const tokenId = Wormhole.tokenId(srcChain.chain, isNative ? 'native' : fromTokenAddress)

              // Find supported destination tokens
              const destTokens = await resolver.supportedDestinationTokens(tokenId, srcChain, dstChain)

              if (!destTokens || destTokens.length === 0) {
                throw new Error(`No supported routes for ${bridgeData.fromToken}`)
              }

              // Parse sender and receiver addresses using Wormhole utility
              const senderAddr = Wormhole.parseAddress(srcChain.chain, bridgeData.walletAddress)
              const receiverAddr = Wormhole.parseAddress(dstChain.chain, bridgeData.receiver)

              // Create transfer request
              const transferRequest = await routes.RouteTransferRequest.create(wh, {
                source: tokenId,
                destination: destTokens[0],
              })

              // Set sender and receiver on the transfer request
              transferRequest.sender = senderAddr
              ;(transferRequest as any).receiver = receiverAddr

              // Find routes
              const foundRoutes = await resolver.findRoutes(transferRequest)

              if (!foundRoutes || foundRoutes.length === 0) {
                throw new Error('No routes available for this transfer')
              }

              updateHistory([
                bridgeData.message,
                ``,
                `⏳ Getting quote from ${foundRoutes[0].constructor.name}...`,
              ])

              // Get quote from best route
              const selectedRoute = foundRoutes[0]
              const transferParams = {
                amount: bridgeData.amount,
                options: { nativeGas: 0 }
              }

              const validated = await selectedRoute.validate(transferRequest, transferParams)
              if (!validated.valid) {
                const errorMsg = typeof validated.error === 'string' ? validated.error : validated.error?.message || 'Transfer validation failed'
                throw new Error(errorMsg)
              }

              const quote = await selectedRoute.quote(transferRequest, validated.params)

              if (!quote.success) {
                const errorMsg = typeof quote.error === 'string' ? quote.error : quote.error?.message || 'Failed to get quote'
                throw new Error(errorMsg)
              }

              const routeInfo = getRouteInfo(selectedRoute.constructor.name)
              const eta = quote.eta ? formatETA(quote.eta) : `~${routeInfo.estimatedTimeMinutes} min`

              // Format amounts for display
              const sourceAmount = quote.sourceToken?.amount
              const destAmount = quote.destinationToken?.amount
              const sourceDecimals = quote.sourceToken?.amount?.decimals || 6
              const destDecimals = quote.destinationToken?.amount?.decimals || 6

              const formatAmount = (amount: any, decimals: number) => {
                if (!amount?.amount) return bridgeData.amount
                const amountBigInt = BigInt(amount.amount)
                const divisor = BigInt(10 ** decimals)
                const wholePart = amountBigInt / divisor
                const remainder = amountBigInt % divisor

                // Format with decimals
                if (remainder === BigInt(0)) {
                  return wholePart.toString()
                }

                const decimalPart = remainder.toString().padStart(decimals, '0')
                // Trim trailing zeros from decimal part
                const trimmedDecimal = decimalPart.replace(/0+$/, '')
                return trimmedDecimal ? `${wholePart}.${trimmedDecimal}` : wholePart.toString()
              }

              const sourceAmountFormatted = sourceAmount ? formatAmount(sourceAmount, sourceDecimals) : bridgeData.amount
              const destAmountFormatted = destAmount ? formatAmount(destAmount, destDecimals) : bridgeData.amount

              // Get relay fee if present
              const relayFeeInfo = quote.relayFee ? `  Relay Fee: ${formatAmount(quote.relayFee.amount, quote.relayFee.amount.decimals)} ${(quote.relayFee.token as any)?.symbol || bridgeData.fromToken.toUpperCase()}` : null

              updateHistory([
                bridgeData.message,
                ``,
                `Protocol: Wormhole ${routeInfo.isAutomatic ? '(Automatic)' : '(Manual)'}`,
                `Route: ${routeInfo.name}`,
                `ETA: ${eta}`,
                ``,
                `From: ${fromChainName}`,
                `  Send: ${sourceAmountFormatted} ${bridgeData.fromToken.toUpperCase()}`,
                ``,
                `To: ${toChainName}`,
                `  Receive: ${destAmountFormatted} ${bridgeData.fromToken.toUpperCase()}`,
                ``,
                ...(relayFeeInfo ? [relayFeeInfo, ``] : []),
                `⏳ Preparing transactions...`,
              ])

              // Create a simple signer that uses wagmi's sendTransaction
              const simpleSigner = {
                chain: () => srcChain.chain,
                address: () => bridgeData.walletAddress,
                signAndSend: async (txs: any[]) => {
                  const txids: string[] = []
                  for (let i = 0; i < txs.length; i++) {
                    const txn = txs[i]
                    // Extract transaction and description from Wormhole SDK wrapper
                    const { transaction, description } = txn

                    const stepNum = i + 1
                    const totalSteps = txs.length

                    // Show transaction preview with quote details
                    updateHistory([
                      bridgeData.message,
                      ``,
                      `Protocol: Wormhole ${routeInfo.isAutomatic ? '(Automatic)' : '(Manual)'}`,
                      `Route: ${routeInfo.name}`,
                      `ETA: ${eta}`,
                      ``,
                      `From: ${fromChainName}`,
                      `  Send: ${sourceAmountFormatted} ${bridgeData.fromToken.toUpperCase()}`,
                      ``,
                      `To: ${toChainName}`,
                      `  Receive: ${destAmountFormatted} ${bridgeData.fromToken.toUpperCase()}`,
                      ``,
                      ...(relayFeeInfo ? [relayFeeInfo, ``] : []),
                      `📋 Transaction ${stepNum}/${totalSteps}: ${description}`,
                      `  Contract: ${transaction.to}`,
                      ``,
                      `⏳ Waiting for signature...`,
                    ])

                    const txHash = await sendTransaction(config, {
                      to: transaction.to as `0x${string}`,
                      data: transaction.data as `0x${string}`,
                      value: transaction.value ? BigInt(transaction.value) : BigInt(0),
                    })

                    txids.push(txHash)

                    // Show confirmation status with quote details
                    updateHistory([
                      bridgeData.message,
                      ``,
                      `Protocol: Wormhole ${routeInfo.isAutomatic ? '(Automatic)' : '(Manual)'}`,
                      `Route: ${routeInfo.name}`,
                      `ETA: ${eta}`,
                      ``,
                      `From: ${fromChainName}`,
                      `  Send: ${sourceAmountFormatted} ${bridgeData.fromToken.toUpperCase()}`,
                      ``,
                      `To: ${toChainName}`,
                      `  Receive: ${destAmountFormatted} ${bridgeData.fromToken.toUpperCase()}`,
                      ``,
                      ...(relayFeeInfo ? [relayFeeInfo, ``] : []),
                      `✅ Transaction ${stepNum}/${totalSteps} sent!`,
                      `  ${description}`,
                      `  Hash: ${txHash}`,
                      ``,
                      ...(stepNum < totalSteps ? [`⏳ Preparing next transaction...`] : [`⏳ Waiting for Wormhole to process...`]),
                    ])

                    // Small delay between transactions
                    if (stepNum < totalSteps) {
                      await new Promise(resolve => setTimeout(resolve, 1000))
                    }
                  }
                  return txids
                }
              }

              // Execute the transfer
              // Create ChainAddress with chain name string (from quote) and parsed receiver address
              const receiverChainAddress = {
                chain: quote.destinationToken.token.chain,
                address: (transferRequest as any).receiver
              }

              let receipt: any
              try {
                receipt = await selectedRoute.initiate(
                  transferRequest,
                  simpleSigner,
                  quote,
                  receiverChainAddress
                )
              } catch (error: any) {
                // If the error is about not finding the receipt, the transactions were still sent
                // The SDK just couldn't verify them immediately - this is OK for automatic routes
                if (error.message && error.message.includes('No receipt for')) {
                  const txHashMatch = error.message.match(/0x[a-fA-F0-9]{64}/)
                  const txHash = txHashMatch ? txHashMatch[0] : null

                  if (txHash) {
                    const wormholeScanLink = `https://wormholescan.io/#/tx/${txHash}?network=Mainnet`

                    updateHistory(
                      [
                        `✅ Bridge transactions submitted!`,
                        `  ${fromChainName} → ${toChainName}`,
                        `  Route: ${routeInfo.name} ${routeInfo.isAutomatic ? '(Automatic delivery)' : ''}`,
                        `  Token: ${bridgeData.fromToken.toUpperCase()}`,
                        `  Send: ${sourceAmountFormatted} → Receive: ~${destAmountFormatted}`,
                        `  ETA: ${eta}`,
                        ``,
                        `Transaction Hash: ${txHash}`,
                        ``,
                        `⚠️  Note: Wormhole is processing your transfer.`,
                        routeInfo.isAutomatic
                          ? `    Funds will arrive automatically at the destination.`
                          : `    You may need to manually redeem on the destination chain.`,
                        ``,
                        `🔍 Track on WormholeScan:`,
                      ],
                      [{ text: wormholeScanLink, url: wormholeScanLink }]
                    )

                    setCommandHistory(prev => {
                      const newHistory = [...prev, trimmedInput]
                      if (newHistory.length > MAX_COMMAND_HISTORY) {
                        return newHistory.slice(-MAX_COMMAND_HISTORY)
                      }
                      return newHistory
                    })
                    setCurrentInput("")
                    setHistoryIndex(-1)
                    return
                  }
                }
                // Re-throw if it's a different error
                throw error
              }

              // Extract transaction hashes from receipt
              const txHashes: string[] = []
              if (receipt.originTxs && Array.isArray(receipt.originTxs)) {
                for (const tx of receipt.originTxs) {
                  if (tx.txid) txHashes.push(tx.txid)
                }
              }

              // Fallback to direct tx hash if available
              if (txHashes.length === 0) {
                const txHash = (receipt as any).txid || (receipt as any).hash || 'unknown'
                if (txHash !== 'unknown') txHashes.push(txHash)
              }

              const lastTxHash = txHashes.length > 0 ? txHashes[txHashes.length - 1] : 'pending'
              const wormholeScanLink = `https://wormholescan.io/#/tx/${lastTxHash}?network=Mainnet`

              updateHistory(
                [
                  `✅ Bridge executed successfully!`,
                  `  ${fromChainName} → ${toChainName}`,
                  `  Route: ${routeInfo.name}`,
                  `  Token: ${bridgeData.fromToken.toUpperCase()}`,
                  `  Send: ${sourceAmountFormatted} → Receive: ~${destAmountFormatted}`,
                  `  ETA: ${eta}`,
                  ``,
                  txHashes.length > 0 ? `Transaction Hashes:` : `Transaction submitted`,
                  ...txHashes.map((hash: string, idx: number) => `  ${idx + 1}. ${hash}`),
                  ``,
                  `🔍 Track on WormholeScan:`,
                ],
                [{ text: wormholeScanLink, url: wormholeScanLink }]
              )
            } catch (error) {
              const errorMsg = error instanceof Error ? error.message : String(error)
              updateHistory([`❌ Bridge failed: ${errorMsg}`])
              console.error('[Wormhole Bridge] Error:', error)
            }

            setCommandHistory(prev => {
              const newHistory = [...prev, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })
            setCurrentInput("")
            setHistoryIndex(-1)
            return
          }
          // Handle bridge command - execute cross-chain bridge via LiFi
          else if (resolved.command.id === 'bridge' && resolved.protocol === 'lifi' && 'lifiTransferRequest' in result.value) {
            const bridgeData = result.value as any

            console.log('[LiFi Bridge] Bridge data received:', bridgeData)
            console.log('[LiFi Bridge] Steps array:', bridgeData.steps)
            console.log('[LiFi Bridge] Route:', bridgeData.route)

            // Get chain names for display
            const chainNames: Record<number, string> = {
              1: 'Ethereum',
              10: 'Optimism',
              137: 'Polygon',
              42161: 'Arbitrum',
              8453: 'Base',
              56: 'BSC',
              43114: 'Avalanche',
            }
            const fromChainName = chainNames[bridgeData.fromChain] || `Chain ${bridgeData.fromChain}`
            const toChainName = chainNames[bridgeData.toChain] || `Chain ${bridgeData.toChain}`

            // Show initial message
            output = [
              `🌉 LiFi Bridge Quote:`,
              `  ${fromChainName} → ${toChainName}`,
              `  Token: ${bridgeData.fromToken.toUpperCase()}${bridgeData.toToken && bridgeData.toToken !== bridgeData.fromToken ? ` → ${bridgeData.toToken.toUpperCase()}` : ''}`,
              `  Amount: ${bridgeData.amountIn}`,
              `  Estimated Receive: ${bridgeData.amountOut}`,
              `  Steps: ${bridgeData.steps.length}`,
              ``,
              `⏳ Executing LiFi bridge...`,
            ]

            const lifiTimestamp = new Date()
            const tempHistoryItem: HistoryItem = {
              command: trimmedInput,
              output,
              timestamp: lifiTimestamp
            }

            setTabs(tabs.map(tab =>
              tab.id === activeTabId
                ? { ...tab, history: [...tab.history, tempHistoryItem] }
                : tab
            ))

            // Helper function to update history
            const updateHistory = (lines: string[], links?: { text: string; url: string }[]) => {
              setTabs(prevTabs => prevTabs.map(tab => {
                if (tab.id === activeTabId) {
                  const updatedHistory = tab.history.map(item =>
                    item.timestamp === lifiTimestamp
                      ? { ...item, output: lines, links }
                      : item
                  )
                  return { ...tab, history: updatedHistory }
                }
                return tab
              }))
            }

            // Execute LiFi bridge flow using LiFi SDK
            try {
              const { executeRoute, createConfig, EVM } = await import('@lifi/sdk')
              const { getWalletClient, switchChain } = await import('wagmi/actions')
              const { config } = await import('@/lib/wagmi-config')

              const route = bridgeData.route
              const txHashes: string[] = []
              let txLink: string | null = null

              updateHistory([
                `🌉 LiFi Bridge Quote:`,
                `  ${fromChainName} → ${toChainName}`,
                `  Token: ${bridgeData.fromToken.toUpperCase()}${bridgeData.toToken && bridgeData.toToken !== bridgeData.fromToken ? ` → ${bridgeData.toToken.toUpperCase()}` : ''}`,
                `  Amount: ${bridgeData.amountIn}`,
                `  Estimated Receive: ${bridgeData.amountOut}`,
                ``,
                `⏳ Executing bridge via LiFi SDK...`,
              ])

              // Configure LiFi SDK with wagmi wallet provider
              createConfig({
                integrator: 'lifi-api',
                providers: [
                  EVM({
                    getWalletClient: async () => {
                      return await getWalletClient(config)
                    },
                    switchChain: async (chainId: number) => { //@ts-ignore sybau
                      await switchChain(config, { chainId })
                      return await getWalletClient(config)
                    },
                  }),
                ],
              })

              // Execute the route using LiFi SDK (handles approvals, multi-step execution, etc.)
              const executedRoute = await executeRoute(route, {
                infiniteApproval: false,

                updateRouteHook(updatedRoute: any) {
                  console.log('[LiFi Bridge] Route update:', updatedRoute)

                  // Extract transaction link and hashes
                  const internalTxLink = updatedRoute?.steps?.[0]?.execution?.internalTxLink
                  if (internalTxLink) {
                    txLink = internalTxLink
                  }

                  // Collect transaction hashes
                  updatedRoute?.steps?.forEach((step: any) => {
                    step?.execution?.process?.forEach((proc: any) => {
                      if (proc.txHash && !txHashes.includes(proc.txHash)) {
                        txHashes.push(proc.txHash)
                        updateHistory([
                          `🌉 LiFi Bridge:`,
                          `  ${fromChainName} → ${toChainName}`,
                          ``,
                          `✅ Transaction submitted`,
                          `  Tx Hash: ${proc.txHash}`,
                          ``,
                          `⏳ Waiting for confirmation...`,
                        ])
                      }
                    })
                  })
                },

                acceptExchangeRateUpdateHook(params: any) {
                  console.log('[LiFi Bridge] Exchange rate update:', params)
                  // Auto-accept rate updates
                  return Promise.resolve(true)
                },
              })

              console.log('[LiFi Bridge] Executed route:', executedRoute)

              // Get final transaction link
              const finalTxLink = txLink || executedRoute?.steps?.[0]?.execution?.internalTxLink
              const lifiExplorerLink = finalTxLink || (txHashes.length > 0 ? `https://li.quest/tx/${txHashes[txHashes.length - 1]}` : null)

              const successMessage = [
                `✅ LiFi bridge executed successfully!`,
                `  ${fromChainName} → ${toChainName}`,
                `  Token: ${bridgeData.fromToken.toUpperCase()}${bridgeData.toToken && bridgeData.toToken !== bridgeData.fromToken ? ` → ${bridgeData.toToken.toUpperCase()}` : ''}`,
                `  Amount: ${bridgeData.amountIn}`,
                `  Estimated Receive: ${bridgeData.amountOut}`,
              ]

              if (txHashes.length > 0) {
                successMessage.push(``, `Transaction Hashes:`)
                txHashes.forEach((hash, idx) => {
                  successMessage.push(`  ${idx + 1}. ${hash}`)
                })
              }

              if (lifiExplorerLink) {
                successMessage.push(``, `🔍 Track on LiFi Explorer:`)
                updateHistory(successMessage, [{ text: lifiExplorerLink, url: lifiExplorerLink }])
              } else {
                updateHistory(successMessage)
              }
            } catch (error) {
              // Update with error
              const errorMsg = error instanceof Error ? error.message : String(error)
              updateHistory([`❌ LiFi bridge failed: ${errorMsg}`])
              console.error('[LiFi Bridge] Error:', error)
            }

            setCommandHistory(prev => {
              const newHistory = [...prev, trimmedInput]
              if (newHistory.length > MAX_COMMAND_HISTORY) {
                return newHistory.slice(-MAX_COMMAND_HISTORY)
              }
              return newHistory
            })
            setCurrentInput("")
            setHistoryIndex(-1)
            return
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
        if (output.length === 0 && result.success && 'cleared' in (result.value as any)) {
          setTabs(tabs.map(tab =>
            tab.id === activeTabId ? { ...tab, history: [] } : tab
          ))
          setCurrentInput("")
          setHistoryIndex(-1)
          return
        }
      } catch (error) {
        output = [`Error executing command: ${error instanceof Error ? error.message : String(error)}`]
      }
    }

    const newHistoryItem: HistoryItem = {
      command: trimmedInput,
      output,
      timestamp: new Date()
    }

    setTabs(prevTabs => prevTabs.map(tab =>
      tab.id === activeTabId
        ? { ...tab, history: [...tab.history, newHistoryItem] }
        : tab
    ))

    // Add to command history with sliding window
    setCommandHistory(prev => {
      const newHistory = [...prev, trimmedInput]
      // Keep only the last MAX_COMMAND_HISTORY commands
      if (newHistory.length > MAX_COMMAND_HISTORY) {
        return newHistory.slice(-MAX_COMMAND_HISTORY)
      }
      return newHistory
    })

    setCurrentInput("")
    setHistoryIndex(-1)
    } finally {
      // Always release the execution lock
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
        setCurrentInput(fuzzyMatches[selectedMatchIndex])
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
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[newIndex])
        setFuzzyMatches([])
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault()
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1)
          setCurrentInput("")
        } else {
          setHistoryIndex(newIndex)
          setCurrentInput(commandHistory[newIndex])
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
      } else if (fuzzyResults.length === 1) {
        // Single match - autocomplete immediately
        setCurrentInput(fuzzyResults[0].command.id)
        setFuzzyMatches([])
      } else {
        // Multiple matches - show suggestions
        // Deduplicate matches (in case aliases match the same command)
        const matches = Array.from(new Set(fuzzyResults.map(r => r.command.id)))

        if (matches.length === 1) {
          // After deduplication, only one unique command
          setCurrentInput(matches[0])
          setFuzzyMatches([])
        } else {
          setFuzzyMatches(matches)
          setSelectedMatchIndex(0)
        }
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
    <div className={`w-full h-full bg-[#0A0A0A] p-4 flex flex-col relative overflow-hidden ${isFullWidth ? '' : 'pr-2'}`}>
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
                      className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
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
                        className="text-sm"
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
                className={`flex-1 font-mono overflow-y-scroll select-text min-h-0 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-[#0A0A0A] [&::-webkit-scrollbar-thumb]:bg-[#404040] [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:hover:bg-[#525252] ${isFullWidth ? 'p-6' : 'pt-6 pb-6 pl-6 pr-0'}`}
                style={{ fontSize: `${fontSize}px` }}
                onClick={handleTerminalClick}
              >
                {/* Command History */}
                {history.map((item, index) => (
                  <div key={index} className="mb-2">
                    {item.command !== "welcome" && (
                      <div className="flex select-text">
                        <span className="text-white-400">
                          {prompt.split('@')[0]}
                          <span className="font-semibold">@{prompt.split('@')[1]}</span>
                        </span>
                        <span className="text-whiteMa-400 ml-2 font-semibold">{item.command}</span>
                      </div>
                    )}
                    {item.output.map((line, lineIndex) => (
                      <p key={lineIndex} className="mt-1 text-gray-300 select-text whitespace-pre-wrap">
                        {line}
                      </p>
                    ))}
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

                {/* Current Input */}
                <div className="relative">
                  <div className="flex items-center bg-[#1a1a1a] pl-1 pr-2 py-1 rounded">
                    <span className="text-gray-100">
                      {prompt.split('@')[0]}
                      <span className="font-semibold">@{prompt.split('@')[1]}</span>
                    </span>
                    <input
                      ref={inputRef}
                      type="text"
                      value={currentInput}
                      onChange={(e) => setCurrentInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      className="bg-transparent border-none text-gray-100 focus:ring-0 flex-grow ml-2 p-0 font-mono outline-none caret-gray-400 font-bold"
                      style={{ fontSize: `${fontSize}px` }}
                      autoFocus
                      spellCheck={false}
                      autoComplete="off"
                    />
                  </div>

                  {/* Fuzzy match suggestions */}
                  {fuzzyMatches.length > 0 && (
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
                            setCurrentInput(match)
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
  )
}
