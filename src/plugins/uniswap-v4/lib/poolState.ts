/**
 * Uniswap V4 Pool State Management
 *
 * Functions for fetching pool state and creating Pool instances
 */

import { Address, PublicClient, keccak256, encodePacked } from 'viem'
import { Pool } from '@uniswap/v4-sdk'
import { Token } from '@uniswap/sdk-core'
import { getStateViewAddress, STATE_VIEW_ABI } from './contracts'
import { getPoolTokenAddress, sortTokens } from './poolUtils'
import type { Token as LocalToken, PoolKey } from '../types'

/**
 * Pool state returned from StateView contract
 */
export interface PoolState {
  sqrtPriceX96: bigint
  tick: number
  liquidity: bigint
  protocolFee: number
  lpFee: number
}

/**
 * Calculate pool ID from pool key components
 */
export function calculatePoolId(
  currency0: Address,
  currency1: Address,
  fee: number,
  tickSpacing: number,
  hooks: Address
): `0x${string}` {
  const encoded = encodePacked(
    ['address', 'address', 'uint24', 'int24', 'address'],
    [currency0, currency1, fee, tickSpacing, hooks]
  )
  return keccak256(encoded)
}

/**
 * Create pool ID from PoolKey
 */
export function poolKeyToId(poolKey: PoolKey): `0x${string}` {
  return calculatePoolId(
    poolKey.currency0,
    poolKey.currency1,
    poolKey.fee,
    poolKey.tickSpacing,
    poolKey.hooks
  )
}

/**
 * Fetch pool state from StateView contract
 */
export async function fetchPoolState(
  poolId: `0x${string}`,
  chainId: number,
  client: PublicClient
): Promise<PoolState> {
  const stateViewAddress = getStateViewAddress(chainId)

  try {
    // Fetch slot0 (price, tick, fees)
    const slot0 = (await client.readContract({
      address: stateViewAddress,
      abi: STATE_VIEW_ABI,
      functionName: 'getSlot0',
      args: [poolId],
    })) as readonly [bigint, number, number, number]

    // Fetch liquidity
    const liquidity = (await client.readContract({
      address: stateViewAddress,
      abi: STATE_VIEW_ABI,
      functionName: 'getLiquidity',
      args: [poolId],
    })) as bigint

    const poolState = {
      sqrtPriceX96: slot0[0],
      tick: slot0[1],
      protocolFee: slot0[2],
      lpFee: slot0[3],
      liquidity,
    }

    // Log for debugging
    console.log('[Pool State]', {
      poolId,
      sqrtPriceX96: poolState.sqrtPriceX96.toString(),
      tick: poolState.tick,
      liquidity: poolState.liquidity.toString(),
    })

    // Validate pool state
    if (poolState.sqrtPriceX96 === BigInt(0)) {
      throw new Error(
        'Pool does not exist or is not initialized (sqrtPriceX96 = 0). ' +
          'Try a different fee tier: --fee 500 (0.05%), --fee 3000 (0.3%), --fee 10000 (1%)'
      )
    }

    return poolState
  } catch (error) {
    console.error('[fetchPoolState] Error:', error)
    throw new Error(
      `Failed to fetch pool state: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Create a Pool instance from tokens and pool state
 */
export function createPoolInstance(
  token0: Token,
  token1: Token,
  fee: number,
  tickSpacing: number,
  hooks: Address,
  poolState: PoolState
): Pool {
  console.log('[createPoolInstance] About to create Pool with:', {
    token0: token0.symbol,
    token1: token1.symbol,
    fee,
    tickSpacing,
    hooks,
    sqrtPriceX96: poolState.sqrtPriceX96.toString(),
    liquidity: poolState.liquidity.toString(),
    tick: poolState.tick,
  })

  // Validate sqrtPriceX96 is within bounds before passing to Pool
  const MIN_SQRT_RATIO = BigInt('4295128739')
  const MAX_SQRT_RATIO = BigInt('1461446703485210103287273052203988822378723970342')

  if (poolState.sqrtPriceX96 < MIN_SQRT_RATIO || poolState.sqrtPriceX96 > MAX_SQRT_RATIO) {
    throw new Error(
      `sqrtPriceX96 ${poolState.sqrtPriceX96.toString()} is out of bounds. ` +
      `Must be between ${MIN_SQRT_RATIO.toString()} and ${MAX_SQRT_RATIO.toString()}`
    )
  }

  // Validate tick is within bounds
  const MIN_TICK = -887272
  const MAX_TICK = 887272

  if (poolState.tick < MIN_TICK || poolState.tick > MAX_TICK) {
    throw new Error(
      `tick ${poolState.tick} is out of bounds. Must be between ${MIN_TICK} and ${MAX_TICK}`
    )
  }

  try {
    return new Pool(
      token0,
      token1,
      fee,
      tickSpacing,
      hooks,
      poolState.sqrtPriceX96.toString(),
      poolState.liquidity.toString(),
      poolState.tick
    )
  } catch (error) {
    console.error('[createPoolInstance] Pool constructor failed:', error)
    throw error
  }
}

/**
 * Convert local Token type to SDK Token type
 */
export function toSDKToken(token: LocalToken): Token {
  return new Token(
    token.chainId,
    token.address,
    token.decimals,
    token.symbol,
    token.name
  )
}

/**
 * Fetch pool and create Pool instance in one step
 */
export async function fetchAndCreatePool(
  token0Local: LocalToken,
  token1Local: LocalToken,
  fee: number,
  tickSpacing: number,
  hooks: Address,
  chainId: number,
  client: PublicClient
): Promise<Pool> {
  // Convert to SDK tokens
  const token0SDK = toSDKToken(token0Local)
  const token1SDK = toSDKToken(token1Local)

  // Get pool token addresses (handles ETH -> WETH conversion)
  const token0Address = getPoolTokenAddress(token0Local)
  const token1Address = getPoolTokenAddress(token1Local)

  console.log('[fetchAndCreatePool] Input tokens:', {
    token0: token0Local.symbol,
    token1: token1Local.symbol,
    token0Address,
    token1Address,
    fee,
    tickSpacing,
    chainId,
  })

  // Sort tokens for pool ID calculation
  const [currency0, currency1] = sortTokens(token0Address, token1Address)

  // Calculate pool ID
  const poolId = calculatePoolId(currency0, currency1, fee, tickSpacing, hooks)

  console.log('[fetchAndCreatePool] Pool ID:', poolId)

  // Fetch pool state
  const poolState = await fetchPoolState(poolId, chainId, client)

  // Create and return Pool instance
  // Note: SDK Pool expects tokens in sorted order
  const [sortedToken0, sortedToken1] =
    token0Address.toLowerCase() < token1Address.toLowerCase()
      ? [token0SDK, token1SDK]
      : [token1SDK, token0SDK]

  console.log('[fetchAndCreatePool] Creating Pool with:', {
    token0: sortedToken0.symbol,
    token1: sortedToken1.symbol,
    sqrtPriceX96: poolState.sqrtPriceX96.toString(),
    liquidity: poolState.liquidity.toString(),
    tick: poolState.tick,
  })

  return createPoolInstance(
    sortedToken0,
    sortedToken1,
    fee,
    tickSpacing,
    hooks,
    poolState
  )
}

/**
 * Check if a pool exists by attempting to fetch its state
 */
export async function poolExists(
  poolId: `0x${string}`,
  chainId: number,
  client: PublicClient
): Promise<boolean> {
  try {
    await fetchPoolState(poolId, chainId, client)
    return true
  } catch (error) {
    return false
  }
}
