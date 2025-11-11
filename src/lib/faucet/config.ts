/**
 * Faucet Configuration
 *
 * Centralized configuration for faucet networks, amounts, and rate limits.
 * Loads from environment variables with sensible defaults.
 */

import { parseEther } from 'viem'

export interface FaucetNetworkConfig {
  network: string
  chainId: number
  displayName: string
  symbol: string
  amount: string // Amount in wei
  amountDisplay: string // Human-readable amount
  rpcUrl: string
  enabled: boolean
  cooldownPeriod: number // seconds
  minBalance?: string // Minimum faucet wallet balance (wei)
}

/**
 * Network configurations for supported testnets
 */
export const FAUCET_NETWORKS: Record<string, FaucetNetworkConfig> = {
  sepolia: {
    network: 'sepolia',
    chainId: 11155111,
    displayName: 'Sepolia Testnet',
    symbol: 'SEP',
    amount: parseEther(
      process.env.FAUCET_SEPOLIA_AMOUNT || '0.5'
    ).toString(),
    amountDisplay: process.env.FAUCET_SEPOLIA_AMOUNT || '0.5',
    rpcUrl: process.env.FAUCET_SEPOLIA_RPC || 'https://rpc.sepolia.org',
    enabled: true,
    cooldownPeriod: 86400, // 24 hours
    minBalance: parseEther('1').toString(), // Alert if below 1 ETH
  },
  holesky: {
    network: 'holesky',
    chainId: 17000,
    displayName: 'Holesky Testnet',
    symbol: 'HOL',
    amount: parseEther(
      process.env.FAUCET_HOLESKY_AMOUNT || '1.0'
    ).toString(),
    amountDisplay: process.env.FAUCET_HOLESKY_AMOUNT || '1.0',
    rpcUrl: process.env.FAUCET_HOLESKY_RPC || 'https://rpc.holesky.ethpandaops.io',
    enabled: true,
    cooldownPeriod: 86400, // 24 hours
    minBalance: parseEther('2').toString(), // Alert if below 2 ETH
  },
  'optimism-sepolia': {
    network: 'optimism-sepolia',
    chainId: 11155420,
    displayName: 'Optimism Sepolia',
    symbol: 'SEP',
    amount: parseEther(
      process.env.FAUCET_OPTIMISM_SEPOLIA_AMOUNT || '0.3'
    ).toString(),
    amountDisplay: process.env.FAUCET_OPTIMISM_SEPOLIA_AMOUNT || '0.3',
    rpcUrl: process.env.FAUCET_OPTIMISM_SEPOLIA_RPC || 'https://sepolia.optimism.io',
    enabled: true,
    cooldownPeriod: 86400, // 24 hours
    minBalance: parseEther('0.5').toString(), // Alert if below 0.5 ETH
  },
}

/**
 * Rate limiting configuration
 */
export const RATE_LIMIT_CONFIG = {
  // Per-address cooldown (seconds)
  addressCooldown: Number(process.env.FAUCET_ADDRESS_COOLDOWN) || 86400, // 24 hours

  // Per-IP hourly limit
  ipHourlyLimit: Number(process.env.FAUCET_IP_HOURLY_LIMIT) || 5,
  ipHourlyWindow: 3600, // 1 hour in seconds

  // Per-IP daily limit
  ipDailyLimit: Number(process.env.FAUCET_IP_DAILY_LIMIT) || 10,
  ipDailyWindow: 86400, // 24 hours in seconds
}

/**
 * Get configuration for a specific network
 */
export function getFaucetNetworkConfig(network: string): FaucetNetworkConfig | undefined {
  return FAUCET_NETWORKS[network]
}

/**
 * Get configuration by chain ID
 */
export function getFaucetConfigByChainId(chainId: number): FaucetNetworkConfig | undefined {
  return Object.values(FAUCET_NETWORKS).find(config => config.chainId === chainId)
}

/**
 * Get all supported faucet networks
 */
export function getSupportedFaucetNetworks(): string[] {
  return Object.keys(FAUCET_NETWORKS).filter(
    network => FAUCET_NETWORKS[network].enabled
  )
}

/**
 * Get all supported chain IDs
 */
export function getSupportedFaucetChainIds(): number[] {
  return Object.values(FAUCET_NETWORKS)
    .filter(config => config.enabled)
    .map(config => config.chainId)
}

/**
 * Check if a network is supported by the faucet
 */
export function isFaucetNetworkSupported(network: string): boolean {
  const config = FAUCET_NETWORKS[network]
  return config !== undefined && config.enabled
}

/**
 * Check if a chain ID is supported by the faucet
 */
export function isFaucetChainIdSupported(chainId: number): boolean {
  const config = getFaucetConfigByChainId(chainId)
  return config !== undefined && config.enabled
}

/**
 * Validate faucet configuration
 * Throws if required environment variables are missing
 */
export function validateFaucetConfig(): { valid: boolean; errors: string[] } {
  const errors: string[] = []

  // Check wallet private key
  if (!process.env.FAUCET_WALLET_PRIVATE_KEY ||
      process.env.FAUCET_WALLET_PRIVATE_KEY === '0xYOUR_PRIVATE_KEY_HERE') {
    errors.push('FAUCET_WALLET_PRIVATE_KEY is not configured')
  }

  // Check database URL
  if (!process.env.POSTGRES_URL ||
      process.env.POSTGRES_URL.includes('password@localhost')) {
    errors.push('POSTGRES_URL is not configured properly')
  }

  // Check RPC URLs
  for (const [network, config] of Object.entries(FAUCET_NETWORKS)) {
    if (config.enabled && !config.rpcUrl) {
      errors.push(`RPC URL for ${network} is not configured`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  }
}

/**
 * Get faucet wallet private key from environment
 * Returns undefined if not configured
 */
export function getFaucetWalletPrivateKey(): string | undefined {
  const key = process.env.FAUCET_WALLET_PRIVATE_KEY
  if (!key || key === '0xYOUR_PRIVATE_KEY_HERE') {
    return undefined
  }
  return key
}

/**
 * Convert network name to chain ID
 */
export function networkToChainId(network: string): number | undefined {
  return FAUCET_NETWORKS[network]?.chainId
}

/**
 * Convert chain ID to network name
 */
export function chainIdToNetwork(chainId: number): string | undefined {
  return Object.values(FAUCET_NETWORKS).find(
    config => config.chainId === chainId
  )?.network
}
