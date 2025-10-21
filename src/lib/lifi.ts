/**
 * LiFi Shared Library
 *
 * Token and chain resolution helpers for LiFi bridge aggregator
 * Copied from lifi-api-nextjs for consistency
 */

import type { LiFiRoute, LiFiRouteSummary } from '@/plugins/lifi/types'

// ============================================================================
// Token Definitions
// ============================================================================

export const LIFI_TOKENS = {
  1: { // Ethereum Mainnet
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH', decimals: 18 },
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', symbol: 'WETH', decimals: 18 },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
    DAI: { address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', symbol: 'DAI', decimals: 18 },
    WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', symbol: 'WBTC', decimals: 8 },
  },
  137: { // Polygon
    MATIC: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'MATIC', decimals: 18 },
    WMATIC: { address: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', symbol: 'WMATIC', decimals: 18 },
    USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', decimals: 6 },
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6 },
    DAI: { address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', symbol: 'DAI', decimals: 18 },
    WETH: { address: '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619', symbol: 'WETH', decimals: 18 },
  },
  42161: { // Arbitrum
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH', decimals: 18 },
    WETH: { address: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', symbol: 'WETH', decimals: 18 },
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
    'USDC.E': { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC.E', decimals: 6 },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
    DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18 },
    ARB: { address: '0x912CE59144191C1204E64559FE8253a0e49E6548', symbol: 'ARB', decimals: 18 },
  },
  10: { // Optimism
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH', decimals: 18 },
    WETH: { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
    USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6 },
    USDT: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6 },
    DAI: { address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', symbol: 'DAI', decimals: 18 },
    OP: { address: '0x4200000000000000000000000000000000000042', symbol: 'OP', decimals: 18 },
  },
  8453: { // Base
    ETH: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'ETH', decimals: 18 },
    WETH: { address: '0x4200000000000000000000000000000000000006', symbol: 'WETH', decimals: 18 },
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    USDbC: { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', decimals: 6 },
    DAI: { address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', symbol: 'DAI', decimals: 18 },
  },
  56: { // BSC
    BNB: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'BNB', decimals: 18 },
    WBNB: { address: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', symbol: 'WBNB', decimals: 18 },
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
    BUSD: { address: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56', symbol: 'BUSD', decimals: 18 },
  },
  43114: { // Avalanche
    AVAX: { address: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE', symbol: 'AVAX', decimals: 18 },
    WAVAX: { address: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', symbol: 'WAVAX', decimals: 18 },
    USDC: { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6 },
    USDT: { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT', decimals: 6 },
    DAI: { address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', symbol: 'DAI', decimals: 18 },
  },
}

// ============================================================================
// Chain Definitions
// ============================================================================

export const LIFI_CHAINS = {
  1: { id: 1, name: 'Ethereum', shortName: 'ETH' },
  137: { id: 137, name: 'Polygon', shortName: 'MATIC' },
  42161: { id: 42161, name: 'Arbitrum', shortName: 'ARB' },
  10: { id: 10, name: 'Optimism', shortName: 'OP' },
  8453: { id: 8453, name: 'Base', shortName: 'BASE' },
  56: { id: 56, name: 'BSC', shortName: 'BSC' },
  43114: { id: 43114, name: 'Avalanche', shortName: 'AVAX' },
}

export type LiFiChainId = keyof typeof LIFI_CHAINS

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get chain name by ID
 */
export function getChainName(chainId: number): string {
  const chain = LIFI_CHAINS[chainId as LiFiChainId]
  return chain ? chain.name : `Chain ${chainId}`
}

/**
 * Get chain short name by ID
 */
export function getChainShortName(chainId: number): string {
  const chain = LIFI_CHAINS[chainId as LiFiChainId]
  return chain ? chain.shortName : `${chainId}`
}

/**
 * Resolve token address from symbol and chain ID
 */
export function resolveTokenAddress(symbol: string, chainId: number): string {
  const tokens = LIFI_TOKENS[chainId as LiFiChainId]
  if (!tokens) {
    throw new Error(`Chain ${chainId} not supported`)
  }

  const token = tokens[symbol.toUpperCase() as keyof typeof tokens]
  if (!token) {
    throw new Error(`Token ${symbol} not found on chain ${chainId}`)
  }

  return token.address
}

/**
 * Get token decimals from symbol and chain ID
 */
export function getTokenDecimals(symbol: string, chainId: number): number {
  const tokens = LIFI_TOKENS[chainId as LiFiChainId]
  if (!tokens) {
    return 18 // Default
  }

  const token = tokens[symbol.toUpperCase() as keyof typeof tokens]
  return token?.decimals ?? 18
}

/**
 * Resolve token info (address + decimals)
 */
export function resolveTokenInfo(
  symbol: string,
  chainId: number
): { address: string; decimals: number } | null {
  const tokens = LIFI_TOKENS[chainId as LiFiChainId]
  if (!tokens) {
    return null
  }

  const token = tokens[symbol.toUpperCase() as keyof typeof tokens]
  if (!token) {
    return null
  }

  return {
    address: token.address,
    decimals: token.decimals,
  }
}

/**
 * Parse chain input - accepts both chain ID (number) and chain name (string)
 */
export function parseChainInput(input: string): number | undefined {
  // Try parsing as number first
  const chainId = parseInt(input)
  if (!isNaN(chainId)) {
    return chainId
  }

  // Map chain names to IDs
  const chainNameMap: Record<string, number> = {
    ethereum: 1,
    eth: 1,
    polygon: 137,
    matic: 137,
    pol: 137,
    arbitrum: 42161,
    arb: 42161,
    optimism: 10,
    op: 10,
    base: 8453,
    bsc: 56,
    bnb: 56,
    avalanche: 43114,
    avax: 43114,
  }

  return chainNameMap[input.toLowerCase()]
}

/**
 * Format LiFi route for display
 */
export function formatRouteSummary(route: LiFiRoute): LiFiRouteSummary {
  // Calculate total duration
  const estimatedDuration = route.steps.reduce(
    (sum, step) => sum + step.estimate.executionDuration,
    0
  )

  // Extract bridge/DEX info from steps
  const steps = route.steps.map((step) => ({
    type: step.type,
    bridge: step.type === 'cross' ? step.action.fromChainId !== step.action.toChainId ? 'cross-chain' : undefined : undefined,
    dex: step.type === 'swap' ? 'swap' : undefined,
    estimatedTime: step.estimate.executionDuration,
  }))

  // Sum up total fees
  const totalFeeUSD = route.steps.reduce((sum, step) => {
    const feeCost = step.estimate.feeCosts?.reduce((feeSum, fee) => {
      return feeSum + parseFloat(fee.amountUSD || '0')
    }, 0) || 0
    return sum + feeCost
  }, 0)

  return {
    routeId: route.id,
    fromChain: getChainName(route.fromChainId),
    toChain: getChainName(route.toChainId),
    fromToken: route.steps[0]?.action.fromToken.symbol || 'Unknown',
    toToken: route.steps[route.steps.length - 1]?.action.toToken.symbol || 'Unknown',
    fromAmount: route.fromAmount,
    toAmount: route.toAmount,
    toAmountMin: route.toAmountMin,
    steps,
    totalGasUSD: route.gasCostUSD,
    totalFeeUSD: totalFeeUSD > 0 ? totalFeeUSD.toString() : undefined,
    estimatedDuration,
  }
}

/**
 * Check if chain is supported by LiFi
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in LIFI_CHAINS
}
