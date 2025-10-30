/**
 * Stargate Token Resolution
 *
 * Token address resolution for Stargate-supported tokens across chains
 */

/**
 * Supported tokens by chain
 * Focused on stablecoins that Stargate bridges
 */
export const STARGATE_TOKENS: Record<number, Record<string, { address: string; symbol: string; decimals: number }>> = {
  1: { // Ethereum
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', symbol: 'USDT', decimals: 6 },
  },
  137: { // Polygon
    USDC: { address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', symbol: 'USDC', decimals: 6 },
    USDT: { address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', symbol: 'USDT', decimals: 6 },
  },
  42161: { // Arbitrum
    USDC: { address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', symbol: 'USDC', decimals: 6 },
    'USDC.E': { address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', symbol: 'USDC.E', decimals: 6 },
    USDT: { address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', symbol: 'USDT', decimals: 6 },
  },
  10: { // Optimism
    USDC: { address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', symbol: 'USDC', decimals: 6 },
    'USDC.E': { address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', symbol: 'USDC.E', decimals: 6 },
    USDT: { address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', symbol: 'USDT', decimals: 6 },
  },
  8453: { // Base
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', symbol: 'USDC', decimals: 6 },
    USDbC: { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', symbol: 'USDbC', decimals: 6 },
  },
  56: { // BSC
    USDC: { address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', symbol: 'USDC', decimals: 18 },
    USDT: { address: '0x55d398326f99059fF775485246999027B3197955', symbol: 'USDT', decimals: 18 },
  },
  43114: { // Avalanche
    USDC: { address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', symbol: 'USDC', decimals: 6 },
    'USDC.E': { address: '0xA7D7079b0FEaD91F3e65f86E8915Cb59c1a4C664', symbol: 'USDC.E', decimals: 6 },
    USDT: { address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', symbol: 'USDT', decimals: 6 },
    'USDT.E': { address: '0xc7198437980c041c805A1EDcbA50c1Ce5db95118', symbol: 'USDT.E', decimals: 6 },
  },
}

/**
 * Resolve token address from symbol and chain ID
 */
export function resolveTokenAddress(symbol: string, chainId: number): string {
  const tokens = STARGATE_TOKENS[chainId]
  if (!tokens) {
    throw new Error(`Unsupported chain for Stargate bridging: ${chainId}`)
  }

  const token = tokens[symbol.toUpperCase()]
  if (!token) {
    const available = Object.keys(tokens).join(', ')
    throw new Error(
      `Token '${symbol}' not supported on protocol Stargate Bridge. Available tokens: ${available}`
    )
  }

  return token.address
}

/**
 * Get token decimals
 */
export function getTokenDecimals(symbol: string, chainId: number): number {
  const tokens = STARGATE_TOKENS[chainId]
  if (!tokens) {
    return 6 // Default to 6 for stablecoins
  }

  const token = tokens[symbol.toUpperCase()]
  return token?.decimals || 6
}

/**
 * Get token info (address + decimals)
 */
export function getTokenInfo(symbol: string, chainId: number): { address: string; decimals: number } {
  return {
    address: resolveTokenAddress(symbol, chainId),
    decimals: getTokenDecimals(symbol, chainId),
  }
}

/**
 * List supported tokens for a chain
 */
export function getSupportedTokens(chainId: number): string[] {
  const tokens = STARGATE_TOKENS[chainId]
  return tokens ? Object.keys(tokens) : []
}
