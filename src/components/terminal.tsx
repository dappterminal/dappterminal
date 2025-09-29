"use client"

import { useState, useEffect, useRef, KeyboardEvent } from "react"
import { cn } from "@/lib/utils"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"

interface HistoryItem {
  command: string
  output: string[]
  timestamp: Date
}

const PROMPT = "user@enterprise:~$"

const commands = {
  help: () => [
    "Available commands:",
    "  help      - Show this help message",
    "  clear     - Clear the terminal",
    "  ls        - List directory contents",
    "  pwd       - Print working directory",
    "  whoami    - Display current user",
    "  date      - Show current date and time",
    "  echo      - Echo back the input",
    "  version   - Show terminal version",
    "  status    - Show system status",
    "  exit      - Close terminal"
  ],
  clear: () => [],
  ls: () => [
    "drwxr-xr-x  2 user user 4096 Dec 29 10:30 📁 Documents",
    "drwxr-xr-x  2 user user 4096 Dec 29 10:30 📁 Downloads",
    "drwxr-xr-x  2 user user 4096 Dec 29 10:30 📁 Projects",
    "-rw-r--r--  1 user user  256 Dec 29 10:30 📄 config.json",
    "-rw-r--r--  1 user user 1024 Dec 29 10:30 📄 README.md"
  ],
  pwd: () => ["/home/user"],
  whoami: () => ["user"],
  date: () => [new Date().toString()],
  version: () => ["Enterprise Terminal v1.0.0 - Built with shadcn/ui"],
  status: () => [
    "✅ System Status: Online",
    "🔧 CPU Usage: 12%",
    "💾 Memory: 2.1GB / 8GB",
    "⏰ Uptime: 5 days, 3 hours",
    "🌐 Network: Connected"
  ]
}

export function Terminal() {
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [currentInput, setCurrentInput] = useState("")
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

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

    if (cmd === "echo") {
      output = [args.join(" ")]
    } else if (cmd === "clear") {
      setHistory([])
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

  return (
    <div className="h-screen w-full bg-background text-foreground p-4">
      <Card className="h-full flex flex-col">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h2 className="text-lg font-semibold tracking-tight">Enterprise Terminal</h2>
              <Badge variant="outline" className="text-xs">
                v1.0.0
              </Badge>
              <Separator orientation="vertical" className="h-4" />
              <span className="text-xs text-muted-foreground">Type 'help' for available commands</span>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="text-xs">
                Online
              </Badge>
              <div className="text-xs text-muted-foreground font-mono tabular-nums">
                {new Date().toLocaleTimeString()}
              </div>
            </div>
          </div>
        </CardHeader>

        <Separator />

        <CardContent className="flex-1 overflow-hidden p-0">
          <ScrollArea className="h-full">
            <div
              ref={terminalRef}
              className="p-6 font-mono text-sm terminal-text cursor-text"
              onClick={handleTerminalClick}
            >
              {/* Command History */}
              {history.map((item, index) => (
                <div key={index} className="mb-4 space-y-1">
                  <div className="flex items-center">
                    <span className="text-primary font-medium mr-2">{PROMPT}</span>
                    <span className="text-foreground">{item.command}</span>
                  </div>
                  {item.output.map((line, lineIndex) => (
                    <div key={lineIndex} className="text-muted-foreground pl-4 leading-relaxed">
                      {line}
                    </div>
                  ))}
                </div>
              ))}

              {/* Current Input Line */}
              <div className="flex items-center">
                <span className="text-primary font-medium mr-2">{PROMPT}</span>
                <span className={cn("text-primary mr-1", currentInput.length === 0 ? "terminal-cursor" : "")}>█</span>
                <div className="flex-1 relative">
                  <Input
                    ref={inputRef}
                    type="text"
                    value={currentInput}
                    onChange={(e) => setCurrentInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    className="border-none bg-transparent p-0 text-foreground font-mono text-sm focus-visible:ring-0 focus-visible:ring-offset-0 shadow-none"
                    spellCheck={false}
                    autoComplete="off"
                    placeholder="Enter command..."
                  />
                </div>
              </div>
            </div>
          </ScrollArea>
        </CardContent>

        <Separator />

        {/* Status Bar */}
        <div className="px-6 py-2 bg-muted/30">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-2">
              <Badge variant="default" className="text-xs bg-green-600 hover:bg-green-600">
                Ready
              </Badge>
              <Badge variant="outline" className="text-xs">
                {history.length} commands
              </Badge>
            </div>
            <div className="flex items-center space-x-2">
              <Badge variant="secondary" className="text-xs font-mono">
                Ln 1, Col {currentInput.length + 1}
              </Badge>
              <Badge variant="outline" className="text-xs">
                UTF-8
              </Badge>
              <Badge variant="outline" className="text-xs">
                UNIX
              </Badge>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}