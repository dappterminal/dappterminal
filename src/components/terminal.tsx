"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { Terminal as TerminalIcon, Settings, Bell, Megaphone, Code2, History } from "lucide-react"

interface HistoryItem {
  command: string
  output: string[]
  timestamp: Date
}

const PROMPT = "user@0x-terminal:~$"

const commands = {
  welcome: () => [
    "Welcome to 0x Terminal. Type 'help' to see available commands."
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
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentInput, setCurrentInput] = useState("")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMounted(true)
    setHistory([
      {
        command: "welcome",
        output: commands.welcome(),
        timestamp: new Date()
      }
    ])
  }, [])

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
    }
  }, [])

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const executeCommand = (command: string) => {
    const trimmedCommand = command.trim()

    if (!trimmedCommand) return

    const [cmd, ...args] = trimmedCommand.split(" ")
    let output: string[] = []

    if (cmd === "clear") {
      setHistory([])
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

    setHistory(prev => [...prev, newHistoryItem])
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
            <svg fill="none" height="32" viewBox="0 0 32 32" width="32" xmlns="http://www.w3.org/2000/svg">
              <path d="M16 0L32 9.2376L16 18.4752L0 9.2376L16 0Z" fill="#FFFFFF"></path>
              <path d="M0 22.7624L16 32V18.4752L0 9.2376V22.7624Z" fill="#FFFFFF" fillOpacity="0.6"></path>
              <path d="M32 22.7624L16 32V18.4752L32 9.2376V22.7624Z" fill="#FFFFFF" fillOpacity="0.8"></path>
            </svg>
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
              <h1 className="text-xl font-semibold text-white">0x Terminal</h1>
              <a href="#" className="text-white font-semibold">CLI</a>
              <a href="#" className="text-[#737373] hover:text-white transition-colors">GUI</a>
            </div>
            <div className="flex items-center space-x-4">
              <button className="bg-[#141414] border border-[#262626] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#262626] transition-colors">
                Connect Wallet
              </button>
            </div>
          </header>

          {/* Terminal Area */}
          <div className="flex-1 bg-[#0A0A0A] p-8 flex flex-col">
            <div className="flex-1 bg-[#141414] rounded-xl border border-[#262626] p-4 flex flex-col overflow-hidden">
              <div
                ref={terminalRef}
                className="flex-1 p-4 font-mono text-lg overflow-y-auto"
                onClick={handleTerminalClick}
              >
                {/* Command History */}
                {history.map((item, index) => (
                  <div key={index} className="mb-2">
                    {item.command !== "welcome" && (
                      <div className="flex">
                        <span className="text-green-400 font-semibold">{PROMPT}</span>
                        <span className="text-blue-400 ml-2 font-semibold">{item.command}</span>
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
                <div className="flex items-center">
                  <span className="text-gray-100 font-semibold">{PROMPT}</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="bg-transparent border-none text-gray-300 focus:ring-0 flex-grow ml-2 p-0 font-mono text-lg outline-none caret-gray-400"
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