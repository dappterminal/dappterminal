/**
 * Uniswap V4 Plugin Types
 *
 * Type definitions for Uniswap V4 swap operations
 */

import { Address } from 'viem'

export interface Token {
  address: Address
  decimals: number
  symbol: string
  name: string
  logoURI?: string
  chainId: number
}

export interface PoolKey {
  currency0: Address
  currency1: Address
  fee: number
  tickSpacing: number
  hooks: Address
}

export interface QuoteParams {
  tokenIn: Token
  tokenOut: Token
  amountIn: bigint
  slippageBps?: number
  chainId: number
}

export interface QuoteResult {
  amountOut: bigint
  amountOutFormatted: string
  priceImpact: number
  minAmountOut: bigint
  minAmountOutFormatted: string
  route: Token[]
  executionPrice: string
  gasEstimate?: bigint
}

export interface SingleHopSwapParams {
  tokenIn: Token
  tokenOut: Token
  amountIn: bigint
  minAmountOut: bigint
  recipient: Address
  deadline: bigint
  chainId: number
}

export interface MultiHopSwapParams {
  route: Token[]
  amountIn: bigint
  minAmountOut: bigint
  recipient: Address
  deadline: bigint
  chainId: number
}

export interface SwapConfig {
  poolKey: PoolKey
  zeroForOne: boolean
  amountIn: bigint
  minAmountOut: bigint
  hookData: `0x${string}`
}

export interface PathKey {
  intermediateCurrency: Address
  fee: number
  tickSpacing: number
  hooks: Address
  hookData: `0x${string}`
}

export interface UniswapContracts {
  poolManager: Address
  positionManager: Address
  quoter: Address
  stateView: Address
  universalRouter: Address
  permit2: Address
}

export interface TokenBalance {
  token: Token
  balance: bigint
  formatted: string
}

export enum SwapType {
  SINGLE_HOP = 'single-hop',
  MULTI_HOP = 'multi-hop',
}

export interface SlippageSettings {
  percentage: number
  auto: boolean
}

export type FeeAmount = 100 | 500 | 3000 | 10000

export const FEE_AMOUNTS: Record<string, FeeAmount> = {
  LOWEST: 100, // 0.01%
  LOW: 500, // 0.05%
  MEDIUM: 3000, // 0.3%
  HIGH: 10000, // 1%
}

export const TICK_SPACINGS: Record<FeeAmount, number> = {
  100: 1,
  500: 10,
  3000: 60,
  10000: 200,
}

/**
 * Plugin-specific types
 */
export interface UniswapV4SwapRequestData {
  uniswapV4SwapRequest: boolean
  params: SingleHopSwapParams
  tokenInSymbol: string
  tokenOutSymbol: string
  amountInFormatted: string
  minAmountOutFormatted: string
  slippageBps: number
  deadlineSeconds: number
  message: string
}

export interface UniswapV4MultiHopSwapRequestData {
  uniswapV4MultiHopSwapRequest: boolean
  params: MultiHopSwapParams
  route: Token[]
  tokenInSymbol: string
  tokenOutSymbol: string
  amountInFormatted: string
  minAmountOutFormatted: string
  slippageBps: number
  deadlineSeconds: number
  message: string
}

export interface UniswapV4PluginState extends Record<string, unknown> {
  lastSwap?: {
    params: SingleHopSwapParams | MultiHopSwapParams
    txHash?: string
    timestamp: number
  }
  positions?: Map<string, LiquidityPosition>
}

/**
 * Liquidity Position Types
 */
export interface LiquidityPosition {
  tokenId: bigint
  token0: Token
  token1: Token
  fee: FeeAmount
  tickLower: number
  tickUpper: number
  liquidity: bigint
  minPrice: number
  maxPrice: number
  feesEarned0?: bigint
  feesEarned1?: bigint
  poolKey: PoolKey
}

export interface PriceRange {
  minPrice: number
  maxPrice: number
  minTick: number
  maxTick: number
}

export interface AddLiquidityParams {
  token0: Token
  token1: Token
  amount0: bigint
  amount1: bigint
  minPrice?: number
  maxPrice?: number
  fee: FeeAmount
  recipient: Address
  deadline: bigint
  slippageBps: number
  usePermit2: boolean
  chainId: number
}

export interface RemoveLiquidityParams {
  tokenId: bigint
  position: LiquidityPosition
  liquidityPercentage: number // 0-100
  minAmount0?: bigint
  minAmount1?: bigint
  recipient: Address
  deadline: bigint
  burnToken: boolean
  chainId: number
}

export interface Permit2BatchData {
  details: {
    token: Address
    amount: string
    expiration: string
    nonce: string
  }[]
  spender: Address
  sigDeadline: string
}

export interface Permit2Signature {
  owner: Address
  permitBatch: Permit2BatchData
  signature: `0x${string}`
}

/**
 * Plugin request data types for liquidity operations
 */
export interface UniswapV4AddLiquidityRequestData {
  uniswapV4AddLiquidityRequest: boolean
  params: AddLiquidityParams
  token0Symbol: string
  token1Symbol: string
  amount0Formatted: string
  amount1Formatted: string
  priceRange?: PriceRange
  estimatedGas?: bigint
  message: string
}

export interface UniswapV4RemoveLiquidityRequestData {
  uniswapV4RemoveLiquidityRequest: boolean
  params: RemoveLiquidityParams
  token0Symbol: string
  token1Symbol: string
  liquidityPercentage: number
  estimatedAmount0?: string
  estimatedAmount1?: string
  message: string
}

export interface UniswapV4DiscoverRequestData {
  uniswapV4DiscoverRequest: boolean
  token0?: Token
  token1?: Token
  pairs?: Array<[Token, Token]>
  chainId: number
  message: string
}
