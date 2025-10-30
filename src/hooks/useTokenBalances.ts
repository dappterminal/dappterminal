/**
 * useTokenBalances Hook
 *
 * Fetches token balances for a wallet address on a specific chain using multicall
 * Uses wagmi/viem client-side to avoid dependency on broken 1inch balance API
 */

import { useBalance, useReadContracts } from 'wagmi'
import { type Address } from 'viem'
import { useMemo } from 'react'

const ERC20_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'name',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

export interface TokenBalance {
  symbol: string
  name: string
  tokenAddress: string
  balance: string // raw balance as string
  formattedBalance: string // human-readable balance
  decimals: number
}

interface TokenInfo {
  symbol: string
  address: string
  decimals: number
  name?: string
}

/**
 * Hook to fetch token balances for a wallet on a specific chain
 */
export function useTokenBalances(
  walletAddress?: Address,
  chainId?: number,
  tokens?: TokenInfo[]
) {
  // Get native token balance (ETH, MATIC, etc)
  const { data: nativeBalance, isLoading: isLoadingNative } = useBalance({
    address: walletAddress,
    chainId,
    query: {
      enabled: !!walletAddress && !!chainId,
    },
  })

  // Prepare contracts for multicall
  const contracts = useMemo(() => {
    if (!walletAddress || !tokens || tokens.length === 0) return []

    return tokens
      .filter(token => token.address.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee')
      .map(token => ({
        address: token.address as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf' as const,
        args: [walletAddress],
        chainId,
      }))
  }, [walletAddress, tokens, chainId])

  // Fetch all ERC20 balances in one multicall
  const { data: balancesData, isLoading: isLoadingBalances, error } = useReadContracts({
    contracts,
    query: {
      enabled: contracts.length > 0,
    },
  })

  // Process results
  const balances = useMemo(() => {
    const results: TokenBalance[] = []

    // Add native token if we have balance
    if (nativeBalance && tokens) {
      const nativeToken = tokens.find(
        t => t.address.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      )

      if (nativeToken && nativeBalance.value > BigInt(0)) {
        results.push({
          symbol: nativeBalance.symbol || nativeToken.symbol,
          name: nativeToken.name || nativeBalance.symbol || 'Native Token',
          tokenAddress: nativeToken.address,
          balance: nativeBalance.value.toString(),
          formattedBalance: nativeBalance.formatted,
          decimals: nativeBalance.decimals,
        })
      }
    }

    // Add ERC20 tokens
    if (balancesData && tokens) {
      const erc20Tokens = tokens.filter(
        t => t.address.toLowerCase() !== '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'
      )

      balancesData.forEach((result, index) => {
        const token = erc20Tokens[index]
        if (!token) return

        // Check if the call was successful and has a result
        if (result.status === 'success' && result.result) {
          const balance = result.result as bigint

          // Only include tokens with non-zero balance
          if (balance > BigInt(0)) {
            const formattedBalance = (Number(balance) / Math.pow(10, token.decimals)).toFixed(6)

            results.push({
              symbol: token.symbol,
              name: token.name || token.symbol,
              tokenAddress: token.address,
              balance: balance.toString(),
              formattedBalance,
              decimals: token.decimals,
            })
          }
        }
      })
    }

    return results
  }, [nativeBalance, balancesData, tokens])

  return {
    balances,
    isLoading: isLoadingNative || isLoadingBalances,
    error: error as Error | null,
  }
}
