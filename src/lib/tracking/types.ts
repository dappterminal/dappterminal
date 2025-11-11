/**
 * Types for swap and bridge transaction tracking
 */

export type TransactionType = 'swap' | 'bridge'

export type TransactionStatus = 'pending' | 'confirmed' | 'failed'

export interface SwapTransactionData {
  // Transaction details
  txHash: string
  chainId: number
  blockNumber?: bigint

  // Protocol information
  protocol: string
  command: string
  txType: TransactionType

  // User information
  walletAddress: string

  // Token swap/bridge details
  tokenIn: string
  tokenOut: string
  amountIn: string
  amountOut: string

  // Gas metrics (optional, can be added later)
  gasUsed?: string
  gasPrice?: string

  // Route information (for multi-hop swaps)
  route?: any // JSON data structure
}

export interface ProtocolVolumeUpdate {
  date: Date
  protocol: string
  chainId: number
  walletAddress: string
  amountIn: string
  amountOut: string
  success: boolean
}

export interface UserActivityUpdate {
  walletAddress: string
  protocol: string
  chainId: number
  amountIn: string
  txType: TransactionType
}
