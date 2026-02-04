/**
 * useSwapQuote Hook
 *
 * Fetches swap quotes from protocol fibers (starting with 1inch).
 * Uses the fibered monoid architecture where each protocol's swap
 * logic lives in its own fiber M_P.
 *
 * The quote operation is the first step in the composition chain:
 * quote → approve → execute
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import { parseUnits, formatUnits } from 'viem'
import { resolveTokenAddress, getTokenDecimals } from '@/plugins/1inch/tokens'

export interface SwapQuoteParams {
  /** Protocol to use for the swap (e.g., '1inch') */
  protocol: string
  /** Token symbol or address to swap from */
  fromToken: string
  /** Token symbol or address to swap to */
  toToken: string
  /** Amount to swap (in human-readable format, e.g., "0.1") */
  amount: string
  /** Chain ID */
  chainId: number
  /** Slippage tolerance in percent (e.g., 0.5 for 0.5%) */
  slippage?: number
}

export interface SwapQuote {
  /** Output amount in human-readable format */
  toAmount: string
  /** Output amount in raw units */
  toAmountRaw: string
  /** Exchange rate (1 fromToken = X toToken) */
  rate: string
  /** Estimated gas in native token units */
  gas: string
  /** Source token info from API */
  srcToken?: {
    symbol: string
    name: string
    decimals: number
    address: string
  }
  /** Destination token info from API */
  dstToken?: {
    symbol: string
    name: string
    decimals: number
    address: string
  }
  /** Routing path through DEXes (1inch) */
  protocols?: Array<Array<Array<{
    name: string
    part: number
    fromTokenAddress: string
    toTokenAddress: string
  }>>>
  /** Route description (e.g., "single-hop", "multi-hop via WETH") */
  route?: string
  /** Protocol that provided the quote */
  protocol: string
}

export interface UseSwapQuoteResult {
  /** The current quote, if available */
  quote: SwapQuote | null
  /** Whether a quote is being fetched */
  isLoading: boolean
  /** Error message if quote fetch failed */
  error: string | null
  /** Manually refresh the quote */
  refetch: () => void
}

/**
 * Hook to fetch swap quotes from protocol fibers
 *
 * @example
 * ```tsx
 * const { quote, isLoading, error } = useSwapQuote({
 *   protocol: '1inch',
 *   fromToken: 'ETH',
 *   toToken: 'USDC',
 *   amount: '0.1',
 *   chainId: 1,
 *   slippage: 0.5,
 * })
 * ```
 */
export function useSwapQuote(params: SwapQuoteParams | null): UseSwapQuoteResult {
  const [quote, setQuote] = useState<SwapQuote | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Track the current request to handle race conditions
  const requestIdRef = useRef(0)
  // Debounce timer
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  const fetchQuote = useCallback(async () => {
    if (!params) {
      setQuote(null)
      setError(null)
      return
    }

    const { protocol, fromToken, toToken, amount, chainId, slippage = 0.5 } = params

    // Validate inputs
    if (!fromToken || !toToken || !amount || parseFloat(amount) <= 0) {
      setQuote(null)
      setError(null)
      return
    }

    // Don't fetch quote if src and dst are the same token
    if (fromToken.toLowerCase() === toToken.toLowerCase()) {
      setQuote(null)
      setError(null)
      return
    }

    // Validate protocol
    if (protocol !== '1inch' && protocol !== 'uniswap') {
      setError(`Protocol '${protocol}' not yet supported for quotes`)
      return
    }

    // Increment request ID for race condition handling
    const currentRequestId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      // Resolve token symbols to addresses using the 1inch fiber's token mapping
      const srcAddress = resolveTokenAddress(fromToken, chainId)
      const dstAddress = resolveTokenAddress(toToken, chainId)

      // Validate that we got valid addresses
      const isValidSrc = srcAddress.startsWith('0x') && srcAddress.length === 42
      const isValidDst = dstAddress.startsWith('0x') && dstAddress.length === 42

      if (!isValidSrc) {
        throw new Error(`Unknown token: ${fromToken}`)
      }
      if (!isValidDst) {
        throw new Error(`Unknown token: ${toToken}`)
      }

      // Get decimals for the source token to convert amount
      const srcDecimals = getTokenDecimals(fromToken)
      const amountInUnits = parseUnits(amount, srcDecimals).toString()

      let response: Response

      if (protocol === 'uniswap') {
        // Call the Uniswap quote API
        response = await fetch(
          `/api/uniswap/quote?` +
          `chainId=${chainId}&` +
          `src=${fromToken}&` +
          `dst=${toToken}&` +
          `amount=${amountInUnits}&` +
          `slippage=${slippage}`
        )
      } else {
        // Call the 1inch quote API
        response = await fetch(
          `/api/1inch/swap/classic/quote?` +
          `chainId=${chainId}&` +
          `src=${srcAddress}&` +
          `dst=${dstAddress}&` +
          `amount=${amountInUnits}&` +
          `slippage=${slippage}`
        )
      }

      // Check if this request is still the latest
      if (currentRequestId !== requestIdRef.current) {
        return // Stale request, ignore
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to get quote' }))
        throw new Error(errorData.error || `Quote failed: ${response.status}`)
      }

      const data = await response.json()

      // Get destination token decimals for formatting
      const dstDecimals = data.dstToken?.decimals || getTokenDecimals(toToken)

      // Format the output amount
      const toAmountFormatted = formatUnits(BigInt(data.dstAmount), dstDecimals)

      // Calculate the exchange rate: 1 fromToken = X toToken
      const inputAmount = parseFloat(amount)
      const outputAmount = parseFloat(toAmountFormatted)
      const rate = inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0'

      // Format gas estimate (assume 18 decimals for native token)
      const gasFormatted = data.gas ? formatUnits(BigInt(data.gas), 9) : '0' // Gas in Gwei

      setQuote({
        toAmount: toAmountFormatted,
        toAmountRaw: data.dstAmount,
        rate,
        gas: gasFormatted,
        srcToken: data.srcToken,
        dstToken: data.dstToken,
        protocols: data.protocols,
        route: data.route, // e.g., "single-hop", "multi-hop via WETH"
        protocol,
      })
      setError(null)
    } catch (err) {
      // Check if this request is still the latest
      if (currentRequestId !== requestIdRef.current) {
        return // Stale request, ignore
      }

      const message = err instanceof Error ? err.message : 'Failed to get quote'
      setError(message)
      setQuote(null)
    } finally {
      // Only update loading state if this is still the current request
      if (currentRequestId === requestIdRef.current) {
        setIsLoading(false)
      }
    }
  }, [params])

  // Debounced fetch - wait 500ms after params change before fetching
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    // Don't debounce if params are null/invalid or tokens are the same
    if (
      !params ||
      !params.amount ||
      parseFloat(params.amount) <= 0 ||
      params.fromToken.toLowerCase() === params.toToken.toLowerCase()
    ) {
      setQuote(null)
      setError(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    debounceRef.current = setTimeout(() => {
      fetchQuote()
    }, 500)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [
    params?.protocol,
    params?.fromToken,
    params?.toToken,
    params?.amount,
    params?.chainId,
    params?.slippage,
    fetchQuote,
  ])

  return {
    quote,
    isLoading,
    error,
    refetch: fetchQuote,
  }
}
