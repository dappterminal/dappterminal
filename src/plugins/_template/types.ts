/**
 * Template Protocol Types
 *
 * Define protocol-specific types here
 */

/**
 * Swap arguments
 */
export interface SwapArgs {
  fromToken: string
  toToken: string
  amount: number
  slippage?: number
  deadline?: number
}

/**
 * Swap result
 */
export interface SwapResult {
  txHash: string
  fromToken: string
  toToken: string
  amount: number
  received: number
  fee: number
}

/**
 * Liquidity arguments
 */
export interface LiquidityArgs {
  action: 'add' | 'remove'
  token0: string
  token1: string
  amount0?: number
  amount1?: number
  lpTokens?: number
}

/**
 * Liquidity result
 */
export interface LiquidityResult {
  txHash: string
  action: 'add' | 'remove'
  lpTokens: number
  token0Amount?: number
  token1Amount?: number
}
