'use client'

/**
 * Portfolio pie chart component for visualizing token balance distribution
 */

import { useState, useEffect, useMemo, useRef } from 'react'
import type { EChartsOption } from 'echarts'
import { BaseChart } from './base-chart'
import type { PortfolioData, PortfolioTokenBalance } from '@/types/charts'
import { useAccount } from 'wagmi'
import { useTokenBalances } from '@/hooks/useTokenBalances'
import { getCommonTokensForChain } from '@/plugins/1inch/tokens'
import { RefreshCw, ChevronDown } from 'lucide-react'

export interface PortfolioChartProps {
  chainIds?: number[]
  walletAddress?: string
  height?: number
  className?: string
  resizeKey?: number
}

// Export helper to get display address for window title
export function getPortfolioDisplayAddress(address?: string): string {
  return address ? `${address.slice(0, 6)}...${address.slice(-4)}` : 'Not connected'
}

// Chain ID to name mapping
const CHAIN_NAMES: Record<number, string> = {
  1: 'Ethereum',
  10: 'Optimism',
  137: 'Polygon',
  8453: 'Base',
  42161: 'Arbitrum',
}

// Extended color palette for more tokens
const TOKEN_COLORS = [
  '#059669', // Dark green
  '#3B82F6', // Blue
  '#F59E0B', // Amber
  '#8B5CF6', // Purple
  '#EC4899', // Pink
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#F97316', // Orange
  '#06B6D4', // Cyan
  '#A855F7', // Violet
  '#84CC16', // Lime
  '#F43F5E', // Rose
]

export function PortfolioChart({
  chainIds = [1],
  walletAddress,
  height = 400,
  className = '',
  resizeKey,
}: PortfolioChartProps) {
  const { address } = useAccount()
  const [portfolioData, setPortfolioData] = useState<PortfolioData | null>(null)
  const [isLoadingPrices, setIsLoadingPrices] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Use provided wallet address or connected account
  const effectiveAddress = (walletAddress || address) as `0x${string}` | undefined

  // Get token lists for each chain
  const tokensByChain = useMemo(() => {
    return chainIds.map(chainId => ({
      chainId,
      tokens: getCommonTokensForChain(chainId),
    }))
  }, [chainIds])

  // Fetch balances for each chain using the hook
  // Note: We can only call hooks at the top level, so we'll fetch for first few chains
  // For now, support up to 3 chains (most common use case)
  const chain1 = chainIds[0]
  const chain2 = chainIds[1]
  const chain3 = chainIds[2]

  const tokens1 = tokensByChain.find(t => t.chainId === chain1)?.tokens || []
  const tokens2 = tokensByChain.find(t => t.chainId === chain2)?.tokens || []
  const tokens3 = tokensByChain.find(t => t.chainId === chain3)?.tokens || []

  const { balances: balances1, isLoading: loading1 } = useTokenBalances(effectiveAddress, chain1, tokens1)
  const { balances: balances2, isLoading: loading2 } = useTokenBalances(effectiveAddress, chain2, tokens2)
  const { balances: balances3, isLoading: loading3 } = useTokenBalances(effectiveAddress, chain3, tokens3)

  const isLoadingBalances = loading1 || loading2 || loading3

  // Combine all balances
  const allBalances = useMemo(() => {
    const combined = [
      ...balances1.map(b => ({ ...b, chainId: chain1 })),
      ...(chain2 ? balances2.map(b => ({ ...b, chainId: chain2 })) : []),
      ...(chain3 ? balances3.map(b => ({ ...b, chainId: chain3 })) : []),
    ]

    console.log('[PortfolioChart] Combined balances:', combined)
    return combined
  }, [balances1, balances2, balances3, chain1, chain2, chain3])

  // Track which balances we've already fetched prices for to prevent infinite loop
  const fetchedBalancesRef = useRef<string>('')
  const [refreshTrigger, setRefreshTrigger] = useState(0)

  // Handler to refresh portfolio data
  const handleRefresh = () => {
    fetchedBalancesRef.current = '' // Clear the fetched cache
    setRefreshTrigger(prev => prev + 1) // Trigger re-fetch
  }

  // Fetch USD prices for all tokens
  useEffect(() => {
    if (!effectiveAddress || allBalances.length === 0 || isLoadingBalances) {
      return
    }

    // Create stable identifier for current balances
    const balancesKey = allBalances
      .map(b => `${b.chainId}-${b.tokenAddress}-${b.balance}`)
      .sort()
      .join('|')

    // Skip if we've already fetched prices for these exact balances
    if (fetchedBalancesRef.current === balancesKey) {
      return
    }

    const fetchPrices = async () => {
      setIsLoadingPrices(true)
      setError(null)

      try {
        console.log('[PortfolioChart] Fetching prices for', allBalances.length, 'tokens')

        // Fetch prices for all tokens in parallel
        const pricePromises = allBalances.map(async (balance) => {
          try {
            // Convert native token address (0xEeee...EEeE) to wrapped token for price lookup
            let priceTokenAddress = balance.tokenAddress
            if (balance.tokenAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee') {
              // Map native to wrapped token for each chain
              const wrappedTokens: Record<number, string> = {
                1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
                10: '0x4200000000000000000000000000000000000006', // WETH on Optimism
                137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // WMATIC
                8453: '0x4200000000000000000000000000000000000006', // WETH on Base
                42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH on Arbitrum
              }
              priceTokenAddress = wrappedTokens[balance.chainId] || balance.tokenAddress
            }

            const url = `/api/1inch/prices/price_by_token?chainId=${balance.chainId}&token=${priceTokenAddress}`
            const response = await fetch(url)

            if (!response.ok) {
              console.warn(`Failed to fetch price for ${balance.symbol} on chain ${balance.chainId}`)
              return { ...balance, usdValue: 0, percentage: 0 }
            }

            const data = await response.json() as { price: number }
            const price = data.price || 0
            const usdValue = parseFloat(balance.formattedBalance) * price

            return {
              ...balance,
              usdValue,
              percentage: 0, // Will calculate after we have total
            }
          } catch (err) {
            console.error(`Error fetching price for ${balance.symbol}:`, err)
            return { ...balance, usdValue: 0, percentage: 0 }
          }
        })

        const balancesWithPrices = await Promise.all(pricePromises)

        // Calculate total USD value
        const totalUsdValue = balancesWithPrices.reduce((sum, token) => sum + (token.usdValue || 0), 0)

        // Calculate percentages
        const tokensWithPercentages: PortfolioTokenBalance[] = balancesWithPrices.map(token => ({
          symbol: token.symbol,
          name: token.name,
          tokenAddress: token.tokenAddress,
          chainId: token.chainId,
          chainName: CHAIN_NAMES[token.chainId],
          balance: token.balance,
          formattedBalance: token.formattedBalance,
          usdValue: token.usdValue || 0,
          percentage: totalUsdValue > 0 ? ((token.usdValue || 0) / totalUsdValue) * 100 : 0,
        }))

        // Sort by USD value
        tokensWithPercentages.sort((a, b) => b.usdValue - a.usdValue)

        console.log('[PortfolioChart] Final portfolio data:', {
          tokens: tokensWithPercentages.length,
          totalUsdValue,
        })

        setPortfolioData({
          tokens: tokensWithPercentages,
          totalUsdValue,
          chains: chainIds,
        })

        // Mark these balances as fetched
        fetchedBalancesRef.current = balancesKey
      } catch (err) {
        console.error('[PortfolioChart] Error fetching prices:', err)
        setError(err instanceof Error ? err.message : 'Failed to fetch token prices')
      } finally {
        setIsLoadingPrices(false)
      }
    }

    fetchPrices()
  }, [allBalances, effectiveAddress, chainIds, isLoadingBalances, refreshTrigger])

  // Combine loading states
  const isLoading = isLoadingBalances || isLoadingPrices

  // Build ECharts option
  const option: EChartsOption = useMemo(() => {
    if (!portfolioData || !portfolioData.tokens || portfolioData.tokens.length === 0) {
      return {
        title: {
          text: isLoading ? 'Loading...' : error || 'No Data',
          left: 'center',
          top: 'center',
          textStyle: {
            color: '#737373',
            fontSize: 14,
          },
        },
      }
    }

    const { tokens, totalUsdValue } = portfolioData

    // Ensure totalUsdValue is a valid number
    const safeTotal = typeof totalUsdValue === 'number' && !isNaN(totalUsdValue) ? totalUsdValue : 0

    // Format data for pie chart
    // If all tokens have 0 USD value, use balance instead
    const hasAnyUsdValue = tokens.some(t => t.usdValue > 0)

    const pieData = tokens.map((token, index) => {
      // Use USD value if available, otherwise use formatted balance as a fallback for visualization
      const displayValue = hasAnyUsdValue
        ? token.usdValue
        : parseFloat(token.formattedBalance) || 0

      return {
        name: token.chainId !== chainIds[0] || tokens.filter(t => t.symbol === token.symbol).length > 1
          ? `${token.symbol} (${CHAIN_NAMES[token.chainId] || `Chain ${token.chainId}`})`
          : token.symbol,
        value: displayValue,
        itemStyle: {
          color: TOKEN_COLORS[index % TOKEN_COLORS.length],
        },
        // Store additional data for tooltip
        tokenData: token,
      }
    }).filter(item => item.value > 0) // Only show tokens with actual value

    console.log('[PortfolioChart] Pie data:', pieData)

    return {
      grid: {
        show: false,
        top: 90, // Space for header text
        bottom: 20,
        left: 20,
        right: 20,
      },
      xAxis: {
        show: false,
      },
      yAxis: {
        show: false,
      },
      tooltip: {
        trigger: 'item',
        backgroundColor: '#262626',
        borderColor: '#404040',
        textStyle: {
          color: '#E5E5E5',
          fontFamily: 'monospace',
          fontSize: 12,
        },
        formatter: (params: any) => {
          const token = params.data.tokenData as PortfolioTokenBalance
          const usdValue = token.usdValue.toLocaleString(undefined, {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          })
          const percentage = token.percentage.toFixed(2)

          return `
            <div style="padding: 4px;">
              <div style="font-weight: bold; margin-bottom: 6px;">
                ${token.symbol}
              </div>
              <div style="margin-bottom: 2px;">
                <span style="color: #9ca3af;">Chain:</span> ${token.chainName || `Chain ${token.chainId}`}
              </div>
              <div style="margin-bottom: 2px;">
                <span style="color: #9ca3af;">Balance:</span> ${token.formattedBalance}
              </div>
              <div style="margin-bottom: 2px;">
                <span style="color: #9ca3af;">Value:</span> $${usdValue}
              </div>
              <div>
                <span style="color: #9ca3af;">Share:</span> ${percentage}%
              </div>
            </div>
          `
        },
      },
      legend: {
        orient: 'vertical',
        right: '5%',
        top: 'center',
        textStyle: {
          color: '#E5E5E5',
          fontSize: 11,
        },
        formatter: (name: string) => {
          const token = tokens.find(t => {
            const displayName = t.chainId !== chainIds[0] || tokens.filter(t2 => t2.symbol === t.symbol).length > 1
              ? `${t.symbol} (${CHAIN_NAMES[t.chainId] || `Chain ${t.chainId}`})`
              : t.symbol
            return displayName === name
          })
          if (token) {
            return `{name|${name}}\n{value|${token.percentage.toFixed(1)}%}`
          }
          return name
        },
        textStyle: {
          rich: {
            name: {
              color: '#E5E5E5',
              fontSize: 11,
              lineHeight: 16,
            },
            value: {
              color: '#737373',
              fontSize: 10,
              lineHeight: 14,
            },
          },
        },
      },
      series: [
        {
          type: 'pie',
          radius: ['45%', '70%'], // Donut chart
          center: ['50%', '50%'], // Centered accounting for legend on right
          avoidLabelOverlap: false,
          itemStyle: {
            borderRadius: 4,
            borderColor: '#141414',
            borderWidth: 2,
          },
          label: {
            show: false,
          },
          emphasis: {
            label: {
              show: true,
              fontSize: 14,
              fontWeight: 'bold',
              color: '#E5E5E5',
              formatter: (params: any) => {
                const token = params.data.tokenData as PortfolioTokenBalance
                return `${token.symbol}\n${token.percentage.toFixed(1)}%`
              },
            },
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)',
            },
          },
          labelLine: {
            show: false,
          },
          data: pieData,
        },
      ],
    }
  }, [portfolioData, isLoading, error, chainIds])

  // Calculate aspect ratio (1:1)
  // The chart container will use the same value for width and height
  const chartHeight = height

  // Format wallet address for display
  const displayAddress = effectiveAddress
    ? `${effectiveAddress.slice(0, 6)}...${effectiveAddress.slice(-4)}`
    : 'Not connected'

  // Format USD value
  const formattedValue = portfolioData?.totalUsdValue?.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }) || '0.00'

  // Get chain names
  const chainNames = chainIds.map(id => CHAIN_NAMES[id] || `Chain ${id}`).join(', ')

  return (
    <div className={`relative ${className}`}>
      {/* Header with portfolio info and controls - absolute positioned */}
      <div className="absolute top-2 left-2 right-2 z-10">
        <div className="flex items-center justify-between pl-1 pr-1">
          {/* Price (left) */}
          <div className="text-sm font-mono font-bold text-[#E5E5E5]">
            ${formattedValue} USD
          </div>
          {/* Total Portfolio Value (center, larger) */}
          <div className="flex-1 text-center text-base font-semibold w-fit text-[#737373] italic mr-16">
            Total Portfolio Value ({displayAddress}) ({chainNames})
          </div>
          {/* Refresh button (right) */}
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isLoading}
              className="p-1 text-[#737373] hover:text-[#E5E5E5] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh portfolio"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>
      {/* Loading Spinner */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141414]/80 z-20 rounded-lg">
          <div className="flex flex-col items-center gap-3">
            <div className="w-10 h-10 border-4 border-[#404040] border-t-[#3B82F6] rounded-full animate-spin" />
            <span className="text-sm text-[#737373]">
              {isLoadingBalances ? 'Loading balances...' : 'Loading prices...'}
            </span>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && !isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#141414] z-10 rounded-lg">
          <div className="text-center px-4">
            <div className="text-sm text-[#EF4444] mb-2">Failed to load portfolio</div>
            <div className="text-xs text-[#737373]">{error}</div>
          </div>
        </div>
      )}

      <BaseChart option={option} height={chartHeight} resizeKey={resizeKey} />
    </div>
  )
}
