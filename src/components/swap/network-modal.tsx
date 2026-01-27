"use client"

import { useEffect, useRef } from 'react'
import { X, Check } from 'lucide-react'
import { getMainnetChainIds, getChainName } from '@/lib/chains'

interface NetworkModalProps {
  isOpen: boolean
  onClose: () => void
  currentChainId: number
  onSelectChain: (chainId: number) => void
}

// Chain icons/colors for visual distinction
const CHAIN_STYLES: Record<number, { gradient: string; icon?: string }> = {
  1: { gradient: 'from-blue-500 to-blue-700' },      // Ethereum
  10: { gradient: 'from-red-500 to-red-700' },       // Optimism
  56: { gradient: 'from-yellow-500 to-yellow-700' }, // BNB Chain
  137: { gradient: 'from-purple-500 to-purple-700' }, // Polygon
  8453: { gradient: 'from-blue-400 to-blue-600' },   // Base
  42161: { gradient: 'from-blue-600 to-cyan-500' },  // Arbitrum
  43114: { gradient: 'from-red-600 to-red-800' },    // Avalanche
}

export function NetworkModal({ isOpen, onClose, currentChainId, onSelectChain }: NetworkModalProps) {
  const modalRef = useRef<HTMLDivElement>(null)

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

  if (!isOpen) return null

  const mainnetChains = getMainnetChainIds()

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 z-40" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1a] border border-[#262626] rounded-xl z-50 w-[320px] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#262626]">
          <span className="text-base font-semibold text-white">Select Network</span>
          <button
            onClick={onClose}
            className="p-1 text-[#737373] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Chain List */}
        <div className="p-2 max-h-[360px] overflow-y-auto">
          {mainnetChains.map((chainId) => {
            const isSelected = chainId === currentChainId
            const styles = CHAIN_STYLES[chainId] || { gradient: 'from-gray-500 to-gray-700' }

            return (
              <button
                key={chainId}
                onClick={() => onSelectChain(chainId)}
                className={`w-full flex items-center gap-3 px-3 py-3 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-[#262626]'
                    : 'hover:bg-[#222222]'
                }`}
              >
                {/* Chain Icon */}
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${styles.gradient} flex items-center justify-center`}>
                  <span className="text-white text-xs font-bold">
                    {getChainName(chainId).charAt(0)}
                  </span>
                </div>

                {/* Chain Name */}
                <span className={`flex-1 text-left font-medium ${isSelected ? 'text-white' : 'text-[#d4d4d4]'}`}>
                  {getChainName(chainId)}
                </span>

                {/* Selected Indicator */}
                {isSelected && (
                  <Check className="w-4 h-4 text-green-400" />
                )}
              </button>
            )
          })}
        </div>
      </div>
    </>
  )
}
