/**
 * Wormhole Bridge Utilities
 *
 * Chain mappings, SDK initialization, and helper functions for Wormhole bridge
 */

import { WalletClient } from 'viem'
import type { Chain } from 'viem'

/**
 * Chain ID to Wormhole chain name mapping
 * Maps EVM chain IDs to Wormhole chain identifiers
 */
export const WORMHOLE_CHAIN_MAP: Record<number, string> = {
  1: 'Ethereum',
  137: 'Polygon',
  42161: 'Arbitrum',
  10: 'Optimism',
  8453: 'Base',
  56: 'Bsc',
  43114: 'Avalanche',
}

/**
 * Reverse mapping: Wormhole chain name to chain ID
 */
export const CHAIN_ID_FROM_WORMHOLE: Record<string, number> = {
  Ethereum: 1,
  Polygon: 137,
  Arbitrum: 42161,
  Optimism: 10,
  Base: 8453,
  Bsc: 56,
  Avalanche: 43114,
}

/**
 * Common token addresses per chain
 */
export const TOKEN_ADDRESSES: Record<number, Record<string, string>> = {
  // Ethereum
  1: {
    usdc: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    usdt: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
    weth: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
    wbtc: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
  },
  // Base
  8453: {
    usdc: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
    weth: '0x4200000000000000000000000000000000000006',
  },
  // Arbitrum
  42161: {
    usdc: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
    usdt: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
    weth: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1',
    wbtc: '0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f',
  },
  // Optimism
  10: {
    usdc: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85',
    usdt: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58',
    weth: '0x4200000000000000000000000000000000000006',
    wbtc: '0x68f180fcCe6836688e9084f035309E29Bf0A2095',
  },
  // Polygon
  137: {
    usdc: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
    usdt: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
    weth: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619',
    wbtc: '0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6',
  },
  // BSC
  56: {
    usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
    usdt: '0x55d398326f99059fF775485246999027B3197955',
    weth: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
    wbtc: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c',
  },
  // Avalanche
  43114: {
    usdc: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E',
    usdt: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7',
    weth: '0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB',
    wbtc: '0x50b7545627a5162F82A992c33b87aDc75187B218',
  },
}

/**
 * Native token placeholder address (used by Wormhole SDK)
 */
export const NATIVE_TOKEN_ADDRESS = '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

/**
 * Token decimals mapping
 */
export const TOKEN_DECIMALS: Record<string, number> = {
  usdc: 6,
  usdt: 6,
  weth: 18,
  wbtc: 8,
  eth: 18,
  native: 18,
}

/**
 * Get token decimals
 */
export function getTokenDecimals(tokenSymbol: string): number {
  return TOKEN_DECIMALS[tokenSymbol.toLowerCase()] || 18
}

/**
 * Get Wormhole chain name from chain ID
 */
export function getWormholeChainName(chainId: number): string | undefined {
  return WORMHOLE_CHAIN_MAP[chainId]
}

/**
 * Get chain ID from Wormhole chain name
 */
export function getChainIdFromWormhole(chainName: string): number | undefined {
  return CHAIN_ID_FROM_WORMHOLE[chainName]
}

/**
 * Check if chain is supported by Wormhole
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in WORMHOLE_CHAIN_MAP
}

/**
 * Get chain ID from chain name (lowercase)
 */
export function getChainIdFromName(chainName: string): number | undefined {
  const lowerName = chainName.toLowerCase()
  const nameToId: Record<string, number> = {
    ethereum: 1,
    polygon: 137,
    arbitrum: 42161,
    optimism: 10,
    base: 8453,
    bsc: 56,
    avalanche: 43114,
  }
  return nameToId[lowerName]
}

/**
 * Resolve token address from symbol and chain ID
 */
export function resolveTokenAddress(chainId: number, symbol: string): string | undefined {
  const chainTokens = TOKEN_ADDRESSES[chainId]
  if (!chainTokens) return undefined

  const lowerSymbol = symbol.toLowerCase()
  return chainTokens[lowerSymbol]
}

/**
 * Check if token address is native token
 */
export function isNativeToken(address: string): boolean {
  return address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
}

/**
 * Route type definitions
 */
export enum WormholeRouteType {
  AUTOMATIC_CCTP = 'AutomaticCCTPRoute',
  CCTP = 'CCTPRoute',
  AUTOMATIC_TOKEN_BRIDGE = 'AutomaticTokenBridgeRoute',
  TOKEN_BRIDGE = 'TokenBridgeRoute',
}

/**
 * Route display information
 */
export interface RouteInfo {
  type: WormholeRouteType
  name: string
  description: string
  isAutomatic: boolean
  estimatedTimeMinutes: number
}

/**
 * Get route display information
 */
export function getRouteInfo(routeType: string): RouteInfo {
  switch (routeType) {
    case WormholeRouteType.AUTOMATIC_CCTP:
      return {
        type: WormholeRouteType.AUTOMATIC_CCTP,
        name: 'Automatic CCTP',
        description: 'Fast USDC transfer with automatic relayer (~15 min)',
        isAutomatic: true,
        estimatedTimeMinutes: 15,
      }
    case WormholeRouteType.CCTP:
      return {
        type: WormholeRouteType.CCTP,
        name: 'CCTP',
        description: 'Fast USDC transfer, manual claim (~15 min)',
        isAutomatic: false,
        estimatedTimeMinutes: 15,
      }
    case WormholeRouteType.AUTOMATIC_TOKEN_BRIDGE:
      return {
        type: WormholeRouteType.AUTOMATIC_TOKEN_BRIDGE,
        name: 'Automatic Token Bridge',
        description: 'Token bridge with automatic relayer',
        isAutomatic: true,
        estimatedTimeMinutes: 30,
      }
    case WormholeRouteType.TOKEN_BRIDGE:
      return {
        type: WormholeRouteType.TOKEN_BRIDGE,
        name: 'Token Bridge',
        description: 'Manual token bridge (~12+ days to finalize)',
        isAutomatic: false,
        estimatedTimeMinutes: 17280, // 12 days
      }
    default:
      return {
        type: WormholeRouteType.TOKEN_BRIDGE,
        name: 'Unknown Route',
        description: routeType,
        isAutomatic: false,
        estimatedTimeMinutes: 0,
      }
  }
}

/**
 * Format ETA from milliseconds to human-readable string
 */
export function formatETA(etaMs: number): string {
  const minutes = Math.floor(etaMs / 60000)

  if (minutes < 60) {
    return `~${minutes} min`
  }

  const hours = Math.floor(minutes / 60)
  if (hours < 24) {
    return `~${hours} hr`
  }

  const days = Math.floor(hours / 24)
  return `~${days} days`
}

/**
 * Format relay fee
 */
export interface RelayFee {
  amount: string
  symbol: string
  decimals: number
}

export function formatRelayFee(fee?: { amount: { amount: string; decimals: number }; token: { symbol: string } }): RelayFee | null {
  if (!fee) return null

  return {
    amount: fee.amount.amount,
    symbol: fee.token.symbol,
    decimals: fee.amount.decimals,
  }
}

/**
 * Wormhole quote response structure
 */
export interface WormholeQuote {
  success: boolean
  eta?: number
  relayFee?: RelayFee
  sourceToken?: any
  destinationToken?: any
  error?: string
}

/**
 * Wormhole route summary
 */
export interface RouteSummary {
  type: string
  name: string
  description: string
  isAutomatic: boolean
  eta: string
  relayFee: RelayFee | null
  quote: WormholeQuote
}

/**
 * Format route summary from quote
 */
export function formatRouteSummary(route: any, quote: WormholeQuote): RouteSummary {
  const routeType = route?.constructor?.name || 'Unknown'
  const info = getRouteInfo(routeType)

  return {
    type: routeType,
    name: info.name,
    description: info.description,
    isAutomatic: info.isAutomatic,
    eta: quote.eta ? formatETA(quote.eta) : formatETA(info.estimatedTimeMinutes * 60000),
    relayFee: quote.relayFee || null,
    quote,
  }
}

/**
 * Serializable transfer request
 */
export interface SerializedTransferRequest {
  sourceChain: string
  destChain: string
  sourceToken: string
  destToken: string
  amount: string
  sender: string
  receiver: string
}
