"use client"

import { useState, useEffect, useRef } from 'react'
import { X, AlertCircle } from 'lucide-react'

interface SettingsModalProps {
  isOpen: boolean
  onClose: () => void
  slippage: number
  onSlippageChange: (slippage: number) => void
  routePreference: 'best' | 'fast'
  onRoutePreferenceChange: (preference: 'best' | 'fast') => void
}

const SLIPPAGE_PRESETS = [0.1, 0.5, 1.0]

export function SettingsModal({
  isOpen,
  onClose,
  slippage,
  onSlippageChange,
  routePreference,
  onRoutePreferenceChange,
}: SettingsModalProps) {
  const [customSlippage, setCustomSlippage] = useState('')
  const [isCustomActive, setIsCustomActive] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)

  // Sync custom input with slippage value
  useEffect(() => {
    if (!SLIPPAGE_PRESETS.includes(slippage)) {
      setCustomSlippage(slippage.toString())
      setIsCustomActive(true)
    } else {
      setIsCustomActive(false)
      setCustomSlippage('')
    }
  }, [slippage])

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

  const handlePresetClick = (preset: number) => {
    setIsCustomActive(false)
    setCustomSlippage('')
    onSlippageChange(preset)
  }

  const handleCustomSlippageChange = (value: string) => {
    // Only allow valid decimal numbers
    const cleaned = value.replace(/[^0-9.]/g, '')
    // Prevent multiple decimal points
    const parts = cleaned.split('.')
    const formatted = parts.length > 2 ? parts[0] + '.' + parts.slice(1).join('') : cleaned

    setCustomSlippage(formatted)
    setIsCustomActive(true)

    const numValue = parseFloat(formatted)
    if (!isNaN(numValue) && numValue > 0 && numValue <= 50) {
      onSlippageChange(numValue)
    }
  }

  if (!isOpen) return null

  const isHighSlippage = slippage > 5
  const isLowSlippage = slippage < 0.1

  return (
    <>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 z-40" />

      {/* Modal */}
      <div
        ref={modalRef}
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-[#1a1a1a] border border-[#262626] rounded-xl z-50 w-[340px] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#262626]">
          <span className="text-base font-semibold text-white">Swap Settings</span>
          <button
            onClick={onClose}
            className="p-1 text-[#737373] hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-5">
          {/* Slippage Tolerance */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-white">Slippage Tolerance</span>
              <span className="text-sm text-[#737373]">{slippage}%</span>
            </div>

            <div className="flex items-center gap-2">
              {/* Preset Buttons */}
              {SLIPPAGE_PRESETS.map((preset) => (
                <button
                  key={preset}
                  onClick={() => handlePresetClick(preset)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium transition-colors ${
                    slippage === preset && !isCustomActive
                      ? 'bg-white text-black'
                      : 'bg-[#262626] text-[#d4d4d4] hover:bg-[#333333]'
                  }`}
                >
                  {preset}%
                </button>
              ))}

              {/* Custom Input */}
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Custom"
                  value={customSlippage}
                  onChange={(e) => handleCustomSlippageChange(e.target.value)}
                  className={`w-full py-2 px-3 rounded-lg text-sm font-medium text-center outline-none transition-colors ${
                    isCustomActive
                      ? 'bg-white text-black'
                      : 'bg-[#262626] text-[#d4d4d4] placeholder:text-[#737373]'
                  }`}
                />
                {isCustomActive && customSlippage && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-black/60">
                    %
                  </span>
                )}
              </div>
            </div>

            {/* Warnings */}
            {isHighSlippage && (
              <div className="flex items-center gap-2 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-yellow-500 shrink-0" />
                <span className="text-xs text-yellow-500">
                  High slippage may result in unfavorable trades
                </span>
              </div>
            )}
            {isLowSlippage && (
              <div className="flex items-center gap-2 p-2 bg-orange-500/10 border border-orange-500/20 rounded-lg">
                <AlertCircle className="w-4 h-4 text-orange-500 shrink-0" />
                <span className="text-xs text-orange-500">
                  Low slippage may cause transaction to fail
                </span>
              </div>
            )}
          </div>

          {/* Divider */}
          <div className="h-px bg-[#262626]" />

          {/* Route Preference */}
          <div className="space-y-3">
            <span className="text-sm font-medium text-white">Route Preference</span>

            <div className="space-y-2">
              <button
                onClick={() => onRoutePreferenceChange('best')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  routePreference === 'best'
                    ? 'bg-[#262626] border border-white/20'
                    : 'bg-[#0f0f0f] border border-[#262626] hover:bg-[#1a1a1a]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  routePreference === 'best' ? 'border-white' : 'border-[#737373]'
                }`}>
                  {routePreference === 'best' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="text-left">
                  <div className={`text-sm font-medium ${routePreference === 'best' ? 'text-white' : 'text-[#d4d4d4]'}`}>
                    Best Price
                  </div>
                  <div className="text-xs text-[#737373]">
                    Optimize for maximum output
                  </div>
                </div>
              </button>

              <button
                onClick={() => onRoutePreferenceChange('fast')}
                className={`w-full flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  routePreference === 'fast'
                    ? 'bg-[#262626] border border-white/20'
                    : 'bg-[#0f0f0f] border border-[#262626] hover:bg-[#1a1a1a]'
                }`}
              >
                <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                  routePreference === 'fast' ? 'border-white' : 'border-[#737373]'
                }`}>
                  {routePreference === 'fast' && (
                    <div className="w-2 h-2 rounded-full bg-white" />
                  )}
                </div>
                <div className="text-left">
                  <div className={`text-sm font-medium ${routePreference === 'fast' ? 'text-white' : 'text-[#d4d4d4]'}`}>
                    Fastest Execution
                  </div>
                  <div className="text-xs text-[#737373]">
                    Prioritize speed over price
                  </div>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
