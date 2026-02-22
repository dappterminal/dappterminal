/**
 * Uniswap V4 Single-Hop Swap Logic
 *
 * Prepares swap transactions using @uniswap/v4-sdk V4Planner
 */

import { SingleHopSwapParams, Token } from '../types'
import { Address, encodeFunctionData, isAddress, Hex } from 'viem'
import { createPoolKey, getZeroForOne, getPoolTokenAddress } from './poolUtils'
import { getUniversalRouterAddress, UNIVERSAL_ROUTER_ABI } from './contracts'
import { isNativeToken } from './tokens'
import { V4Planner, Actions } from '@uniswap/v4-sdk'
import { debugLog } from '@/lib/debug'

const V4_SWAP_COMMAND = 0x10

/**
 * Get V4 currency address
 * Native ETH is represented as address(0) in V4, not WETH
 */
function getV4Currency(token: Token): Address {
  if (isNativeToken(token.address)) {
    return '0x0000000000000000000000000000000000000000'
  }
  return getPoolTokenAddress(token)
}

/**
 * Get pool key currency with proper native ETH handling
 * If the token is native ETH and matches the pool address, use address(0)
 */
function getPoolKeyCurrency(token: Token, poolAddress: Address): Address {
  if (isNativeToken(token.address) && poolAddress === getPoolTokenAddress(token)) {
    return '0x0000000000000000000000000000000000000000'
  }
  return poolAddress
}

/**
 * Encode V4 swap actions using the V4Planner SDK
 *
 * V4 Swap Action Sequence:
 * 1. SWAP_EXACT_IN_SINGLE - Execute the swap in the pool (creates a debt/credit delta)
 * 2. SETTLE - Pay the input tokens from user to PoolManager (settles the debt)
 * 3. TAKE - Withdraw output tokens from PoolManager to recipient (claims the credit)
 */
function encodeV4SwapActions(
  params: SingleHopSwapParams
): { commands: Hex; inputs: Hex[] } {
  const { tokenIn, tokenOut, amountIn, minAmountOut, recipient } = params

  debugLog('=== V4 Swap Config ===')
  debugLog('Token In:', tokenIn.symbol, tokenIn.address, '(isNative:', isNativeToken(tokenIn.address), ')')
  debugLog('Token Out:', tokenOut.symbol, tokenOut.address, '(isNative:', isNativeToken(tokenOut.address), ')')

  // Validate recipient address
  if (!isAddress(recipient)) {
    throw new Error(`Invalid recipient address: ${recipient}`)
  }

  // Create pool key
  const poolKey = createPoolKey(tokenIn, tokenOut)

  // Get token addresses (convert ETH to WETH for pool key)
  const tokenInAddress = getPoolTokenAddress(tokenIn)
  const tokenOutAddress = getPoolTokenAddress(tokenOut)

  // Determine swap direction
  const zeroForOne = getZeroForOne(tokenInAddress, tokenOutAddress)

  // Get V4 currencies (native ETH = address(0))
  const currencyIn = getV4Currency(tokenIn)
  const currencyOut = getV4Currency(tokenOut)

  // For the poolKey, use address(0) if native ETH is involved
  // If tokenOut is native ETH and currency0 is WETH, use address(0)
  let poolKeyCurrency0 = poolKey.currency0
  let poolKeyCurrency1 = poolKey.currency1

  if (isNativeToken(tokenIn.address) && poolKey.currency0 === getPoolTokenAddress(tokenIn)) {
    poolKeyCurrency0 = '0x0000000000000000000000000000000000000000'
  }
  if (isNativeToken(tokenIn.address) && poolKey.currency1 === getPoolTokenAddress(tokenIn)) {
    poolKeyCurrency1 = '0x0000000000000000000000000000000000000000'
  }

  if (isNativeToken(tokenOut.address) && poolKey.currency0 === getPoolTokenAddress(tokenOut)) {
    poolKeyCurrency0 = '0x0000000000000000000000000000000000000000'
  }
  if (isNativeToken(tokenOut.address) && poolKey.currency1 === getPoolTokenAddress(tokenOut)) {
    poolKeyCurrency1 = '0x0000000000000000000000000000000000000000'
  }

  debugLog('PoolKey currency0:', poolKeyCurrency0)
  debugLog('PoolKey currency1:', poolKeyCurrency1)
  debugLog('Zero for One:', zeroForOne)
  debugLog('Currency In (for SETTLE):', currencyIn)
  debugLog('Currency Out (for TAKE):', currencyOut)
  debugLog('AmountIn:', amountIn.toString())
  debugLog('MinAmountOut:', minAmountOut.toString())
  debugLog('Recipient:', recipient)

  // Build V4 actions using the V4Planner SDK
  const planner = new V4Planner()

  // 1. Execute the swap
  planner.addAction(Actions.SWAP_EXACT_IN_SINGLE, [
    {
      poolKey: {
        currency0: poolKeyCurrency0,
        currency1: poolKeyCurrency1,
        fee: poolKey.fee,
        tickSpacing: poolKey.tickSpacing,
        hooks: poolKey.hooks,
      },
      zeroForOne,
      amountIn: amountIn.toString(),
      amountOutMinimum: minAmountOut.toString(),
      hookData: '0x',
    },
  ])

  // 2. Settle the input currency (pay tokens from user)
  planner.addAction(Actions.SETTLE, [currencyIn, amountIn.toString(), true])

  // 3. Take the output currency (receive tokens to recipient)
  planner.addAction(Actions.TAKE, [currencyOut, recipient, '0'])

  const v4Input = planner.finalize() as Hex
  const commands = `0x${V4_SWAP_COMMAND.toString(16).padStart(2, '0')}` as Hex
  const inputs: Hex[] = [v4Input]

  debugLog('=== V4 Encoding Complete ===')
  debugLog('Action sequence:', 'SWAP_EXACT_IN_SINGLE -> SETTLE -> TAKE')
  debugLog('Commands:', commands)
  debugLog('Inputs length:', inputs.length)
  debugLog('Inputs[0] length:', inputs[0].length)

  return { commands, inputs }
}

/**
 * Prepare transaction data for single-hop swap
 */
export function prepareSingleHopSwap(params: SingleHopSwapParams): {
  to: Address
  data: Hex
  value: bigint
} {
  // Validate parameters
  const validation = validateSingleHopSwapParams(params)
  if (!validation.valid) {
    throw new Error(`Invalid swap parameters: ${validation.error}`)
  }

  const { tokenIn, amountIn, deadline, chainId } = params

  // Get Universal Router address
  const universalRouterAddress = getUniversalRouterAddress(chainId)

  // Encode V4 swap actions
  const { commands, inputs } = encodeV4SwapActions(params)

  // Encode the execute function call
  const data = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: [commands, inputs, deadline],
  })

  // Calculate value (only if swapping native ETH)
  const value = isNativeToken(tokenIn.address) ? amountIn : BigInt(0)

  debugLog('=== Universal Router Transaction ===')
  debugLog('To:', universalRouterAddress)
  debugLog('Value:', value.toString(), 'wei')
  debugLog('Commands:', commands)
  debugLog('Inputs length:', inputs.length)
  debugLog('Deadline:', deadline.toString())
  debugLog('Data length:', data.length)

  return {
    to: universalRouterAddress,
    data,
    value,
  }
}

/**
 * Execute a single-hop swap
 */
export async function executeSingleHopSwap(params: SingleHopSwapParams): Promise<{
  to: Address
  data: Hex
  value: bigint
}> {
  try {
    const tx = prepareSingleHopSwap(params)
    return tx
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to prepare single-hop swap: ${errorMessage}`)
  }
}

/**
 * Validate single-hop swap parameters
 */
export function validateSingleHopSwapParams(params: SingleHopSwapParams): {
  valid: boolean
  error?: string
} {
  if (params.amountIn <= BigInt(0)) {
    return { valid: false, error: 'Amount in must be greater than 0' }
  }

  if (params.minAmountOut < BigInt(0)) {
    return { valid: false, error: 'Minimum amount out cannot be negative' }
  }

  if (params.tokenIn.chainId !== params.tokenOut.chainId) {
    return { valid: false, error: 'Tokens must be on the same chain' }
  }

  if (params.tokenIn.address.toLowerCase() === params.tokenOut.address.toLowerCase()) {
    return { valid: false, error: 'Cannot swap a token for itself' }
  }

  if (params.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    return { valid: false, error: 'Deadline has already passed' }
  }

  return { valid: true }
}
