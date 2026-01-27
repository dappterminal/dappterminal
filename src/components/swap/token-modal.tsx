"use client"

import { useState, useEffect, useRef, useMemo } from 'react'
import { X, Search, Check } from 'lucide-react'
import type { Token } from './swap-window'

interface TokenModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectToken: (token: Token) => void
  selectedToken: Token | null
  title: string
}

// Popular tokens list
const POPULAR_TOKENS: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8 },
  { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
  { symbol: 'WETH', name: 'Wrapped Ether', decimals: 18 },
  { symbol: 'LINK', name: 'Chainlink', decimals: 18 },
  { symbol: 'UNI', name: 'Uniswap', decimals: 18 },
  { symbol: 'AAVE', name: 'Aave', decimals: 18 },
  { symbol: 'CRV', name: 'Curve DAO Token', decimals: 18 },
]

// Token icon colors based on symbol
const TOKEN_COLORS: Record<string, string> = {
  ETH: 'from-blue-400 to-purple-500',
  WETH: 'from-blue-400 to-purple-500',
  USDC: 'from-blue-500 to-blue-600',
  USDT: 'from-green-500 to-green-600',
  WBTC: 'from-orange-500 to-orange-600',
  DAI: 'from-yellow-500 to-yellow-600',
  LINK: 'from-blue-600 to-blue-700',
  UNI: 'from-pink-500 to-pink-600',
  AAVE: 'from-cyan-500 to-purple-500',
  CRV: 'from-red-500 to-yellow-500',
}

export function TokenModal({ isOpen, onClose, onSelectToken, selectedToken, title }: TokenModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const modalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus search input when modal opens
  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
    if (!isOpen) {
      setSearchQuery('')
    }
  }, [isOpen])

  // Click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [isOpen, onClose])

  // Handle escape key
  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
    }

    return () => {
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen, onClose])

  // Filter tokens based on search query
  const filteredTokens = useMemo(() => {
    if (!searchQuery.trim()) return POPULAR_TOKENS
    const query = searchQuery.toLowerCase()
    return POPULAR_TOKENS.filter(
      (token) =>
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query)
    )
  }, [searchQuery])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 z-40" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1a] border border-[#262626] rounded-xl z-50 w-[360px] max-h-[480px] overflow-hidden shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#262626]">
          <span className="text-base font-semibold text-white">{title}</span>
          <button
            onClick={onClose}
            className="p-1 text-[#737373] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search */}
        <div className="px-4 py-3 border-b border-[#262626]">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#737373]" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search by name or symbol"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-[#0f0f0f] border border-[#262626] rounded-lg pl-10 pr-4 py-2.5 text-sm text-white placeholder:text-[#5a5a5a] outline-none focus:border-[#404040] transition-colors"
            />
          </div>
        </div>

        {/* Popular Tokens Quick Select */}
        <div className="px-4 py-3 border-b border-[#262626]">
          <span className="text-xs text-[#737373] uppercase tracking-wider mb-2 block">Popular</span>
          <div className="flex flex-wrap gap-2">
            {POPULAR_TOKENS.slice(0, 5).map((token) => {
              const isSelected = selectedToken?.symbol === token.symbol
              return (
                <button
                  key={token.symbol}
                  onClick={() => onSelectToken(token)}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-sm transition-colors ${
                    isSelected
                      ? 'bg-white text-black'
                      : 'bg-[#262626] text-[#d4d4d4] hover:bg-[#333333]'
                  }`}
                >
                  <div className={`w-4 h-4 rounded-full bg-gradient-to-br ${TOKEN_COLORS[token.symbol] || 'from-gray-500 to-gray-600'}`} />
                  {token.symbol}
                </button>
              )
            })}
          </div>
        </div>

        {/* Token List */}
        <div className="flex-1 overflow-y-auto p-2">
          {filteredTokens.length === 0 ? (
            <div className="text-center py-8 text-[#737373] text-sm">
              No tokens found
            </div>
          ) : (
            filteredTokens.map((token) => {
              const isSelected = selectedToken?.symbol === token.symbol
              const gradient = TOKEN_COLORS[token.symbol] || 'from-gray-500 to-gray-600'

              return (
                <button
                  key={token.symbol}
                  onClick={() => onSelectToken(token)}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                    isSelected
                      ? 'bg-[#262626]'
                      : 'hover:bg-[#222222]'
                  }`}
                >
                  {/* Token Icon */}
                  <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${gradient} flex items-center justify-center shrink-0`}>
                    <span className="text-white text-sm font-bold">
                      {token.symbol.charAt(0)}
                    </span>
                  </div>

                  {/* Token Info */}
                  <div className="flex-1 text-left min-w-0">
                    <div className={`font-medium truncate ${isSelected ? 'text-white' : 'text-[#d4d4d4]'}`}>
                      {token.symbol}
                    </div>
                    <div className="text-xs text-[#737373] truncate">
                      {token.name}
                    </div>
                  </div>

                  {/* Selected Indicator */}
                  {isSelected && (
                    <Check className="w-4 h-4 text-green-400 shrink-0" />
                  )}
                </button>
              )
            })
          )}
        </div>
      </div>
    </>
  )
}
