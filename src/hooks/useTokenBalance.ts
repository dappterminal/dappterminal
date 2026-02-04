/**
 * useTokenBalance Hook
 *
 * Fetches the balance of a single token for the connected wallet.
 * Handles both native tokens (ETH, MATIC, etc.) and ERC20 tokens.
 */

import { useBalance, useReadContract } from 'wagmi'
import { type Address, formatUnits } from 'viem'
import { useMemo } from 'react'
import { resolveTokenAddress, getTokenDecimals } from '@/plugins/1inch/tokens'

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: 'account', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

// Native token placeholder address used by 1inch and other aggregators
const NATIVE_TOKEN_ADDRESS = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee'

export interface TokenBalanceResult {
  /** Raw balance in smallest units */
  balance: bigint
  /** Human-readable formatted balance */
  formatted: string
  /** Token decimals */
  decimals: number
  /** Whether the balance is loading */
  isLoading: boolean
  /** Error if fetch failed */
  error: Error | null
}

/**
 * Hook to fetch the balance of a single token
 *
 * @param tokenSymbol - Token symbol (e.g., 'ETH', 'USDC') or address
 * @param walletAddress - Wallet address to check balance for
 * @param chainId - Chain ID
 *
 * @example
 * ```tsx
 * const { formatted, isLoading } = useTokenBalance('USDC', address, 1)
 * // formatted = "1234.56"
 * ```
 */
export function useTokenBalance(
  tokenSymbol: string | undefined,
  walletAddress: Address | undefined,
  chainId: number | undefined
): TokenBalanceResult {
  // Resolve token symbol to address
  const tokenAddress = useMemo(() => {
    if (!tokenSymbol || !chainId) return undefined
    const resolved = resolveTokenAddress(tokenSymbol, chainId)
    // Check if it's a valid address
    if (resolved.startsWith('0x') && resolved.length === 42) {
      return resolved.toLowerCase()
    }
    return undefined
  }, [tokenSymbol, chainId])

  const isNativeToken = tokenAddress?.toLowerCase() === NATIVE_TOKEN_ADDRESS

  // Get decimals for formatting
  const decimals = useMemo(() => {
    if (!tokenSymbol) return 18
    return getTokenDecimals(tokenSymbol)
  }, [tokenSymbol])

  // Fetch native token balance (ETH, MATIC, etc.)
  const {
    data: nativeBalance,
    isLoading: isLoadingNative,
    error: nativeError,
  } = useBalance({
    address: walletAddress,
    chainId,
    query: {
      enabled: !!walletAddress && !!chainId && isNativeToken,
    },
  })

  // Fetch ERC20 token balance
  const {
    data: erc20Balance,
    isLoading: isLoadingErc20,
    error: erc20Error,
  } = useReadContract({
    address: tokenAddress as Address,
    abi: ERC20_BALANCE_ABI,
    functionName: 'balanceOf',
    args: walletAddress ? [walletAddress] : undefined,
    chainId,
    query: {
      enabled: !!walletAddress && !!chainId && !!tokenAddress && !isNativeToken,
    },
  })

  // Process and return result
  return useMemo(() => {
    if (!tokenSymbol || !walletAddress || !chainId || !tokenAddress) {
      return {
        balance: BigInt(0),
        formatted: '0',
        decimals,
        isLoading: false,
        error: null,
      }
    }

    if (isNativeToken) {
      const balance = nativeBalance?.value ?? BigInt(0)
      const formatted = nativeBalance?.formatted ?? '0'
      return {
        balance,
        formatted: parseFloat(formatted).toFixed(6),
        decimals: nativeBalance?.decimals ?? 18,
        isLoading: isLoadingNative,
        error: nativeError as Error | null,
      }
    }

    // ERC20 token
    const balance = (erc20Balance as bigint) ?? BigInt(0)
    const formatted = formatUnits(balance, decimals)
    return {
      balance,
      formatted: parseFloat(formatted).toFixed(6),
      decimals,
      isLoading: isLoadingErc20,
      error: erc20Error as Error | null,
    }
  }, [
    tokenSymbol,
    walletAddress,
    chainId,
    tokenAddress,
    isNativeToken,
    nativeBalance,
    isLoadingNative,
    nativeError,
    erc20Balance,
    isLoadingErc20,
    erc20Error,
    decimals,
  ])
}
