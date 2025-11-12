/**
 * Uniswap V4 Remove Liquidity Transaction Preparation
 *
 * Functions for preparing remove liquidity transactions using V4 SDK
 */

import { Address, PublicClient, Hex } from 'viem'
import { Position } from '@uniswap/v4-sdk'
import { Percent } from '@uniswap/sdk-core'
import { V4PositionManager } from '@uniswap/v4-sdk'
import type { RemoveLiquidityParams, Token, FeeAmount } from '../types'
import { fetchAndCreatePool, toSDKToken } from './poolState'
import { getUserPositions, findPositionsForPool, calculateLiquidityToRemove } from './positionManager'
import { getPositionManagerAddress } from './contracts'
import { ZERO_ADDRESS } from './poolUtils'
import { getTickSpacing } from './poolUtils'

/**
 * Prepared transaction data for removing liquidity
 */
export interface PreparedRemoveLiquidity {
  to: Address
  data: Hex
  value: bigint
  position: any // Position instance from SDK
  estimatedGas?: bigint
}

/**
 * Find user's position for a specific pool
 */
async function findUserPositionForPool(
  userAddress: Address,
  token0: Token,
  token1: Token,
  fee: FeeAmount,
  chainId: number,
  client: PublicClient
): Promise<any | null> {
  // Get all user positions
  const positions = await getUserPositions(userAddress, chainId, client)

  // Find matching positions
  const matchingPositions = findPositionsForPool(positions, token0, token1, fee)

  if (matchingPositions.length === 0) {
    throw new Error(
      `No position found for pool ${token0.symbol}/${token1.symbol} with ${fee / 10000}% fee`
    )
  }

  // Return the first matching position (could extend to allow user to choose)
  return matchingPositions[0]
}

/**
 * Prepare remove liquidity transaction
 */
export async function prepareRemoveLiquidity(
  params: RemoveLiquidityParams,
  userAddress: Address,
  client: PublicClient
): Promise<PreparedRemoveLiquidity> {
  const {
    position: positionData,
    liquidityPercentage,
    minAmount0,
    minAmount1,
    recipient,
    deadline,
    burnToken,
    chainId,
  } = params

  // Get position token ID
  const tokenId = positionData.tokenId

  // Get tick spacing for the fee tier
  const tickSpacing = getTickSpacing(positionData.fee)

  // Fetch current pool state
  const pool = await fetchAndCreatePool(
    positionData.token0,
    positionData.token1,
    positionData.fee,
    tickSpacing,
    ZERO_ADDRESS, // No hooks
    chainId,
    client
  )

  // Create Position instance from existing position data
  const position = new Position({
    pool,
    tickLower: positionData.tickLower,
    tickUpper: positionData.tickUpper,
    liquidity: positionData.liquidity.toString(),
  })

  // Calculate liquidity percentage
  const liquidityPercent = new Percent(Math.floor(liquidityPercentage * 100), 10_000)

  // Build remove options
  const removeOptions: any = {
    tokenId: tokenId.toString(),
    liquidityPercentage: liquidityPercent,
    slippageTolerance: new Percent(50, 10_000), // 0.5% slippage
    deadline: deadline.toString(),
    burnToken: burnToken || liquidityPercentage === 100,
    collectOptions: {
      expectedCurrencyOwed0: minAmount0 || BigInt(0),
      expectedCurrencyOwed1: minAmount1 || BigInt(0),
      recipient,
    },
  }

  // Generate calldata using V4PositionManager
  const { calldata, value } = V4PositionManager.removeCallParameters(position, removeOptions)

  // Get Position Manager address
  const positionManagerAddress = getPositionManagerAddress(chainId)

  return {
    to: positionManagerAddress,
    data: calldata as Hex,
    value: BigInt(value),
    position,
  }
}

/**
 * Prepare remove liquidity by finding position first
 */
export async function prepareRemoveLiquidityByPool(
  token0: Token,
  token1: Token,
  fee: FeeAmount,
  percentage: number,
  burnToken: boolean,
  userAddress: Address,
  recipient: Address,
  deadline: bigint,
  chainId: number,
  client: PublicClient
): Promise<PreparedRemoveLiquidity> {
  // Find user's position for this pool
  const position = await findUserPositionForPool(userAddress, token0, token1, fee, chainId, client)

  if (!position) {
    throw new Error(`No position found for pool ${token0.symbol}/${token1.symbol}`)
  }

  // Prepare remove params
  const removeParams: RemoveLiquidityParams = {
    tokenId: position.tokenId,
    position,
    liquidityPercentage: percentage,
    recipient,
    deadline,
    burnToken,
    chainId,
  }

  // Prepare transaction
  return prepareRemoveLiquidity(removeParams, userAddress, client)
}

/**
 * Estimate gas for remove liquidity transaction
 */
export async function estimateRemoveLiquidityGas(
  params: RemoveLiquidityParams,
  userAddress: Address,
  client: PublicClient
): Promise<bigint> {
  try {
    const prepared = await prepareRemoveLiquidity(params, userAddress, client)

    const gas = await client.estimateGas({
      account: userAddress,
      to: prepared.to,
      data: prepared.data,
      value: prepared.value,
    })

    return gas
  } catch (error) {
    // Return a reasonable default if estimation fails
    return BigInt(400000)
  }
}
