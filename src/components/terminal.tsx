"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { Terminal as TerminalIcon, Settings, Plus, X } from "lucide-react"
import { ConnectButton } from '@rainbow-me/rainbowkit'
import { useAccount, useEnsName, useBalance } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { formatUnits } from 'viem'
import { registry, registerCoreCommands, createExecutionContext, updateExecutionContext } from "@/core"
import type { ExecutionContext, CommandResult } from "@/core"

interface HistoryItem {
  command: string
  output: string[]
  timestamp: Date
}

interface TerminalTab {
  id: string
  name: string
  history: HistoryItem[]
}

const MAX_COMMAND_HISTORY = 1000 // Maximum commands to keep in history

// Helper to format terminal prompt based on wallet state
function formatPrompt(ensName?: string | null, address?: `0x${string}`): string {
  if (ensName) {
    return `${ensName}@defi>`
  }
  if (address) {
    // Truncate address: 0x1234...5678
    const truncated = `${address.slice(0, 6)}...${address.slice(-4)}`
    return `${truncated}@defi>`
  }
  return "user@defi>"
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
    if ('message' in value && 'core' in value) {
      const helpOutput = value as any
      const lines: string[] = [helpOutput.message as string, '']

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

export function Terminal() {
  const [mounted, setMounted] = useState(false)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>("")
  const [currentInput, setCurrentInput] = useState("")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [showSettings, setShowSettings] = useState(false)
  const [fontSize, setFontSize] = useState(15)
  const [executionContext, setExecutionContext] = useState<ExecutionContext | null>(null)
  const [fuzzyMatches, setFuzzyMatches] = useState<string[]>([])
  const [selectedMatchIndex, setSelectedMatchIndex] = useState(0)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)

  // Get wallet state from wagmi
  const { address, chainId, isConnected, isConnecting } = useAccount()
  const { data: ensName } = useEnsName({
    address,
    chainId: mainnet.id,
  })

  // Generate prompt based on wallet state
  const prompt = formatPrompt(ensName, address)

  useEffect(() => {
    setMounted(true)

    // Register core commands
    registerCoreCommands()

    // Create execution context
    const context = createExecutionContext()
    setExecutionContext(context)

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
      ]
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

  const activeTab = tabs.find(tab => tab.id === activeTabId)
  const history = activeTab?.history || []

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
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
    if (executionContext) {
      setExecutionContext({
        ...executionContext,
        wallet: {
          address,
          chainId,
          isConnected,
          isConnecting,
          isDisconnecting: false, // wagmi v2 doesn't expose this
        }
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, chainId, isConnected, isConnecting])

  const addNewTab = () => {
    const newId = (tabs.length + 1).toString()
    const newTab: TerminalTab = {
      id: newId,
      name: "defi",
      history: [
        {
          command: "welcome",
          output: ["Welcome to The DeFi Terminal. Type 'help' to see available commands."],
          timestamp: new Date()
        }
      ]
    }
    setTabs([...tabs, newTab])
    setActiveTabId(newId)
  }

  const closeTab = (tabId: string) => {
    if (tabs.length === 1) return // Don't close last tab

    const newTabs = tabs.filter(tab => tab.id !== tabId)
    setTabs(newTabs)

    if (activeTabId === tabId) {
      setActiveTabId(newTabs[0].id)
    }
  }

  const executeCommand = async (input: string) => {
    const trimmedInput = input.trim()

    if (!trimmedInput || !executionContext) return

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
        const result = await resolved.command.run(args, executionContext)

        // Handle special client-side commands
        if (result.success && typeof result.value === 'object' && result.value !== null) {
          // Handle whoami command - enhance with ENS
          if (resolved.command.id === 'whoami' && 'address' in result.value) {
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
        setExecutionContext(updatedContext)

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

    setTabs(tabs.map(tab =>
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
    <div className="flex h-screen flex-col bg-[#0A0A0A]">
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className="w-20 flex flex-col items-center bg-[#141414] py-6 border-r border-[#262626]">
          <div className="p-2 mb-10">
            {/* <div className="text-white text-2xl font-bold">
              D<sup className="text-lg">3</sup>
            </div> */}
          </div>
          <nav className="flex flex-col items-center space-y-8 flex-1">
            <a href="#" className="text-white pt-5
            ">
              <TerminalIcon className="w-6 h-6" />
            </a>
          </nav>
          <div className="mt-auto">
            <a href="#" className="text-[#737373] hover:text-white transition-colors">
              <Settings className="w-6 h-6" />
            </a>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Header */}
          <header className="flex items-center justify-between h-20 px-8 border-b border-[#262626] flex-shrink-0">
            <div className="flex items-center space-x-8 text-base">
              <h1 className="text-xl font-semibold text-white">The DeFi Terminal</h1>
              <a href="#" className="text-[#737373] hover:text-white transition-colors">Docs</a>
            </div>
            <div className="flex items-center space-x-4">
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
                              className="bg-[#141414] border border-[#262626] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#262626] transition-colors"
                            >
                              {account.displayName}
                              {account.displayBalance && (
                                <span className="ml-2 text-[#737373]">
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

          {/* Terminal Area */}
          <div className="flex-1 bg-[#0A0A0A] p-8 flex flex-col relative">
            <div className="flex-1 bg-[#141414] rounded-xl border border-[#262626] flex flex-col overflow-hidden">
              {/* Window Management Bar with Tabs */}
              <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-2 flex items-center gap-2 rounded-t-xl">
                {tabs.map(tab => (
                  <div
                    key={tab.id}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md cursor-pointer transition-colors ${
                      activeTabId === tab.id
                        ? "bg-[#262626] text-white"
                        : "text-[#737373] hover:text-white hover:bg-[#242424]"
                    }`}
                  >
                    <span
                      className="text-sm"
                      onClick={() => setActiveTabId(tab.id)}
                    >
                      {tab.name}
                    </span>
                    {tabs.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          closeTab(tab.id)
                        }}
                        className="hover:text-red-400 transition-colors"
                      >
                        <X className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                ))}
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
                    <Settings className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Terminal Content */}
              <div
                ref={terminalRef}
                className="flex-1 p-6 font-mono overflow-y-auto select-text"
                style={{ fontSize: `${fontSize}px` }}
                onClick={handleTerminalClick}
              >
                {/* Command History */}
                {history.map((item, index) => (
                  <div key={index} className="mb-2">
                    {item.command !== "welcome" && (
                      <div className="flex select-text">
                        <span className="text-white-400 font-semibold">{prompt}</span>
                        <span className="text-whiteMa-400 ml-2 font-semibold">{item.command}</span>
                      </div>
                    )}
                    {item.output.map((line, lineIndex) => (
                      <p key={lineIndex} className="mt-1 text-gray-300 select-text whitespace-pre-wrap">
                        {line}
                      </p>
                    ))}
                  </div>
                ))}

                {/* Current Input */}
                <div className="relative">
                  <div className="flex items-center bg-[#1a1a1a] pl-1 pr-2 py-1 rounded">
                    <span className="text-gray-100 font-semibold">{prompt}</span>
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
        </main>
      </div>


    </div>
  )
}
