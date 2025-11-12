/**
 * Uniswap V4 Position Manager Utilities
 *
 * Functions for querying and managing liquidity positions
 */

import { Address, PublicClient } from 'viem'
import { Pool } from '@uniswap/v4-sdk'
import { Price, Token as SDKToken } from '@uniswap/sdk-core'
import { priceToClosestTick, tickToPrice as sdkTickToPrice } from '@uniswap/v4-sdk'
import { getPositionManagerAddress, POSITION_MANAGER_ABI } from './contracts'
import { Token, LiquidityPosition, FeeAmount, PoolKey } from '../types'
import { getTokenByAddress } from './tokens'

/**
 * Get all position token IDs owned by an address
 */
export async function getUserPositionTokenIds(
  userAddress: Address,
  chainId: number,
  client: PublicClient
): Promise<bigint[]> {
  const positionManagerAddress = getPositionManagerAddress(chainId)

  // Get the number of positions owned by the user
  const balance = (await client.readContract({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'balanceOf',
    args: [userAddress],
  })) as bigint

  if (balance === BigInt(0)) {
    return []
  }

  // Get all token IDs
  const tokenIds: bigint[] = []
  for (let i = 0; i < Number(balance); i++) {
    const tokenId = (await client.readContract({
      address: positionManagerAddress,
      abi: POSITION_MANAGER_ABI,
      functionName: 'tokenOfOwnerByIndex',
      args: [userAddress, BigInt(i)],
    })) as bigint

    tokenIds.push(tokenId)
  }

  return tokenIds
}

/**
 * Get position info for a specific token ID
 */
export async function getPositionInfo(
  tokenId: bigint,
  chainId: number,
  client: PublicClient
): Promise<{
  poolKey: PoolKey
  tickLower: number
  tickUpper: number
  liquidity: bigint
}> {
  const positionManagerAddress = getPositionManagerAddress(chainId)

  // Get pool and position info
  const [poolKey, info] = (await client.readContract({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPoolAndPositionInfo',
    args: [tokenId],
  })) as [
    {
      currency0: Address
      currency1: Address
      fee: number
      tickSpacing: number
      hooks: Address
    },
    {
      poolId: `0x${string}`
      tickLower: number
      tickUpper: number
      hasSubscriber: boolean
    }
  ]

  // Get liquidity amount
  const liquidity = (await client.readContract({
    address: positionManagerAddress,
    abi: POSITION_MANAGER_ABI,
    functionName: 'getPositionLiquidity',
    args: [tokenId],
  })) as bigint

  return {
    poolKey: {
      currency0: poolKey.currency0,
      currency1: poolKey.currency1,
      fee: poolKey.fee,
      tickSpacing: poolKey.tickSpacing,
      hooks: poolKey.hooks,
    },
    tickLower: info.tickLower,
    tickUpper: info.tickUpper,
    liquidity,
  }
}

/**
 * Convert tick to price
 */
export function tickToPrice(tick: number): number {
  return Math.pow(1.0001, tick)
}

/**
 * Convert price to tick
 */
export function priceToTick(price: number): number {
  return Math.floor(Math.log(price) / Math.log(1.0001))
}

/**
 * Get nearest usable tick for a price
 */
export function getNearestUsableTick(tick: number, tickSpacing: number): number {
  const rounded = Math.round(tick / tickSpacing) * tickSpacing
  // Ensure tick is within bounds
  const MIN_TICK = -887272
  const MAX_TICK = 887272
  return Math.max(MIN_TICK, Math.min(MAX_TICK, rounded))
}

/**
 * Build a complete LiquidityPosition object from position data
 */
export async function buildLiquidityPosition(
  tokenId: bigint,
  chainId: number,
  client: PublicClient
): Promise<LiquidityPosition | null> {
  try {
    const positionInfo = await getPositionInfo(tokenId, chainId, client)

    // Get token information
    const token0 = getTokenByAddress(positionInfo.poolKey.currency0, chainId)
    const token1 = getTokenByAddress(positionInfo.poolKey.currency1, chainId)

    if (!token0 || !token1) {
      console.warn(`Tokens not found for position ${tokenId}`)
      return null
    }

    // Calculate price range
    const minPrice = tickToPrice(positionInfo.tickLower)
    const maxPrice = tickToPrice(positionInfo.tickUpper)

    return {
      tokenId,
      token0,
      token1,
      fee: positionInfo.poolKey.fee as FeeAmount,
      tickLower: positionInfo.tickLower,
      tickUpper: positionInfo.tickUpper,
      liquidity: positionInfo.liquidity,
      minPrice,
      maxPrice,
      poolKey: positionInfo.poolKey,
    }
  } catch (error) {
    console.error(`Error building position for tokenId ${tokenId}:`, error)
    return null
  }
}

/**
 * Get all liquidity positions for a user
 */
export async function getUserPositions(
  userAddress: Address,
  chainId: number,
  client: PublicClient
): Promise<LiquidityPosition[]> {
  const tokenIds = await getUserPositionTokenIds(userAddress, chainId, client)

  const positions = await Promise.all(
    tokenIds.map((tokenId) => buildLiquidityPosition(tokenId, chainId, client))
  )

  // Filter out null positions
  return positions.filter((p): p is LiquidityPosition => p !== null)
}

/**
 * Find positions for a specific pool
 */
export function findPositionsForPool(
  positions: LiquidityPosition[],
  token0: Token,
  token1: Token,
  fee: FeeAmount
): LiquidityPosition[] {
  return positions.filter((position) => {
    const matchesTokens =
      (position.token0.address.toLowerCase() === token0.address.toLowerCase() &&
        position.token1.address.toLowerCase() === token1.address.toLowerCase()) ||
      (position.token0.address.toLowerCase() === token1.address.toLowerCase() &&
        position.token1.address.toLowerCase() === token0.address.toLowerCase())

    return matchesTokens && position.fee === fee
  })
}

/**
 * Check if a position has liquidity
 */
export function hasLiquidity(position: LiquidityPosition): boolean {
  return position.liquidity > BigInt(0)
}

/**
 * Calculate liquidity percentage to remove
 */
export function calculateLiquidityToRemove(
  totalLiquidity: bigint,
  percentage: number
): bigint {
  if (percentage <= 0 || percentage > 100) {
    throw new Error('Percentage must be between 0 and 100')
  }

  return (totalLiquidity * BigInt(Math.floor(percentage * 100))) / BigInt(10000)
}

/**
 * SDK-based price to tick conversion (more accurate than simple math)
 */
export function priceToTickSDK(
  token0: SDKToken,
  token1: SDKToken,
  priceValue: number
): number {
  // Create Price instance from token amounts
  const price = new Price(
    token0,
    token1,
    10 ** token0.decimals, // base amount
    Math.floor(priceValue * 10 ** token1.decimals) // quote amount
  )
  return priceToClosestTick(price)
}

/**
 * SDK-based tick to price conversion
 */
export function tickToPriceSDK(
  token0: SDKToken,
  token1: SDKToken,
  tick: number
): Price<SDKToken, SDKToken> {
  return sdkTickToPrice(token0, token1, tick) as Price<SDKToken, SDKToken>
}

/**
 * Calculate ticks from price range for a pool
 */
export function calculateTicksFromPriceRange(
  pool: Pool,
  minPrice: number | undefined,
  maxPrice: number | undefined
): { tickLower: number; tickUpper: number } {
  const MIN_TICK = -887272
  const MAX_TICK = 887272

  const tickSpacing = pool.tickSpacing

  // Full range if no prices specified
  if (minPrice === undefined && maxPrice === undefined) {
    return getFullRangeTicks(tickSpacing)
  }

  const token0 = pool.token0
  const token1 = pool.token1

  // Calculate ticks from prices
  const tickLower =
    minPrice !== undefined
      ? getNearestUsableTick(priceToTickSDK(token0 as SDKToken, token1 as SDKToken, minPrice), tickSpacing)
      : MIN_TICK

  const tickUpper =
    maxPrice !== undefined
      ? getNearestUsableTick(priceToTickSDK(token0 as SDKToken, token1 as SDKToken, maxPrice), tickSpacing)
      : MAX_TICK

  // Validate range
  if (tickLower >= tickUpper) {
    throw new Error('Invalid price range: min price must be less than max price')
  }

  return { tickLower, tickUpper }
}

/**
 * Get full range ticks (for providing liquidity across entire price range)
 * Aligned to tick spacing
 */
export function getFullRangeTicks(tickSpacing?: number): { tickLower: number; tickUpper: number } {
  const MIN_TICK = -887272
  const MAX_TICK = 887272

  if (tickSpacing) {
    // Align to tick spacing
    return {
      tickLower: getNearestUsableTick(MIN_TICK, tickSpacing),
      tickUpper: getNearestUsableTick(MAX_TICK, tickSpacing),
    }
  }

  return {
    tickLower: MIN_TICK,
    tickUpper: MAX_TICK,
  }
}

/**
 * Validate price range
 */
export function validatePriceRange(
  minPrice: number | undefined,
  maxPrice: number | undefined,
  currentPrice?: number
): boolean {
  if (minPrice !== undefined && maxPrice !== undefined) {
    if (minPrice >= maxPrice) {
      return false
    }
  }

  if (minPrice !== undefined && minPrice <= 0) {
    return false
  }

  if (maxPrice !== undefined && maxPrice <= 0) {
    return false
  }

  return true
}

/**
 * Format price for display
 */
export function formatPrice(price: Price<SDKToken, SDKToken>): string {
  return price.toSignificant(6)
}
