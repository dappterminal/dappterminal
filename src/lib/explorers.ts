/**
 * Block explorer URLs for different chains
 */

export const BLOCK_EXPLORERS: Record<number, { name: string; url: string }> = {
  // Ethereum Mainnet
  1: {
    name: 'Etherscan',
    url: 'https://etherscan.io',
  },
  // Optimism
  10: {
    name: 'Optimistic Etherscan',
    url: 'https://optimistic.etherscan.io',
  },
  // BSC
  56: {
    name: 'BscScan',
    url: 'https://bscscan.com',
  },
  // Polygon
  137: {
    name: 'PolygonScan',
    url: 'https://polygonscan.com',
  },
  // Arbitrum One
  42161: {
    name: 'Arbiscan',
    url: 'https://arbiscan.io',
  },
  // Avalanche C-Chain
  43114: {
    name: 'SnowTrace',
    url: 'https://snowtrace.io',
  },
  // Base
  8453: {
    name: 'BaseScan',
    url: 'https://basescan.org',
  },
}

/**
 * Get transaction URL for a given chain and transaction hash
 */
export function getTxUrl(chainId: number, txHash: string): string {
  const explorer = BLOCK_EXPLORERS[chainId]
  if (!explorer) {
    return `Chain ${chainId} tx: ${txHash}`
  }
  return `${explorer.url}/tx/${txHash}`
}

/**
 * Get address URL for a given chain and address
 */
export function getAddressUrl(chainId: number, address: string): string {
  const explorer = BLOCK_EXPLORERS[chainId]
  if (!explorer) {
    return `Chain ${chainId} address: ${address}`
  }
  return `${explorer.url}/address/${address}`
}

/**
 * Get token URL for a given chain and token address
 */
export function getTokenUrl(chainId: number, tokenAddress: string): string {
  const explorer = BLOCK_EXPLORERS[chainId]
  if (!explorer) {
    return `Chain ${chainId} token: ${tokenAddress}`
  }
  return `${explorer.url}/token/${tokenAddress}`
}

/**
 * Get block URL for a given chain and block number
 */
export function getBlockUrl(chainId: number, blockNumber: number): string {
  const explorer = BLOCK_EXPLORERS[chainId]
  if (!explorer) {
    return `Chain ${chainId} block: ${blockNumber}`
  }
  return `${explorer.url}/block/${blockNumber}`
}
