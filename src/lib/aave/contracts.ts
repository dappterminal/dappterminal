/**
 * Aave v3 Pool contract addresses and ABIs
 */

import type { Address } from 'viem'

/**
 * Aave V3 Pool contract addresses by chain ID
 */
export const POOL_ADDRESSES: Record<number, Address> = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',      // Ethereum
  10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',     // Optimism
  8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',   // Base
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',  // Arbitrum
  137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',    // Polygon
}

/**
 * Aave V3 WETH Gateway contract addresses by chain ID
 * Used for depositing/withdrawing native ETH
 */
export const WETH_GATEWAY_ADDRESSES: Record<number, Address> = {
  1: '0x893411580e590D62dDBca8a703d61Cc4A8c7b2b9',      // Ethereum
  10: '0x76D3030728e52DEB8848d5613aBaDE88441cbc59',     // Optimism
  8453: '0x8be473dCfA93132658821E67CbEB684ec8Ea2E74',   // Base
  42161: '0xB5Ee21786D28c5Ba61661550879475976B707099',  // Arbitrum
  137: '0xC1E320966c485ebF2A0A2A6d3c0Dc860A156eB1B',    // Polygon
}

/**
 * Aave V3 Pool ABI - Only includes functions needed for supply operations
 * These are from the IPool interface
 */
export const POOL_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'onBehalfOf', type: 'address' },
      { internalType: 'uint16', name: 'referralCode', type: 'uint16' }
    ],
    name: 'supply',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'bool', name: 'useAsCollateral', type: 'bool' }
    ],
    name: 'setUserUseReserveAsCollateral',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'asset', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' }
    ],
    name: 'withdraw',
    outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
    stateMutability: 'nonpayable',
    type: 'function'
  },
] as const

/**
 * Aave V3 WETH Gateway ABI - For native ETH deposits
 */
export const WETH_GATEWAY_ABI = [
  {
    inputs: [
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'address', name: 'onBehalfOf', type: 'address' },
      { internalType: 'uint16', name: 'referralCode', type: 'uint16' }
    ],
    name: 'depositETH',
    outputs: [],
    stateMutability: 'payable',
    type: 'function'
  },
  {
    inputs: [
      { internalType: 'address', name: 'pool', type: 'address' },
      { internalType: 'uint256', name: 'amount', type: 'uint256' },
      { internalType: 'address', name: 'to', type: 'address' }
    ],
    name: 'withdrawETH',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function'
  },
] as const

/**
 * Standard ERC-20 ABI for approval operations
 */
export const ERC20_ABI = [
  {
    name: 'allowance',
    type: 'function',
    stateMutability: 'view',
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' }
    ],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'approve',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' }
    ],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'balanceOf',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: '', type: 'uint256' }]
  },
  {
    name: 'decimals',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ name: '', type: 'uint8' }]
  },
] as const

/**
 * Get the Pool contract address for a given chain ID
 */
export function getPoolAddress(chainId: number): Address | undefined {
  return POOL_ADDRESSES[chainId]
}

/**
 * Get the WETH Gateway contract address for a given chain ID
 */
export function getWETHGatewayAddress(chainId: number): Address | undefined {
  return WETH_GATEWAY_ADDRESSES[chainId]
}

/**
 * Check if a chain ID is supported by Aave V3
 */
export function isSupportedChain(chainId: number): boolean {
  return chainId in POOL_ADDRESSES
}

