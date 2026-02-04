"use client"

import { X } from "lucide-react"
import type { RpcRegistryEntry } from "@/core"

interface ProviderConfig {
  name: string
  color: string
  placeholder: string
}

interface NodeProviderWindowProps {
  provider: ProviderConfig
  entry: RpcRegistryEntry
  rpcInput: string
  activeStatus: string
  onClose: () => void
  onRpcInputChange: (value: string) => void
  onStartNode: () => void
}

export function NodeProviderWindow({
  provider,
  entry,
  rpcInput,
  activeStatus,
  onClose,
  onRpcInputChange,
  onStartNode,
}: NodeProviderWindowProps) {
  return (
    <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-hidden min-w-0 h-full flex flex-col">
      <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-3 flex items-center justify-between">
        <span className="text-base font-semibold text-white">Node Provider</span>
        <button
          onClick={onClose}
          className="p-2 text-[#737373] hover:text-red-400 transition-colors"
          data-no-drag
        >
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1 min-h-0 p-4 text-sm overflow-auto">
        <div className="space-y-3">
          <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4">
            <span className="text-xs text-[#737373] uppercase tracking-wider">Provider</span>
            <div className="mt-2 flex items-center gap-2 px-3 py-2.5 bg-[#141414] border border-[#262626] rounded-lg">
              <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${provider.color}`} />
              <span className="text-sm text-white">{entry.customProviderName || provider.name}</span>
            </div>
          </div>

          <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-[#737373] uppercase tracking-wider">RPC Endpoint</span>
              <button className="text-xs text-[#a3a3a3] hover:text-white transition-colors" data-no-drag>
                Test
              </button>
            </div>
            <input
              type="text"
              placeholder={provider.placeholder}
              value={rpcInput}
              onChange={(event) => onRpcInputChange(event.target.value)}
              className="w-full bg-transparent border border-[#262626] rounded-lg px-3 py-2 text-sm text-white placeholder:text-[#5f5f5f] outline-none focus:border-[#404040] transition-colors"
            />
          </div>

          <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4">
            <span className="text-xs text-[#737373] uppercase tracking-wider">Network</span>
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
                <span className="text-white font-medium">Ethereum</span>
              </div>
              <button className="flex items-center gap-1 px-2 py-1 text-xs text-[#a3a3a3] hover:text-white transition-colors" data-no-drag>
                Change
              </button>
            </div>
            <div className="mt-2 text-xs text-[#5a5a5a]">
              Chain ID: {entry.chainId}
            </div>
          </div>

          <div className="flex items-center justify-between bg-[#0f0f0f] border border-[#262626] rounded-xl px-4 py-3">
            <span className="text-xs text-[#737373]">Status</span>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#10b981]" />
              <span className="text-xs text-[#10b981]">Node: {activeStatus}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-2">
          <button
            onClick={onStartNode}
            className="w-full py-3 rounded-xl font-semibold bg-white text-black hover:bg-gray-200 transition-colors"
            data-no-drag
          >
            Start Node
          </button>
        </div>

        <div className="mt-3 text-xs text-[#5a5a5a] text-center">
          Mock RPC data only. Start Node persists and becomes the active custom source.
        </div>
      </div>
    </div>
  )
}
