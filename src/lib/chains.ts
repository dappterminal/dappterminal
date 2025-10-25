/**
 * Centralized Chain Configuration
 *
 * Single source of truth for supported chains across all protocols.
 * This eliminates hardcoded chain maps and enables dynamic chain support.
 */

export interface ChainConfig {
  id: number
  name: string
  nativeCurrency: {
    name: string
    symbol: string
    decimals: number
  }
  rpcUrls: string[]
  blockExplorerUrls: string[]
  testnet?: boolean
}

/**
 * Supported chains across all protocols
 * Based on 1inch and LiFi supported chains
 */
export const SUPPORTED_CHAINS: Record<number, ChainConfig> = {
  // Ethereum Mainnet
  1: {
    id: 1,
    name: 'Ethereum',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://eth.llamarpc.com'],
    blockExplorerUrls: ['https://etherscan.io'],
  },

  // Optimism
  10: {
    id: 10,
    name: 'Optimism',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io'],
  },

  // Binance Smart Chain
  56: {
    id: 56,
    name: 'BNB Chain',
    nativeCurrency: {
      name: 'BNB',
      symbol: 'BNB',
      decimals: 18,
    },
    rpcUrls: ['https://bsc-dataseed.binance.org'],
    blockExplorerUrls: ['https://bscscan.com'],
  },

  // Polygon
  137: {
    id: 137,
    name: 'Polygon',
    nativeCurrency: {
      name: 'MATIC',
      symbol: 'MATIC',
      decimals: 18,
    },
    rpcUrls: ['https://polygon-rpc.com'],
    blockExplorerUrls: ['https://polygonscan.com'],
  },

  // Base
  8453: {
    id: 8453,
    name: 'Base',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org'],
  },

  // Arbitrum One
  42161: {
    id: 42161,
    name: 'Arbitrum',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },

  // Avalanche C-Chain
  43114: {
    id: 43114,
    name: 'Avalanche',
    nativeCurrency: {
      name: 'AVAX',
      symbol: 'AVAX',
      decimals: 18,
    },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://snowtrace.io'],
  },
} as const

/**
 * Get chain configuration by ID
 */
export function getChainConfig(chainId: number): ChainConfig | undefined {
  return SUPPORTED_CHAINS[chainId]
}

/**
 * Check if a chain is supported
 */
export function isChainSupported(chainId: number): boolean {
  return chainId in SUPPORTED_CHAINS
}

/**
 * Get chain name by ID
 */
export function getChainName(chainId: number): string {
  const config = getChainConfig(chainId)
  return config?.name ?? `Chain ${chainId}`
}

/**
 * Get native currency symbol for a chain
 */
export function getNativeCurrencySymbol(chainId: number): string {
  const config = getChainConfig(chainId)
  return config?.nativeCurrency.symbol ?? 'ETH'
}

/**
 * Get all supported chain IDs
 */
export function getSupportedChainIds(): number[] {
  return Object.keys(SUPPORTED_CHAINS).map(Number)
}

/**
 * Format error message for unsupported chains
 */
export function getUnsupportedChainError(chainId: number): string {
  const supportedChains = getSupportedChainIds()
  return `Chain ${chainId} is not supported. Supported chains: ${supportedChains.join(', ')}`
}

/**
 * Protocol-specific chain support
 */
export const PROTOCOL_CHAIN_SUPPORT = {
  '1inch': [1, 10, 56, 137, 8453, 42161, 43114],
  lifi: [1, 10, 56, 137, 8453, 42161, 43114],
  stargate: [1, 10, 56, 137, 42161, 43114],
  wormhole: [1, 10, 56, 137, 8453, 42161, 43114],
  'aave-v3': [1, 10, 137, 42161, 43114, 8453],
} as const

/**
 * Check if a protocol supports a specific chain
 */
export function isChainSupportedByProtocol(
  protocol: keyof typeof PROTOCOL_CHAIN_SUPPORT,
  chainId: number
): boolean {
  return PROTOCOL_CHAIN_SUPPORT[protocol].includes(chainId as any)
}

/**
 * Get supported chains for a protocol
 */
export function getProtocolSupportedChains(
  protocol: keyof typeof PROTOCOL_CHAIN_SUPPORT
): number[] {
  return [...PROTOCOL_CHAIN_SUPPORT[protocol]]
}
