/**
 * Stargate Bridge Utilities
 *
 * Chain mappings, quote transformers, and helper functions for Stargate bridge
 */

/**
 * Chain ID to Stargate chain key mapping
 * Maps EVM chain IDs to Stargate API chain keys
 */
export const CHAIN_KEY_MAP: Record<number, string> = {
  1: 'ethereum',
  137: 'polygon',
  42161: 'arbitrum',
  10: 'optimism',
  8453: 'base',
  56: 'bsc',
  43114: 'avalanche',
}

/**
 * Reverse mapping: Stargate chain key to chain ID
 */
export const CHAIN_ID_MAP: Record<string, number> = {
  ethereum: 1,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
  bsc: 56,
  avalanche: 43114,
}

/**
 * Get Stargate chain key from chain ID
 */
export function getStargateChainKey(chainId: number): string | undefined {
  return CHAIN_KEY_MAP[chainId]
}

/**
 * Get chain ID from Stargate chain key
 */
export function getChainIdFromKey(chainKey: string): number | undefined {
  return CHAIN_ID_MAP[chainKey]
}

/**
 * Check if chain is supported by Stargate
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in CHAIN_KEY_MAP
}

/**
 * Calculate minimum destination amount with slippage
 * @param amount Source amount in base units
 * @param slippagePercent Slippage tolerance (e.g., 0.5 for 0.5%)
 */
export function calculateMinDestAmount(amount: string, slippagePercent: number = 0.5): string {
  const slippageMultiplier = 1 - (slippagePercent / 100)
  const minAmount = Math.floor(parseInt(amount) * slippageMultiplier)
  return minAmount.toString()
}

/**
 * Stargate quote step types
 */
export interface StargateStep {
  type: string
  transaction?: {
    to?: `0x${string}`
    data?: `0x${string}`
    value?: string
    gas?: string
    gasLimit?: string
  }
}

/**
 * Stargate quote response
 */
export interface StargateQuote {
  dstAmount?: string
  amountLD?: string
  steps?: StargateStep[]
  // Add other fields as needed
}

/**
 * Transform Stargate quote to bridge data
 */
export function transformStargateQuote(
  quote: StargateQuote,
  fromAmount: string,
  fromChainId: number,
  toChainId: number
) {
  return {
    fromAmount,
    toAmount: quote.dstAmount || quote.amountLD || '0',
    fromChainId,
    toChainId,
    stargateSteps: quote.steps || [],
    fullQuote: quote,
  }
}
