"use client"

import { useState, useEffect, useMemo, useCallback } from 'react'
import { X, Settings, ChevronDown, ArrowDownUp, Loader2, CheckCircle, ExternalLink } from 'lucide-react'
import { useAccount, useSendTransaction } from 'wagmi'
import { parseUnits } from 'viem'
import { NetworkModal } from './network-modal'
import { TokenModal } from './token-modal'
import { SettingsModal } from './settings-modal'
import { getChainName, getMainnetChainIds } from '@/lib/chains'
import { useSwapQuote } from '@/hooks/useSwapQuote'
import { useTokenBalance } from '@/hooks/useTokenBalance'
import { resolveTokenAddress, getTokenDecimals } from '@/plugins/1inch/tokens'
import { getTxUrl } from '@/lib/explorers'

// Swap execution states
type SwapState =
  | 'idle'           // Entering amount
  | 'review'         // Reviewing quote
  | 'checking'       // Checking allowance
  | 'approving'      // Waiting for approval tx
  | 'swapping'       // Executing swap
  | 'success'        // Swap completed
  | 'error'          // Error occurred

const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

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

interface Protocol {
  id: string
  name: string
  color: string
}

const PROTOCOLS: Protocol[] = [
  { id: 'uniswap', name: 'Uniswap', color: 'from-pink-500 to-pink-600' },
  { id: '1inch', name: '1inch', color: 'from-blue-400 to-blue-600' },
  { id: 'stargate', name: 'Stargate', color: 'from-purple-500 to-indigo-600' },
  { id: 'lifi', name: 'Li.Fi', color: 'from-cyan-400 to-purple-500' },
]

export function SwapWindow({ onClose }: SwapWindowProps) {
  const { chainId: walletChainId, isConnected, address } = useAccount()

  // Swap state
  const [fromToken, setFromToken] = useState<Token | null>(POPULAR_TOKENS[0])
  const [toToken, setToToken] = useState<Token | null>(POPULAR_TOKENS[1])
  const [fromAmount, setFromAmount] = useState('')
  const [toAmount, setToAmount] = useState('')
  const [fromChainId, setFromChainId] = useState(walletChainId || 1)
  const [toChainId, setToChainId] = useState(42161) // Default to Arbitrum for bridges

  // Settings state
  const [slippage, setSlippage] = useState(0.5)
  const [routePreference, setRoutePreference] = useState<'best' | 'fast'>('best')
  const [protocol, setProtocol] = useState<Protocol>(PROTOCOLS[0])
  const [showProtocolDropdown, setShowProtocolDropdown] = useState(false)

  // Check if protocol is a bridge
  const isBridge = protocol.id === 'stargate' || protocol.id === 'lifi'

  // Modal visibility
  const [showFromNetworkModal, setShowFromNetworkModal] = useState(false)
  const [showToNetworkModal, setShowToNetworkModal] = useState(false)
  const [showFromTokenModal, setShowFromTokenModal] = useState(false)
  const [showToTokenModal, setShowToTokenModal] = useState(false)
  const [showSettingsModal, setShowSettingsModal] = useState(false)

  // Swap execution state
  const [swapState, setSwapState] = useState<SwapState>('idle')
  const [swapError, setSwapError] = useState<string | null>(null)
  const [txHash, setTxHash] = useState<string | null>(null)
  const [needsApproval, setNeedsApproval] = useState(false)

  // Transaction hooks
  const { sendTransactionAsync } = useSendTransaction()

  // Swap quote using the selected protocol
  const quoteParams = useMemo(() => {
    if (!fromToken || !toToken || !fromAmount || parseFloat(fromAmount) <= 0) {
      return null
    }
    // Supported protocols: 1inch, uniswap, lifi
    if (protocol.id !== '1inch' && protocol.id !== 'uniswap' && protocol.id !== 'lifi') {
      return null
    }
    // Li.Fi requires wallet address
    if (protocol.id === 'lifi' && !address) {
      return null
    }
    return {
      protocol: protocol.id as '1inch' | 'uniswap' | 'lifi',
      fromToken: fromToken.symbol,
      toToken: toToken.symbol,
      amount: fromAmount,
      chainId: fromChainId,
      toChainId: isBridge ? toChainId : undefined,
      walletAddress: address,
      slippage,
    }
  }, [fromToken, toToken, fromAmount, fromChainId, toChainId, slippage, protocol.id, isBridge, address])

  const { quote, isLoading: isLoadingQuote, error: quoteError } = useSwapQuote(quoteParams)

  // Fetch balance for the "from" token
  const { formatted: fromTokenBalance, isLoading: isLoadingBalance } = useTokenBalance(
    fromToken?.symbol,
    address,
    fromChainId
  )

  // Update toAmount when quote changes
  useEffect(() => {
    if (quote?.toAmount) {
      // Format to reasonable precision
      const formatted = parseFloat(quote.toAmount).toFixed(6)
      setToAmount(formatted)
    } else if (!quoteParams) {
      setToAmount('')
    }
  }, [quote?.toAmount, quoteParams])

  // Sync with wallet chain
  useEffect(() => {
    if (walletChainId && getMainnetChainIds().includes(walletChainId)) {
      setFromChainId(walletChainId)
    }
  }, [walletChainId])

  // Reset swap state when inputs change
  useEffect(() => {
    if (swapState !== 'idle') {
      setSwapState('idle')
      setSwapError(null)
      setTxHash(null)
      setNeedsApproval(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromToken, toToken, fromAmount, fromChainId])

  // Handle swap execution
  const executeSwap = useCallback(async () => {
    if (!fromToken || !toToken || !address || !quote) return

    // Determine which protocol to use
    const useUniswap = protocol.id === 'uniswap'

    try {
      setSwapError(null)
      const srcAddress = resolveTokenAddress(fromToken.symbol, fromChainId)
      const srcDecimals = getTokenDecimals(fromToken.symbol)
      const amount = parseUnits(fromAmount, srcDecimals).toString()

      const isNativeToken = srcAddress.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()

      // Step 1: Check allowance (skip for native tokens) - only for 1inch
      // Note: Uniswap V4 uses Permit2, but for simplicity we'll handle it in the swap call
      if (!isNativeToken && !useUniswap) {
        setSwapState('checking')

        const allowanceRes = await fetch(
          `/api/1inch/swap/allowance?chainId=${fromChainId}&tokenAddress=${srcAddress}&walletAddress=${address}`
        )

        if (!allowanceRes.ok) {
          throw new Error('Failed to check allowance')
        }

        const allowanceData = await allowanceRes.json()
        const allowance = BigInt(allowanceData.allowance || '0')
        const requiredAmount = BigInt(amount)

        // Step 2: Approve if needed
        if (allowance < requiredAmount) {
          setNeedsApproval(true)
          setSwapState('approving')

          const approveRes = await fetch(
            `/api/1inch/swap/approve/transaction?chainId=${fromChainId}&tokenAddress=${srcAddress}&amount=${amount}`
          )

          if (!approveRes.ok) {
            throw new Error('Failed to get approval transaction')
          }

          const approveTx = await approveRes.json()

          const approveHash = await sendTransactionAsync({
            to: approveTx.to as `0x${string}`,
            data: approveTx.data as `0x${string}`,
            value: BigInt(0),
          })

          // Wait a moment for approval to be indexed
          setTxHash(approveHash)
          await new Promise(resolve => setTimeout(resolve, 2000))
        }
      }

      // Step 3: Execute swap
      setSwapState('swapping')

      let swapRes: Response

      if (useUniswap) {
        // Uniswap V4 swap
        swapRes = await fetch(
          `/api/uniswap/swap?chainId=${fromChainId}&src=${fromToken.symbol}&dst=${toToken.symbol}&amount=${amount}&from=${address}&slippage=${slippage}`
        )
      } else {
        // 1inch swap
        const dstAddress = resolveTokenAddress(toToken.symbol, fromChainId)
        swapRes = await fetch(
          `/api/1inch/swap/classic/swap?chainId=${fromChainId}&src=${srcAddress}&dst=${dstAddress}&amount=${amount}&from=${address}&slippage=${slippage}`
        )
      }

      if (!swapRes.ok) {
        const errorData = await swapRes.json()
        throw new Error(errorData.error || 'Failed to get swap transaction')
      }

      const swapTx = await swapRes.json()

      const hash = await sendTransactionAsync({
        to: swapTx.tx.to as `0x${string}`,
        data: swapTx.tx.data as `0x${string}`,
        value: BigInt(swapTx.tx.value || '0'),
      })

      setTxHash(hash)
      setSwapState('success')
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Swap failed'
      setSwapError(message)
      setSwapState('error')
    }
  }, [fromToken, toToken, address, quote, fromChainId, fromAmount, slippage, sendTransactionAsync, protocol.id])

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
    // Auto-switch destination token
    if (token.symbol === 'USDC' || token.symbol === 'USDT' || token.symbol === 'DAI') {
      setToToken(POPULAR_TOKENS.find(t => t.symbol === 'ETH') || POPULAR_TOKENS[0])
    } else if (token.symbol === 'ETH' || token.symbol === 'WETH') {
      setToToken(POPULAR_TOKENS.find(t => t.symbol === 'USDC') || POPULAR_TOKENS[1])
    }
  }

  const handleSelectToToken = (token: Token) => {
    setToToken(token)
    setShowToTokenModal(false)
    // Auto-switch source token
    if (token.symbol === 'USDC' || token.symbol === 'USDT' || token.symbol === 'DAI') {
      setFromToken(POPULAR_TOKENS.find(t => t.symbol === 'ETH') || POPULAR_TOKENS[0])
    } else if (token.symbol === 'ETH' || token.symbol === 'WETH') {
      setFromToken(POPULAR_TOKENS.find(t => t.symbol === 'USDC') || POPULAR_TOKENS[1])
    }
  }

  // Handle network selection
  const handleSelectFromNetwork = (newChainId: number) => {
    setFromChainId(newChainId)
    setShowFromNetworkModal(false)
  }

  const handleSelectToNetwork = (newChainId: number) => {
    setToChainId(newChainId)
    setShowToNetworkModal(false)
  }

  // Check if swap is valid
  const isValidSwap = fromToken && toToken && fromAmount && parseFloat(fromAmount) > 0

  return (
    <div className="bg-[#141414] rounded-xl border border-[#262626] overflow-hidden h-full flex flex-col">
      {/* Header */}
      <div className="bg-[#1a1a1a] border-b border-[#262626] px-4 py-3 flex items-center justify-between">
        <span className="text-base font-semibold text-white">Swap</span>
        <div className="flex items-center gap-2">
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
        {/* Protocol & Network Selectors */}
        <div className="flex items-center gap-2">
          {/* Protocol Button */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowProtocolDropdown(!showProtocolDropdown)}
              className="w-full flex items-center justify-between px-3 py-2.5 bg-[#0f0f0f] border border-[#262626] hover:border-[#333] rounded-xl transition-colors"
              data-no-drag
            >
              <div className="flex items-center gap-2">
                <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${protocol.color}`} />
                <span className="text-sm text-white">{protocol.name}</span>
              </div>
              <ChevronDown className={`w-4 h-4 text-[#737373] transition-transform ${showProtocolDropdown ? 'rotate-180' : ''}`} />
            </button>
            {showProtocolDropdown && (
              <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-xl overflow-hidden">
                {PROTOCOLS.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      setProtocol(p)
                      setShowProtocolDropdown(false)
                    }}
                    className={`w-full flex items-center gap-2 px-3 py-2.5 hover:bg-[#262626] transition-colors ${protocol.id === p.id ? 'bg-[#262626]' : ''}`}
                    data-no-drag
                  >
                    <div className={`w-5 h-5 rounded-md bg-gradient-to-br ${p.color}`} />
                    <span className="text-sm text-white">{p.name}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Network Button - only show when not bridge */}
          {!isBridge && (
            <div className="relative flex-1">
              <button
                onClick={() => setShowFromNetworkModal(true)}
                className="w-full flex items-center justify-between px-3 py-2.5 bg-[#0f0f0f] border border-[#262626] hover:border-[#333] rounded-xl transition-colors"
                data-no-drag
              >
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
                  <span className="text-sm text-white">{getChainName(fromChainId)}</span>
                </div>
                <ChevronDown className="w-4 h-4 text-[#737373]" />
              </button>
            </div>
          )}
        </div>

        {/* From Token Section */}
        <div className="bg-[#0f0f0f] border border-[#262626] rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs text-[#737373] uppercase tracking-wider">You Pay</span>
            <div className="flex items-center gap-2">
              {isBridge && (
                <button
                  onClick={() => setShowFromNetworkModal(true)}
                  className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded-lg hover:bg-[#222] transition-colors"
                  data-no-drag
                >
                  <div className="w-4 h-4 rounded-full bg-gradient-to-br from-blue-400 to-purple-500" />
                  <span className="text-xs text-white">{getChainName(fromChainId)}</span>
                  <ChevronDown className="w-3 h-3 text-[#737373]" />
                </button>
              )}
              {isConnected && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#737373]">
                    Balance: {isLoadingBalance ? '...' : fromTokenBalance}
                  </span>
                  {parseFloat(fromTokenBalance) > 0 && (
                    <button
                      onClick={() => setFromAmount(fromTokenBalance)}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      data-no-drag
                    >
                      Max
                    </button>
                  )}
                </div>
              )}
            </div>
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
            {isBridge && (
              <button
                onClick={() => setShowToNetworkModal(true)}
                className="flex items-center gap-1.5 px-2 py-1 bg-[#1a1a1a] border border-[#333] rounded-lg hover:bg-[#222] transition-colors"
                data-no-drag
              >
                <div className="w-4 h-4 rounded-full bg-gradient-to-br from-green-400 to-emerald-500" />
                <span className="text-xs text-white">{getChainName(toChainId)}</span>
                <ChevronDown className="w-3 h-3 text-[#737373]" />
              </button>
            )}
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
            {/* Error display */}
            {quoteError && (
              <div className="text-xs text-red-400 mb-2">
                {quoteError}
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#737373]">Rate</span>
              <span className="text-[#d4d4d4]">
                {isLoadingQuote ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : quote?.rate ? (
                  `1 ${fromToken.symbol} = ${quote.rate} ${toToken.symbol}`
                ) : (
                  `1 ${fromToken.symbol} = -- ${toToken.symbol}`
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#737373]">Route</span>
              <span className="text-[#d4d4d4]">
                {protocol.id === 'lifi' ? (
                  // Li.Fi: show bridge route info
                  quote?.route || `${fromToken.symbol} → ${toToken.symbol} (Li.Fi)`
                ) : protocol.id === 'uniswap' ? (
                  // Uniswap: show route info from quote
                  quote?.route?.includes('multi-hop')
                    ? `${fromToken.symbol} → ${quote.route.replace('multi-hop via ', '')} → ${toToken.symbol} (V4)`
                    : `${fromToken.symbol} → ${toToken.symbol} (V4 direct)`
                ) : quote?.protocols && quote.protocols.length > 0 ? (
                  // 1inch: show the routing path
                  (() => {
                    const route = quote.protocols[0]
                    const hops = route?.length || 1
                    const dexes = route?.[0]?.map(p => p.name).join(', ') || '1inch'
                    return hops > 1
                      ? `${hops}-hop via ${dexes}`
                      : `${fromToken.symbol} → ${toToken.symbol} (${dexes})`
                  })()
                ) : (
                  `${fromToken.symbol} → ${toToken.symbol} (1inch)`
                )}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#737373]">Slippage</span>
              <span className="text-[#d4d4d4]">{slippage}%</span>
            </div>
            {/* Show estimated time for bridges */}
            {protocol.id === 'lifi' && quote?.estimatedTime && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-[#737373]">Est. Time</span>
                <span className="text-[#d4d4d4]">
                  {Math.ceil(quote.estimatedTime / 60)} min
                </span>
              </div>
            )}
            <div className="flex items-center justify-between text-sm">
              <span className="text-[#737373]">{protocol.id === 'lifi' ? 'Est. Cost' : 'Est. Gas'}</span>
              <span className="text-[#d4d4d4]">
                {isLoadingQuote ? (
                  <Loader2 className="w-4 h-4 animate-spin inline" />
                ) : protocol.id === 'lifi' && quote?.gasCostUSD ? (
                  `$${parseFloat(quote.gasCostUSD).toFixed(2)}`
                ) : quote?.gas ? (
                  `${parseFloat(quote.gas).toFixed(2)} Gwei`
                ) : (
                  '--'
                )}
              </span>
            </div>
          </div>
        )}

        {/* Action Button */}
        {swapState === 'success' && txHash ? (
          <div className="space-y-3">
            <div className="flex items-center justify-center gap-2 text-green-400">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">Swap Successful!</span>
            </div>
            <a
              href={getTxUrl(fromChainId, txHash)}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 rounded-xl font-semibold bg-[#1a1a1a] text-white hover:bg-[#262626] transition-colors flex items-center justify-center gap-2"
            >
              View Transaction <ExternalLink className="w-4 h-4" />
            </a>
            <button
              onClick={() => {
                setSwapState('idle')
                setTxHash(null)
                setFromAmount('')
                setToAmount('')
              }}
              className="w-full py-2 text-sm text-[#737373] hover:text-white transition-colors"
            >
              New Swap
            </button>
          </div>
        ) : swapState === 'error' ? (
          <div className="space-y-3">
            <div className="text-red-400 text-sm text-center">
              {swapError || 'Swap failed'}
            </div>
            <button
              onClick={() => {
                setSwapState('idle')
                setSwapError(null)
              }}
              className="w-full py-3 rounded-xl font-semibold bg-[#262626] text-white hover:bg-[#333] transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : (
          <button
            onClick={executeSwap}
            disabled={
              !isValidSwap ||
              !isConnected ||
              isLoadingQuote ||
              !!quoteError ||
              isBridge ||
              swapState !== 'idle'
            }
            className={`w-full py-3 rounded-xl font-semibold transition-colors ${
              isValidSwap && isConnected && !isLoadingQuote && !quoteError && !isBridge && swapState === 'idle'
                ? 'bg-white text-black hover:bg-gray-200'
                : 'bg-[#262626] text-[#737373] cursor-not-allowed'
            }`}
          >
            {!isConnected
              ? 'Connect Wallet'
              : isBridge
              ? 'Bridges Coming Soon'
              : isLoadingQuote
              ? 'Getting Quote...'
              : quoteError
              ? 'Quote Unavailable'
              : swapState === 'checking'
              ? 'Checking Allowance...'
              : swapState === 'approving'
              ? 'Approve in Wallet...'
              : swapState === 'swapping'
              ? 'Confirm Swap in Wallet...'
              : isValidSwap && quote
              ? needsApproval
                ? 'Approve & Swap'
                : 'Swap'
              : 'Enter Amount'}
          </button>
        )}

        {/* Disclaimer */}
        <div className="text-xs text-[#5a5a5a] text-center">
          {isBridge
            ? 'Bridge execution coming soon.'
            : swapState === 'success'
            ? 'Transaction confirmed on chain.'
            : quote
            ? 'Powered by 1inch aggregator.'
            : 'Live quotes from 1inch aggregator.'}
        </div>
      </div>

      {/* Modals */}
      <NetworkModal
        isOpen={showFromNetworkModal}
        onClose={() => setShowFromNetworkModal(false)}
        currentChainId={fromChainId}
        onSelectChain={handleSelectFromNetwork}
      />

      <NetworkModal
        isOpen={showToNetworkModal}
        onClose={() => setShowToNetworkModal(false)}
        currentChainId={toChainId}
        onSelectChain={handleSelectToNetwork}
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
