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
import { LIFI_TOKENS } from '@/lib/lifi'
import { STARGATE_TOKENS } from '@/plugins/stargate/tokens'
import { TOKEN_ADDRESSES as WORMHOLE_TOKENS, TOKEN_DECIMALS as WORMHOLE_DECIMALS } from '@/lib/wormhole'

export interface SwapQuoteParams {
  /** Protocol to use for the swap (e.g., '1inch', 'uniswap', 'lifi') */
  protocol: string
  /** Token symbol or address to swap from */
  fromToken: string
  /** Token symbol or address to swap to */
  toToken: string
  /** Amount to swap (in human-readable format, e.g., "0.1") */
  amount: string
  /** Source chain ID */
  chainId: number
  /** Destination chain ID (for bridges) */
  toChainId?: number
  /** Wallet address (required for bridges) */
  walletAddress?: string
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
  /** Bridge-specific: estimated time in seconds */
  estimatedTime?: number
  /** Bridge-specific: gas cost in USD */
  gasCostUSD?: string
  /** Bridge-specific: bridge/tool being used */
  bridgeTool?: string
  /** Bridge-specific: number of steps */
  steps?: number
  /** Bridge-specific: full route data for execution */
  routeData?: unknown
  /** Bridge-specific: relay fee info */
  relayFee?: {
    amount: string
    symbol: string
    formatted: string
  }
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

    // Don't fetch quote if src and dst are the same token (unless it's a bridge protocol)
    const { toChainId, walletAddress } = params
    const isBridgeProtocol = protocol === 'lifi' || protocol === 'stargate' || protocol === 'wormhole'
    const isCrossChain = toChainId && toChainId !== chainId
    if (fromToken.toLowerCase() === toToken.toLowerCase() && !isBridgeProtocol) {
      setQuote(null)
      setError(null)
      return
    }
    // For bridges on same chain with same token, skip
    if (fromToken.toLowerCase() === toToken.toLowerCase() && isBridgeProtocol && !isCrossChain) {
      setQuote(null)
      setError(null)
      return
    }

    // Validate protocol
    if (protocol !== '1inch' && protocol !== 'uniswap' && protocol !== 'lifi' && protocol !== 'stargate' && protocol !== 'wormhole') {
      setError(`Protocol '${protocol}' not yet supported for quotes`)
      return
    }

    // Bridges require wallet address for quotes
    if ((protocol === 'lifi' || protocol === 'stargate' || protocol === 'wormhole') && !walletAddress) {
      setQuote(null)
      setError(null)
      return
    }

    // Increment request ID for race condition handling
    const currentRequestId = ++requestIdRef.current
    setIsLoading(true)
    setError(null)

    try {
      // Handle Stargate bridge quotes
      if (protocol === 'stargate') {
        // Get token info from Stargate registry
        const fromChainTokens = STARGATE_TOKENS[chainId]
        const toChainTokens = STARGATE_TOKENS[toChainId || chainId]

        if (!fromChainTokens) {
          throw new Error(`Chain ${chainId} not supported by Stargate`)
        }
        if (!toChainTokens) {
          throw new Error(`Chain ${toChainId || chainId} not supported by Stargate`)
        }

        const srcTokenInfo = fromChainTokens[fromToken.toUpperCase()]
        const dstTokenInfo = toChainTokens[toToken.toUpperCase()]

        if (!srcTokenInfo) {
          const available = Object.keys(fromChainTokens).join(', ')
          throw new Error(`Token ${fromToken} not supported on Stargate. Available: ${available}`)
        }
        if (!dstTokenInfo) {
          const available = Object.keys(toChainTokens).join(', ')
          throw new Error(`Token ${toToken} not supported on Stargate. Available: ${available}`)
        }

        const amountInUnits = parseUnits(amount, srcTokenInfo.decimals).toString()

        // Call Stargate quote API
        const response = await fetch('/api/stargate/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromChainId: chainId,
            toChainId: toChainId || chainId,
            fromTokenAddress: srcTokenInfo.address,
            toTokenAddress: dstTokenInfo.address,
            fromAmount: amountInUnits,
            fromAddress: walletAddress,
            toAddress: walletAddress,
            slippage,
          }),
        })

        if (currentRequestId !== requestIdRef.current) return

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to get Stargate quote' }))
          throw new Error(errorData.error || errorData.message || `Stargate quote failed: ${response.status}`)
        }

        const data = await response.json()

        if (!data.success || !data.data) {
          throw new Error(data.error || 'No Stargate quote available for this route')
        }

        const quoteData = data.data
        const toAmountFormatted = formatUnits(BigInt(quoteData.toAmount || '0'), dstTokenInfo.decimals)
        const inputAmount = parseFloat(amount)
        const outputAmount = parseFloat(toAmountFormatted)
        const rate = inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0'

        // Count steps for display
        const stepCount = quoteData.stargateSteps?.length || 1

        setQuote({
          toAmount: toAmountFormatted,
          toAmountRaw: quoteData.toAmount || '0',
          rate,
          gas: '0', // Stargate doesn't provide gas estimate in same format
          srcToken: {
            symbol: srcTokenInfo.symbol,
            name: srcTokenInfo.symbol,
            decimals: srcTokenInfo.decimals,
            address: srcTokenInfo.address,
          },
          dstToken: {
            symbol: dstTokenInfo.symbol,
            name: dstTokenInfo.symbol,
            decimals: dstTokenInfo.decimals,
            address: dstTokenInfo.address,
          },
          route: `${stepCount} step${stepCount > 1 ? 's' : ''} via Stargate`,
          protocol: 'stargate',
          bridgeTool: 'Stargate',
          steps: stepCount,
          routeData: quoteData,
        })
        setError(null)
        return
      }

      // Handle Wormhole bridge quotes
      if (protocol === 'wormhole') {
        // Get token info from Wormhole registry
        const fromChainTokens = WORMHOLE_TOKENS[chainId]
        const toChainTokens = WORMHOLE_TOKENS[toChainId || chainId]

        if (!fromChainTokens) {
          throw new Error(`Chain ${chainId} not supported by Wormhole`)
        }
        if (!toChainTokens) {
          throw new Error(`Chain ${toChainId || chainId} not supported by Wormhole`)
        }

        const srcTokenAddress = fromChainTokens[fromToken.toLowerCase()]
        const dstTokenAddress = toChainTokens[toToken.toLowerCase()]

        if (!srcTokenAddress) {
          const available = Object.keys(fromChainTokens).map(t => t.toUpperCase()).join(', ')
          throw new Error(`Token ${fromToken} not supported on Wormhole. Available: ${available}`)
        }
        if (!dstTokenAddress) {
          const available = Object.keys(toChainTokens).map(t => t.toUpperCase()).join(', ')
          throw new Error(`Token ${toToken} not supported on Wormhole. Available: ${available}`)
        }

        const srcDecimals = WORMHOLE_DECIMALS[fromToken.toLowerCase()] || 18
        const dstDecimals = WORMHOLE_DECIMALS[toToken.toLowerCase()] || 18

        // Call Wormhole quote API - Wormhole SDK expects human-readable amount (e.g., "10" not "10000000")
        const response = await fetch('/api/wormhole/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sourceChainId: chainId,
            destChainId: toChainId || chainId,
            fromToken: fromToken.toUpperCase(),
            toToken: toToken.toUpperCase(),
            amount: amount, // Human-readable amount for Wormhole SDK
            sourceAddress: walletAddress,
            destAddress: walletAddress,
          }),
        })

        if (currentRequestId !== requestIdRef.current) return

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to get Wormhole quote' }))
          throw new Error(errorData.error || errorData.message || `Wormhole quote failed: ${response.status}`)
        }

        const data = await response.json()

        if (!data.success || !data.data) {
          throw new Error(data.error || 'No Wormhole quote available for this route')
        }

        const quoteData = data.data
        const bestRoute = quoteData.bestRoute

        // Extract output amount from quote
        // formatQuoteForAPI returns: { destinationToken: { amount, decimals, symbol } }
        let toAmountFormatted = amount // Default to input amount
        const destToken = bestRoute?.quote?.destinationToken
        if (destToken?.amount) {
          // Amount is a direct string, decimals is a direct number
          const destAmountRaw = BigInt(destToken.amount)
          const destTokenDecimals = destToken.decimals || dstDecimals
          toAmountFormatted = formatUnits(destAmountRaw, destTokenDecimals)
        }

        const inputAmount = parseFloat(amount)
        const outputAmount = parseFloat(toAmountFormatted)
        const rate = inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0'

        // Extract ETA from best route
        const etaString = bestRoute?.eta || '~15 min'
        const etaMinutes = etaString.includes('min')
          ? parseInt(etaString.replace(/[^0-9]/g, '')) || 15
          : etaString.includes('hr')
          ? (parseInt(etaString.replace(/[^0-9]/g, '')) || 1) * 60
          : 15

        // Extract relay fee - bestRoute.relayFee has { amount, decimals, symbol }
        let relayFeeInfo: { amount: string; symbol: string; formatted: string } | undefined
        const relayFee = bestRoute?.relayFee
        if (relayFee?.amount) {
          const feeAmount = BigInt(relayFee.amount)
          const feeDecimals = relayFee.decimals || 6
          const feeFormatted = formatUnits(feeAmount, feeDecimals)
          relayFeeInfo = {
            amount: relayFee.amount,
            symbol: relayFee.symbol || fromToken.toUpperCase(),
            formatted: `${parseFloat(feeFormatted).toFixed(6)} ${relayFee.symbol || fromToken.toUpperCase()}`,
          }
        }

        setQuote({
          toAmount: toAmountFormatted,
          toAmountRaw: toAmountFormatted, // Keep as formatted for Wormhole
          rate,
          gas: '0',
          srcToken: {
            symbol: fromToken.toUpperCase(),
            name: fromToken.toUpperCase(),
            decimals: srcDecimals,
            address: srcTokenAddress,
          },
          dstToken: {
            symbol: toToken.toUpperCase(),
            name: toToken.toUpperCase(),
            decimals: dstDecimals,
            address: dstTokenAddress,
          },
          route: bestRoute?.name || 'Wormhole',
          protocol: 'wormhole',
          estimatedTime: etaMinutes * 60, // Convert to seconds
          bridgeTool: bestRoute?.name || 'Wormhole',
          steps: 1,
          routeData: quoteData,
          relayFee: relayFeeInfo,
        })
        setError(null)
        return
      }

      // Handle Li.Fi bridge quotes
      if (protocol === 'lifi') {
        // Get token info from Li.Fi registry
        const fromChainTokens = LIFI_TOKENS[chainId as keyof typeof LIFI_TOKENS]
        const toChainTokens = LIFI_TOKENS[(toChainId || chainId) as keyof typeof LIFI_TOKENS]

        const srcTokenInfo = fromChainTokens?.[fromToken.toUpperCase() as keyof typeof fromChainTokens]
        const dstTokenInfo = toChainTokens?.[toToken.toUpperCase() as keyof typeof toChainTokens]

        if (!srcTokenInfo) {
          throw new Error(`Token ${fromToken} not supported on chain ${chainId}`)
        }
        if (!dstTokenInfo) {
          throw new Error(`Token ${toToken} not supported on chain ${toChainId || chainId}`)
        }

        const amountInUnits = parseUnits(amount, srcTokenInfo.decimals).toString()

        // Call Li.Fi routes API
        const response = await fetch('/api/lifi/routes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            fromChainId: chainId,
            toChainId: toChainId || chainId,
            fromTokenAddress: srcTokenInfo.address,
            toTokenAddress: dstTokenInfo.address,
            fromAmount: amountInUnits,
            fromAddress: walletAddress,
            toAddress: walletAddress,
            options: {
              slippage: slippage / 100, // Li.Fi uses decimal (0.005 for 0.5%)
            },
          }),
        })

        if (currentRequestId !== requestIdRef.current) return

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Failed to get bridge quote' }))
          throw new Error(errorData.error || errorData.message || `Bridge quote failed: ${response.status}`)
        }

        const data = await response.json()

        if (!data.routes || data.routes.length === 0) {
          throw new Error('No bridge routes available for this pair')
        }

        const bestRoute = data.routes[0]
        const toAmountFormatted = formatUnits(BigInt(bestRoute.toAmount), dstTokenInfo.decimals)
        const inputAmount = parseFloat(amount)
        const outputAmount = parseFloat(toAmountFormatted)
        const rate = inputAmount > 0 ? (outputAmount / inputAmount).toFixed(6) : '0'

        // Extract bridge tool name from first step
        const bridgeTool = bestRoute.steps?.[0]?.toolDetails?.name || bestRoute.steps?.[0]?.tool || 'Li.Fi'

        setQuote({
          toAmount: toAmountFormatted,
          toAmountRaw: bestRoute.toAmount,
          rate,
          gas: bestRoute.gasCostUSD || '0',
          srcToken: {
            symbol: srcTokenInfo.symbol,
            name: srcTokenInfo.symbol,
            decimals: srcTokenInfo.decimals,
            address: srcTokenInfo.address,
          },
          dstToken: {
            symbol: dstTokenInfo.symbol,
            name: dstTokenInfo.symbol,
            decimals: dstTokenInfo.decimals,
            address: dstTokenInfo.address,
          },
          route: `${bestRoute.steps?.length || 1} step${bestRoute.steps?.length > 1 ? 's' : ''} via ${bridgeTool}`,
          protocol: 'lifi',
          estimatedTime: bestRoute.steps?.reduce((acc: number, s: { estimate?: { executionDuration?: number } }) => acc + (s.estimate?.executionDuration || 0), 0),
          gasCostUSD: bestRoute.gasCostUSD,
          bridgeTool,
          steps: bestRoute.steps?.length || 1,
          routeData: bestRoute,
        })
        setError(null)
        return
      }

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

    // Check if bridge protocol (allows same token src/dst for cross-chain)
    const isBridgeProtocol = params?.protocol === 'lifi' || params?.protocol === 'stargate' || params?.protocol === 'wormhole'
    const isCrossChain = params?.toChainId && params.toChainId !== params?.chainId
    const sameTokenAllowed = isBridgeProtocol && isCrossChain

    // Don't debounce if params are null/invalid or tokens are the same (unless bridge)
    if (
      !params ||
      !params.amount ||
      parseFloat(params.amount) <= 0 ||
      (params.fromToken.toLowerCase() === params.toToken.toLowerCase() && !sameTokenAllowed)
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
    params?.toChainId,
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
