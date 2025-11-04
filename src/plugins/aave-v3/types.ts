/**
 * Type definitions for Aave V3 plugin
 */

/**
 * Supply request data returned by the supply command
 * and handled by the supply handler
 */
export interface AaveV3SupplyRequestData {
  aaveV3SupplyRequest: true
  params: {
    marketAddress: string
    underlyingTokenAddress: string
    asset: string // Symbol like "USDC", "ETH", etc.
    amount: string // String representation of the amount (e.g., "100")
    amountFormatted: string // Formatted for display (e.g., "100.0")
    decimals: number
    useAsCollateral: boolean
    isNative: boolean // True if supplying native ETH (auto-wrapped)
    chainId: number
  }
  displayData: {
    asset: string
    amount: string
    collateral: string
  }
}

/**
 * Withdraw request data returned by the withdraw command
 * and handled by the withdraw handler
 */
export interface AaveV3WithdrawRequestData {
  aaveV3WithdrawRequest: true
  params: {
    marketAddress: string
    underlyingTokenAddress: string
    asset: string // Symbol like "USDC", "ETH", etc.
    amount: string // String representation of the amount (e.g., "100") or "max"
    amountFormatted: string // Formatted for display (e.g., "100.0" or "max")
    decimals: number
    isNative: boolean // True if withdrawing as native ETH
    isMax: boolean // True if withdrawing all (max)
    chainId: number
  }
  displayData: {
    asset: string
    amount: string
  }
}

/**
 * Reserve data structure from Aave GraphQL API
 */
export interface AaveReserve {
  symbol: string
  name: string
  underlyingTokenAddress: string
  decimals: number
  isFrozen: boolean
  isPaused: boolean
  permitSupported: boolean
  acceptsNative: boolean
  suppliable: string // User's suppliable amount
  marketAddress: string
  chainId: number
}
