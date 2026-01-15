"use client"

import { useState, useEffect } from 'react'
import { X, Settings, ChevronDown, ArrowDownUp, Loader2 } from 'lucide-react'
import { useAccount } from 'wagmi'
import { NetworkModal } from './network-modal'
import { TokenModal } from './token-modal'
import { SettingsModal } from './settings-modal'
import { getChainName, getMainnetChainIds } from '@/lib/chains'

export interface Token {
  symbol: string
  name: string
  address?: string
  decimals: number
  logoURI?: string
}

interface SwapWindowProps {
  onClose: () => void
}

const POPULAR_TOKENS: Token[] = [
  { symbol: 'ETH', name: 'Ethereum', decimals: 18 },
  { symbol: 'USDC', name: 'USD Coin', decimals: 6 },
  { symbol: 'USDT', name: 'Tether USD', decimals: 6 },
  { symbol: 'WBTC', name: 'Wrapped Bitcoin', decimals: 8 },
  { symbol: 'DAI', name: 'Dai Stablecoin', decimals: 18 },
]

export function SwapWindow({ onClose }: SwapWindowProps) {
  const { chainId: walletChainId, isConnected } = useAccount()

  // Swap state
  const [fromToken, setFromToken] = useState<Token | null>(POPULAR_TOKENS[0])
  const [toToken, setToToken] = useState<Token | null>(POPULAR_TOKENS[1])
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [chainId, setChainId] = useState(walletChainId || 1)

  // Settings state
  const [slippage, setSlippage] = useState(0.5)
  const [routePreference, setRoutePreference] = useState<'best' | 'fast'>('best')

  // Modal visibility
  const [showNetworkModal, setShowNetworkModal] = useState(false)
  const [showFromTokenModal, setShowFromTokenModal] = useState(false)
  const [showToTokenModal, setShowToTokenModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Loading state for quote
  const [isLoadingQuote, setIsLoadingQuote] = useState(false)

  // Sync with wallet chain
  useEffect(() => {
    if (walletChainId && getMainnetChainIds().includes(walletChainId)) {
      setChainId(walletChainId)
    }
  }, [walletChainId])

  // Flip tokens
  const handleFlipTokens = () => {
    const tempToken = fromToken
    const tempAmount = fromAmount
    setFromToken(toToken)
    setToToken(tempToken)
    setFromAmount(toAmount)
    setToAmount(tempAmount)
  }

  // Handle token selection
  const handleSelectFromToken = (token: Token) => {
    setFromToken(token)
    setShowFromTokenModal(false)
  }

  const handleSelectToToken = (token: Token) => {
    setToToken(token)
    setShowToTokenModal(false)
  }

  // Handle network selection
  const handleSelectNetwork = (newChainId: number) => {
    setChainId(newChainId)
    setShowNetworkModal(false)
  }

  // Check if swap is valid
  const isValidSwap = fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0

  return (
    <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-3 flex items-center justify-between">
        <span className="text-base font-semibold text-white">Swap</span>
        <div className="flex items-center gap-2">
          {/* Network Button */}
          <button
            onClick={() => setShowNetworkModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 bg-[#262626] hover:bg-[#333333] rounded-lg transition-colors"
            data-no-drag
          >
            <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
            <span className="text-sm text-white">{getChainName(chainId)}</span>
            <ChevronDown className="w-3 h-3 text-[#737373]" />
          </button>

          {/* Settings Button */}
          <button
            onClick={() => setShowSettingsModal(true)}
            className="p-2 text-[#737373] hover:text-white hover:bg-[#262626] rounded-lg transition-colors"
            data-no-drag
          >
            <Settings className="w-4 h-4" />
          </button>

          {/* Close Button */}
          <button
            onClick={onClose}
            className="p-2 text-[#737373] hover:text-red-400 transition-colors"
            data-no-drag
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-3 overflow-auto">
        {/* From Token Section */}
        <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#737373] uppercase tracking-wider">You Pay</span>
            {isConnected && (
              <span className="text-xs text-[#737373]">Balance: 0.00</span>
            )}
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={fromAmount}
              onChange={(e) => {
                const value = e.target.value.replace(/[^0-9.]/g, '')
                setFromAmount(value)
              }}
              className="flex-1 bg-transparent text-2xl text-white font-semibold outline-none placeholder:text-[#3f3f3f] min-w-0"
            />
            <button
              onClick={() => setShowFromTokenModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-xl hover:bg-[#222222] transition-colors shrink-0"
              data-no-drag
            >
              {fromToken ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-xs font-bold text-white">
                    {fromToken.symbol.charAt(0)}
                  </div>
                  <span className="text-white font-medium">{fromToken.symbol}</span>
                </>
              ) : (
                <span className="text-white font-medium">Select</span>
              )}
              <ChevronDown className="w-4 h-4 text-[#737373]" />
            </button>
          </div>
        </div>

        {/* Swap Direction Button */}
        <div className="flex justify-center -my-1 relative z-10">
          <button
            onClick={handleFlipTokens}
            className="w-10 h-10 rounded-xl border border-[#262626] bg-[#141414] hover:bg-[#1a1a1a] flex items-center justify-center text-[#737373] hover:text-white transition-all hover:scale-105"
            data-no-drag
          >
            <ArrowDownUp className="w-4 h-4" />
          </button>
        </div>

        {/* To Token Section */}
        <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#737373] uppercase tracking-wider">You Receive</span>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.0"
              value={toAmount}
              readOnly
              className="flex-1 bg-transparent text-2xl text-white font-semibold outline-none placeholder:text-[#3f3f3f] min-w-0"
            />
            <button
              onClick={() => setShowToTokenModal(true)}
              className="flex items-center gap-2 px-3 py-2 bg-[#1a1a1a] border border-[#333333] rounded-xl hover:bg-[#222222] transition-colors shrink-0"
              data-no-drag
            >
              {toToken ? (
                <>
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-gray-600 to-gray-800 flex items-center justify-center text-xs font-bold text-white">
                    {toToken.symbol.charAt(0)}
                  </div>
                  <span className="text-white font-medium">{toToken.symbol}</span>
                </>
              ) : (
                <span className="text-white font-medium">Select</span>
              )}
              <ChevronDown className="w-4 h-4 text-[#737373]" />
            </button>
          </div>
        </div>

        {/* Quote Info */}
        {fromToken && toToken && fromAmount && (
          <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-3 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#737373]">Rate</span>
              <span className="text-[#d4d4d4]">
                {isLoadingQuote ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  `1 ${fromToken.symbol} = -- ${toToken.symbol}`
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#737373]">Route</span>
              <span className="text-[#d4d4d4]">1inch</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#737373]">Slippage</span>
              <span className="text-[#d4d4d4]">{slippage}%</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#737373]">Est. Gas</span>
              <span className="text-[#d4d4d4]">--</span>
            </div>
          </div>
        )}

        {/* Action Button */}
        <button
          disabled={!isValidSwap || !isConnected}
          className={`w-full py-3 rounded-xl font-semibold transition-colors ${
            isValidSwap && isConnected
              ? 'bg-white text-black hover:bg-gray-200'
              : 'bg-[#262626] text-[#737373] cursor-not-allowed'
          }`}
        >
          {!isConnected ? 'Connect Wallet' : isValidSwap ? 'Review Swap' : 'Enter Amount'}
        </button>

        {/* Status */}
        <div className="text-xs text-[#5a5a5a] text-center">
          Quotes via CLI; execution UI coming soon.
        </div>
      </div>

      {/* Modals */}
      <NetworkModal
        isOpen={showNetworkModal}
        onClose={() => setShowNetworkModal(false)}
        currentChainId={chainId}
        onSelectChain={handleSelectNetwork}
      />

      <TokenModal
        isOpen={showFromTokenModal}
        onClose={() => setShowFromTokenModal(false)}
        onSelectToken={handleSelectFromToken}
        selectedToken={fromToken}
        title="Select Token to Pay"
      />

      <TokenModal
        isOpen={showToTokenModal}
        onClose={() => setShowToTokenModal(false)}
        onSelectToken={handleSelectToToken}
        selectedToken={toToken}
        title="Select Token to Receive"
      />

      <SettingsModal
        isOpen={showSettingsModal}
        onClose={() => setShowSettingsModal(false)}
        slippage={slippage}
        onSlippageChange={setSlippage}
        routePreference={routePreference}
        onRoutePreferenceChange={setRoutePreference}
      />
    </div>
  )
}
