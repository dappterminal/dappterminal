/**
 * Pool Discovery Utilities for Uniswap V4
 *
 * Functions to discover which pools actually exist on V4
 */

import { PublicClient } from 'viem'
import { poolExists, poolKeyToId } from './poolState'
import { createPoolKey, getAllFeeTiers } from './poolUtils'
import type { Token, PoolKey } from '../types'

export interface DiscoveredPool {
  poolKey: PoolKey
  poolId: `0x${string}`
  exists: boolean
  token0Symbol: string
  token1Symbol: string
  fee: number
}

/**
 * Try to find which fee tier has an existing pool for a token pair
 */
export async function findExistingPoolForPair(
  token0: Token,
  token1: Token,
  chainId: number,
  client: PublicClient
): Promise<DiscoveredPool | null> {
  const feeTiers = getAllFeeTiers()

  console.log(`[Pool Discovery] Checking ${token0.symbol}/${token1.symbol} on all fee tiers...`)

  for (const fee of feeTiers) {
    try {
      const poolKey = createPoolKey(token0, token1, fee)
      const poolId = poolKeyToId(poolKey)

      console.log(`  Trying fee ${fee} (${fee / 10000}%)...`)

      const exists = await poolExists(poolId, chainId, client)

      if (exists) {
        console.log(`  ✓ Found pool at fee tier ${fee}!`)
        return {
          poolKey,
          poolId,
          exists: true,
          token0Symbol: token0.symbol,
          token1Symbol: token1.symbol,
          fee,
        }
      } else {
        console.log(`  ✗ No pool at fee tier ${fee}`)
      }
    } catch (error) {
      console.log(`  ✗ Error checking fee tier ${fee}:`, error)
    }
  }

  console.log(`[Pool Discovery] No pools found for ${token0.symbol}/${token1.symbol}`)
  return null
}

/**
 * Discover all existing pools for a list of token pairs
 */
export async function discoverPoolsForPairs(
  pairs: Array<[Token, Token]>,
  chainId: number,
  client: PublicClient
): Promise<DiscoveredPool[]> {
  const discoveredPools: DiscoveredPool[] = []

  for (const [token0, token1] of pairs) {
    const pool = await findExistingPoolForPair(token0, token1, chainId, client)
    if (pool) {
      discoveredPools.push(pool)
    }
  }

  return discoveredPools
}
