/**
 * Faucet Plugin Types
 */

export interface FaucetRequestArgs {
  network: string
  address?: string
}

export interface FaucetStatusArgs {
  requestId?: string
  txHash?: string
}

export interface FaucetHistoryArgs {
  address?: string
  network?: string
  limit?: number
}

export interface FaucetRequestResult {
  requestId: string
  txHash?: string
  status: string
  network: string
  address: string
  message: string
}

export interface FaucetStatusResult {
  requestId: string
  address: string
  network: string
  chainId: number
  amount: string
  txHash?: string
  txUrl?: string
  status: string
  errorMessage?: string
  createdAt: string
  processedAt?: string
  completedAt?: string
}

export interface FaucetHistoryResult {
  requests: Array<{
    requestId: string
    address: string
    network: string
    chainId: number
    amount: string
    txHash?: string
    txUrl?: string
    status: string
    errorMessage?: string
    createdAt: string
    processedAt?: string
    completedAt?: string
  }>
  pagination: {
    total: number
    limit: number
    offset: number
    hasMore: boolean
  }
}
