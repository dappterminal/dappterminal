/**
 * Uniswap V4 Add Liquidity Transaction Preparation
 *
 * Functions for preparing add liquidity transactions using V4 SDK
 */

import { Address, PublicClient, Hex } from 'viem'
import { Position } from '@uniswap/v4-sdk'
import { CurrencyAmount, Percent } from '@uniswap/sdk-core'
import { V4PositionManager } from '@uniswap/v4-sdk'
import type { AddLiquidityParams, Permit2Signature } from '../types'
import { fetchAndCreatePool, toSDKToken } from './poolState'
import { calculateTicksFromPriceRange } from './positionManager'
import { getPositionManagerAddress } from './contracts'
import { ZERO_ADDRESS } from './poolUtils'
import { getTickSpacing } from './poolUtils'

/**
 * Prepared transaction data for adding liquidity
 */
export interface PreparedAddLiquidity {
  to: Address
  data: Hex
  value: bigint
  estimatedGas?: bigint
}

/**
 * Prepare add liquidity transaction
 */
export async function prepareAddLiquidity(
  params: AddLiquidityParams,
  client: PublicClient,
  permit2Signature?: Permit2Signature
): Promise<PreparedAddLiquidity> {
  const {
    token0,
    token1,
    amount0,
    amount1,
    minPrice,
    maxPrice,
    fee,
    recipient,
    deadline,
    slippageBps,
    usePermit2,
    chainId,
  } = params

  // Get tick spacing for the fee tier
  const tickSpacing = getTickSpacing(fee)

  // Fetch pool state and create Pool instance
  const pool = await fetchAndCreatePool(
    token0,
    token1,
    fee,
    tickSpacing,
    ZERO_ADDRESS, // No hooks for now
    chainId,
    client
  )

  // Convert to SDK tokens
  const token0SDK = toSDKToken(token0)
  const token1SDK = toSDKToken(token1)

  // Calculate tick range from price range
  // Note: For full range positions, we need to ensure the ticks are valid
  const { tickLower, tickUpper } = calculateTicksFromPriceRange(pool, minPrice, maxPrice)

  // Validate ticks are within bounds
  const MIN_TICK = -887272
  const MAX_TICK = 887272

  if (tickLower < MIN_TICK || tickLower > MAX_TICK) {
    throw new Error(`tickLower ${tickLower} is out of bounds`)
  }
  if (tickUpper < MIN_TICK || tickUpper > MAX_TICK) {
    throw new Error(`tickUpper ${tickUpper} is out of bounds`)
  }
  if (tickLower >= tickUpper) {
    throw new Error(`tickLower must be less than tickUpper`)
  }

  // Create Position using fromAmounts (automatically calculates optimal liquidity)
  // Note: Using JSBI for the SDK (it expects JSBI instead of bigint in some versions)
  const position = Position.fromAmounts({
    pool,
    tickLower,
    tickUpper,
    amount0: amount0.toString(),
    amount1: amount1.toString(),
    useFullPrecision: true,
  })

  // Create slippage tolerance
  const slippageTolerance = new Percent(slippageBps, 10_000)

  // Build mint options
  const mintOptions: any = {
    recipient,
    slippageTolerance,
    deadline: deadline.toString(),
    createPool: false, // Assume pool already exists
  }

  // Add Permit2 signature if using Permit2
  if (usePermit2 && permit2Signature) {
    mintOptions.permit2Permit = {
      details: permit2Signature.permitBatch.details,
      spender: permit2Signature.permitBatch.spender,
      sigDeadline: permit2Signature.permitBatch.sigDeadline,
    }
    mintOptions.permit2Signature = permit2Signature.signature
  }

  // Generate calldata using V4PositionManager
  const { calldata, value } = V4PositionManager.addCallParameters(position, mintOptions)

  // Get Position Manager address
  const positionManagerAddress = getPositionManagerAddress(chainId)

  return {
    to: positionManagerAddress,
    data: calldata as Hex,
    value: BigInt(value),
  }
}

/**
 * Estimate gas for add liquidity transaction
 */
export async function estimateAddLiquidityGas(
  params: AddLiquidityParams,
  client: PublicClient,
  from: Address
): Promise<bigint> {
  try {
    const prepared = await prepareAddLiquidity(params, client)

    const gas = await client.estimateGas({
      account: from,
      to: prepared.to,
      data: prepared.data,
      value: prepared.value,
    })

    return gas
  } catch (error) {
    // Return a reasonable default if estimation fails
    return 500_000n
  }
}
