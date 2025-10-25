/**
 * Uniswap V4 Multi-Hop Swap Logic
 *
 * Prepares multi-hop swap transactions using @uniswap/v4-sdk V4Planner
 * Based on reference implementation from uniswapv4-nextjs
 */

import { MultiHopSwapParams, Token, PoolKey, PathKey } from '../types'
import { Address, encodeFunctionData, isAddress, Hex } from 'viem'
import { V4Planner, Actions } from '@uniswap/v4-sdk'
import { CommandType, RoutePlanner } from '@uniswap/universal-router-sdk'
import { createPoolKey, getPoolTokenAddress } from './poolUtils'
import { getUniversalRouterAddress, UNIVERSAL_ROUTER_ABI } from './contracts'
import { isNativeToken } from './tokens'

// Debug mode - set to true for detailed logs
const DEBUG = false

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
 * Encode multi-hop exact input path
 *
 * Based on official Uniswap V4 documentation:
 * Converts an array of PoolKeys into PathKey[] format required for multi-hop swaps
 *
 * @param poolKeys - Array of pool keys representing each hop in the route
 * @param currencyIn - Starting currency address
 * @param route - Full token route (used to check if output tokens are native ETH)
 * @returns Array of PathKey objects for the multi-hop path
 */
export function encodeMultihopExactInPath(
  poolKeys: PoolKey[],
  currencyIn: Address,
  route: Token[]
): PathKey[] {
  const pathKeys: PathKey[] = []
  let currentCurrencyIn = currencyIn

  for (let i = 0; i < poolKeys.length; i++) {
    // Determine the output currency for this hop
    const currencyOut = currentCurrencyIn.toLowerCase() === poolKeys[i].currency0.toLowerCase()
      ? poolKeys[i].currency1
      : poolKeys[i].currency0

    // Check if the output token (route[i + 1]) is native ETH
    // If so, use address(0) instead of the pool currency
    const outputToken = route[i + 1]
    const pathCurrency = isNativeToken(outputToken.address)
      ? ('0x0000000000000000000000000000000000000000' as Address)
      : currencyOut

    // Create path key for this hop
    const pathKey: PathKey = {
      intermediateCurrency: pathCurrency,
      fee: poolKeys[i].fee,
      tickSpacing: poolKeys[i].tickSpacing,
      hooks: poolKeys[i].hooks,
      hookData: '0x',
    }

    pathKeys.push(pathKey)
    currentCurrencyIn = currencyOut // Keep using pool currency for next hop matching (WETH, not address(0))
  }

  return pathKeys
}

/**
 * Validate route tokens
 * Ensures all tokens are on same chain and adjacent tokens are different
 */
export function isValidRoute(route: Token[]): boolean {
  if (route.length < 2) return false

  const chainId = route[0].chainId
  for (let i = 0; i < route.length; i++) {
    // All tokens must be on same chain
    if (route[i].chainId !== chainId) return false

    // Adjacent tokens must be different
    if (i > 0 && route[i].address.toLowerCase() === route[i - 1].address.toLowerCase()) {
      return false
    }
  }

  return true
}

/**
 * Encode V4 multi-hop swap actions using the official V4 SDK Planner
 *
 * V4 Multi-Hop Swap Action Sequence:
 * 1. SWAP_EXACT_IN - Execute multi-hop swap through multiple pools
 * 2. SETTLE_ALL - Pay the input tokens from user to PoolManager
 * 3. TAKE_ALL - Withdraw output tokens from PoolManager to recipient
 *
 * @param params - Multi-hop swap parameters
 * @returns Encoded commands and inputs for Universal Router
 */
function encodeV4MultiHopActions(
  params: MultiHopSwapParams
): { commands: Hex; inputs: Hex[] } {
  const { route, amountIn, minAmountOut, recipient } = params

  // Validate recipient address format
  if (!isAddress(recipient)) {
    throw new Error(`Invalid recipient address: ${recipient}`)
  }

  // Validate route
  if (!isValidRoute(route)) {
    throw new Error('Invalid route: tokens must be on same chain and adjacent tokens must be different')
  }

  if (route.length < 3) {
    throw new Error('Multi-hop route must have at least 3 tokens')
  }

  const tokenIn = route[0]
  const tokenOut = route[route.length - 1]

  // Build pool keys for each hop
  const poolKeys: PoolKey[] = []
  for (let i = 0; i < route.length - 1; i++) {
    const poolKey = createPoolKey(route[i], route[i + 1])

    // For V4, if either token is native ETH, replace WETH with address(0) in pool key
    const token0 = route[i]
    const token1 = route[i + 1]

    const poolKeyCurrency0 =
      (isNativeToken(token0.address) && poolKey.currency0 === getPoolTokenAddress(token0)) ||
      (isNativeToken(token1.address) && poolKey.currency0 === getPoolTokenAddress(token1))
        ? '0x0000000000000000000000000000000000000000'
        : poolKey.currency0

    const poolKeyCurrency1 =
      (isNativeToken(token0.address) && poolKey.currency1 === getPoolTokenAddress(token0)) ||
      (isNativeToken(token1.address) && poolKey.currency1 === getPoolTokenAddress(token1))
        ? '0x0000000000000000000000000000000000000000'
        : poolKey.currency1

    // Create the final pool key with proper native ETH handling
    poolKeys.push({
      ...poolKey,
      currency0: poolKeyCurrency0 as Address,
      currency1: poolKeyCurrency1 as Address,
    })
  }

  // Get currency addresses
  const currencyIn = getV4Currency(tokenIn)
  const currencyOut = getV4Currency(tokenOut)

  // Encode the multi-hop path
  const path = encodeMultihopExactInPath(poolKeys, currencyIn, route)

  if (DEBUG) {
    console.log('=== V4 Multi-Hop Swap Config ===')
    console.log('Route:', route.map(t => t.symbol).join(' → '))
    console.log('Token In:', tokenIn.symbol, tokenIn.address, '(isNative:', isNativeToken(tokenIn.address), ')')
    console.log('Token Out:', tokenOut.symbol, tokenOut.address, '(isNative:', isNativeToken(tokenOut.address), ')')
    console.log('Currency In (for SETTLE_ALL):', currencyIn)
    console.log('Currency Out (for TAKE_ALL):', currencyOut)
    console.log('AmountIn:', amountIn.toString())
    console.log('MinAmountOut:', minAmountOut.toString())
    console.log('Number of hops:', poolKeys.length)
    console.log('Pool Keys:')
    poolKeys.forEach((pk, i) => {
      console.log(`  Pool ${i}: ${pk.currency0} / ${pk.currency1}, fee: ${pk.fee}, tickSpacing: ${pk.tickSpacing}`)
    })
    console.log('Path Keys:')
    path.forEach((pk, i) => {
      console.log(`  Path ${i}: intermediateCurrency=${pk.intermediateCurrency}, fee=${pk.fee}, tickSpacing=${pk.tickSpacing}`)
    })
    console.log('Recipient:', recipient)
  }

  // Build V4 actions using the official V4Planner SDK
  const v4Planner = new V4Planner()

  // 1. Execute multi-hop swap
  v4Planner.addAction(Actions.SWAP_EXACT_IN, [
    {
      currencyIn,
      path,
      amountIn: amountIn.toString(),
      amountOutMinimum: minAmountOut.toString(),
    },
  ])

  // 2. Settle the input currency (pay tokens from user)
  v4Planner.addAction(Actions.SETTLE_ALL, [currencyIn, amountIn.toString()])

  // 3. Take the output currency (receive tokens to recipient)
  v4Planner.addAction(Actions.TAKE_ALL, [currencyOut, minAmountOut.toString()])

  // Finalize V4 planner to get encoded actions
  const encodedActions = v4Planner.finalize() as Hex

  // Create Universal Router planner
  const routePlanner = new RoutePlanner()

  // Add V4_SWAP command with the encoded actions
  routePlanner.addCommand(CommandType.V4_SWAP, [encodedActions])

  if (DEBUG) {
    console.log('=== V4 Multi-Hop Encoding Complete ===')
    console.log('Action sequence:', 'SWAP_EXACT_IN -> SETTLE_ALL -> TAKE_ALL')
    console.log('Commands:', routePlanner.commands)
    console.log('Inputs length:', routePlanner.inputs.length)
  }

  return {
    commands: routePlanner.commands as Hex,
    inputs: routePlanner.inputs as Hex[],
  }
}

/**
 * Prepare transaction data for multi-hop swap
 *
 * @param params - Multi-hop swap parameters
 * @returns Transaction object ready to be sent via sendTransaction
 */
export function prepareMultiHopSwap(params: MultiHopSwapParams): {
  to: Address
  data: Hex
  value: bigint
} {
  // Validate parameters before encoding
  const validation = validateMultiHopSwapParams(params)
  if (!validation.valid) {
    throw new Error(`Invalid multi-hop swap parameters: ${validation.error}`)
  }

  const { route, amountIn, deadline, chainId } = params

  // Get Universal Router address
  const universalRouterAddress = getUniversalRouterAddress(chainId)

  // Encode V4 planner actions
  const { commands, inputs } = encodeV4MultiHopActions(params)

  // Encode the execute function call
  const data = encodeFunctionData({
    abi: UNIVERSAL_ROUTER_ABI,
    functionName: 'execute',
    args: [commands, inputs, deadline],
  })

  // Calculate value (only if swapping native ETH)
  const tokenIn = route[0]
  const value = isNativeToken(tokenIn.address) ? amountIn : BigInt(0)

  if (DEBUG) {
    console.log('=== Universal Router Multi-Hop Transaction ===')
    console.log('To:', universalRouterAddress)
    console.log('Value:', value.toString(), 'wei')
    console.log('Commands:', commands)
    console.log('Inputs length:', inputs.length)
    console.log('Deadline:', deadline.toString())
    console.log('Data length:', data.length)
  }

  return {
    to: universalRouterAddress,
    data,
    value,
  }
}

/**
 * Execute a multi-hop swap
 *
 * Note: This function prepares the transaction data.
 * Actual execution should be done via wagmi's sendTransaction hook.
 *
 * @param params - Multi-hop swap parameters
 * @returns Transaction object ready to be sent
 * @throws Error if parameters are invalid or encoding fails
 */
export async function executeMultiHopSwap(params: MultiHopSwapParams): Promise<{
  to: Address
  data: Hex
  value: bigint
}> {
  try {
    // Prepare transaction (validation happens inside)
    const tx = prepareMultiHopSwap(params)
    return tx
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    throw new Error(`Failed to prepare multi-hop swap: ${errorMessage}`)
  }
}

/**
 * Validate multi-hop swap parameters
 *
 * @param params - Multi-hop swap parameters to validate
 * @returns Validation result with error message if invalid
 */
export function validateMultiHopSwapParams(params: MultiHopSwapParams): {
  valid: boolean
  error?: string
} {
  if (params.amountIn <= BigInt(0)) {
    return { valid: false, error: 'Amount in must be greater than 0' }
  }

  if (params.minAmountOut < BigInt(0)) {
    return { valid: false, error: 'Minimum amount out cannot be negative' }
  }

  if (params.route.length < 3) {
    return { valid: false, error: 'Multi-hop route must have at least 3 tokens (e.g., ETH → USDC → DAI)' }
  }

  if (!isValidRoute(params.route)) {
    return { valid: false, error: 'Invalid route: tokens must be on same chain and adjacent tokens must be different' }
  }

  if (!isAddress(params.recipient)) {
    return { valid: false, error: 'Invalid recipient address' }
  }

  if (params.deadline <= BigInt(Math.floor(Date.now() / 1000))) {
    return { valid: false, error: 'Deadline has already passed' }
  }

  return { valid: true }
}

/**
 * Get common intermediate tokens for routing on a specific chain
 * These tokens typically have deep liquidity and can be used to route between other tokens
 *
 * @param chainId - Chain ID to get intermediate tokens for
 * @returns Array of common token addresses (WETH, USDC, USDT, DAI, etc.)
 */
export function getCommonIntermediateTokens(chainId: number): Address[] {
  switch (chainId) {
    case 1: // Mainnet
      return [
        '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
        '0xdAC17F958D2ee523a2206206994597C13D831ec7', // USDT
        '0x6B175474E89094C44Da98b954EedeAC495271d0F', // DAI
      ]
    case 11155111: // Sepolia
      return [
        '0xfFf9976782d46CC05630D1f6eBAb18b2324d6B14', // WETH
        '0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238', // USDC
      ]
    case 10: // Optimism
      return [
        '0x4200000000000000000000000000000000000006', // WETH
        '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', // USDC
        '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', // USDT
      ]
    case 8453: // Base
      return [
        '0x4200000000000000000000000000000000000006', // WETH
        '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
      ]
    case 42161: // Arbitrum
      return [
        '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // WETH
        '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', // USDC
        '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', // USDT
      ]
    default:
      return []
  }
}

/**
 * Suggest a multi-hop route between two tokens
 * Attempts to find a path through common intermediate tokens (WETH, USDC, etc.)
 *
 * @param tokenInAddress - Input token address
 * @param tokenOutAddress - Output token address
 * @param chainId - Chain ID
 * @returns Suggested route as array of token addresses
 */
export async function suggestRoute(
  tokenInAddress: Address,
  tokenOutAddress: Address,
  chainId: number
): Promise<Address[]> {
  const intermediates = getCommonIntermediateTokens(chainId)

  // Try each intermediate token to find a valid route
  for (const intermediate of intermediates) {
    if (
      intermediate.toLowerCase() !== tokenInAddress.toLowerCase() &&
      intermediate.toLowerCase() !== tokenOutAddress.toLowerCase()
    ) {
      // Return route through this intermediate
      return [tokenInAddress, intermediate, tokenOutAddress]
    }
  }

  // Default: return direct route (will use single-hop)
  return [tokenInAddress, tokenOutAddress]
}
