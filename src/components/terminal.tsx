"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { Terminal as TerminalIcon, Settings, Bell, Megaphone, Code2, History, Plus, X } from "lucide-react"

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

const PROMPT = "user@x3>"

const commands = {
  welcome: () => [
    "Welcome to X3 Terminal. Type 'help' to see available commands."
  ],
  help: () => [
    "market       - Get market overview",
    "fees         - Show fee data",
    "tvl          - Show TVL data",
    "users        - Show user data",
    "clear        - Clear the terminal"
  ],
  market: () => [
    "[Chart Data Placeholder]"
  ],
  fees: () => [
    "[Fee Data Placeholder]"
  ],
  tvl: () => [
    "[TVL Data Placeholder]"
  ],
  users: () => [
    "[User Data Placeholder]"
  ],
  clear: () => []
}

export function Terminal() {
  const [mounted, setMounted] = useState(false)
  const [tabs, setTabs] = useState<TerminalTab[]>([])
  const [activeTabId, setActiveTabId] = useState<string>("")
  const [currentInput, setCurrentInput] = useState("")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    const initialTab: TerminalTab = {
      id: "1",
      name: "x3",
      history: [
        {
          command: "welcome",
          output: commands.welcome(),
          timestamp: new Date()
        }
      ]
    }
    setTabs([initialTab])
    setActiveTabId("1")
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  const activeTab = tabs.find(tab => tab.id === activeTabId)
  const history = activeTab?.history || []

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const addNewTab = () => {
    const newId = (tabs.length + 1).toString()
    const newTab: TerminalTab = {
      id: newId,
      name: "x3",
      history: [
        {
          command: "welcome",
          output: commands.welcome(),
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

  const executeCommand = (command: string) => {
    const trimmedCommand = command.trim()

    if (!trimmedCommand) return

    const [cmd] = trimmedCommand.split(" ")
    let output: string[] = []

    if (cmd === "clear") {
      setTabs(tabs.map(tab =>
        tab.id === activeTabId ? { ...tab, history: [] } : tab
      ))
      setCurrentInput("")
      setHistoryIndex(-1)
      return
    } else if (cmd in commands) {
      output = (commands as any)[cmd]()
    } else {
      output = [`Command not found: ${cmd}. Type 'help' for available commands.`]
    }

    const newHistoryItem: HistoryItem = {
      command: trimmedCommand,
      output,
      timestamp: new Date()
    }

    setTabs(tabs.map(tab =>
      tab.id === activeTabId
        ? { ...tab, history: [...tab.history, newHistoryItem] }
        : tab
    ))
    setCommandHistory(prev => [...prev, trimmedCommand])
    setCurrentInput("")
    setHistoryIndex(-1)
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      executeCommand(currentInput)
    } else if (e.key === "ArrowUp") {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1)
        setHistoryIndex(newIndex)
        setCurrentInput(commandHistory[newIndex])
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
      }
    } else if (e.key === "Tab") {
      e.preventDefault()
      const availableCommands = Object.keys(commands)
      const matches = availableCommands.filter(cmd => cmd.startsWith(currentInput))
      if (matches.length === 1) {
        setCurrentInput(matches[0])
      }
    }
  }

  const handleTerminalClick = () => {
    if (inputRef.current) {
      inputRef.current.focus()
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
            <div className="text-white text-2xl font-bold">
              X<sup className="text-lg">3</sup>
            </div>
          </div>
          <nav className="flex flex-col items-center space-y-8 flex-1">
            <a href="#" className="text-white">
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
              <h1 className="text-xl font-semibold text-white">X³ Terminal</h1>
              {/* <a href="#" className="text-white font-semibold">Docs</a> */}
              <a href="#" className="text-[#737373] hover:text-white transition-colors">Docs</a>
            </div>
            <div className="flex items-center space-x-4">
              <button className="bg-[#141414] border border-[#262626] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#262626] transition-colors">
                Connect Wallet
              </button>
            </div>
          </header>

          {/* Terminal Area */}
          <div className="flex-1 bg-[#0A0A0A] p-8 flex flex-col">
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
              </div>

              {/* Terminal Content */}
              <div
                ref={terminalRef}
                className="flex-1 p-6 font-mono text-xl overflow-y-auto"
                onClick={handleTerminalClick}
              >
                {/* Command History */}
                {history.map((item, index) => (
                  <div key={index} className="mb-2">
                    {item.command !== "welcome" && (
                      <div className="flex">
                        <span className="text-white-400 font-semibold">{PROMPT}</span>
                        <span className="text-whiteMa-400 ml-2 font-semibold">{item.command}</span>
                      </div>
                    )}
                    {item.output.map((line, lineIndex) => {
                      const parts = line.match(/^(\w+)\s+(.+)$/);
                      if (parts && item.command === "help") {
                        return (
                          <p key={lineIndex} className="mt-1 text-gray-300">
                            <span className="font-bold text-yellow-400 w-24 inline-block">{parts[1]}</span>
                            <span className="ml-4">{parts[2]}</span>
                          </p>
                        );
                      }
                      return (
                        <p key={lineIndex} className="mt-1 text-gray-300">
                          {line}
                        </p>
                      );
                    })}
                  </div>
                ))}

                {/* Current Input */}
                <div className="flex items-center bg-[#1a1a1a] pl-1 pr-2 py-1 rounded">
                  <span className="text-gray-100 font-semibold">{PROMPT}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none text-gray-100 focus:ring-0 flex-grow ml-2 p-0 font-mono text-xl outline-none caret-gray-400 font-bold"
                    autoFocus
                    spellCheck={false}
                    autoComplete="off"
                  />
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>


    </div>
  )
}