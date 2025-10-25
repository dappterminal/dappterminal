/**
 * Uniswap V4 Quote Logic
 *
 * Get quotes from V4 Quoter contract
 */

import { QuoteParams, QuoteResult, Token } from '../types'
import { createPublicClient, http } from 'viem'
import { getQuoterAddress, QUOTER_ABI } from './contracts'
import { createPoolKey, getZeroForOne, getPoolTokenAddress } from './poolUtils'
import { formatUnits } from 'viem'
import { mainnet, base, arbitrum, optimism } from 'viem/chains'

// Get chain object from chain ID
function getChainFromId(chainId: number) {
  switch (chainId) {
    case 1:
      return mainnet
    case 8453:
      return base
    case 42161:
      return arbitrum
    case 10:
      return optimism
    default:
      return mainnet
  }
}

/**
 * Calculate minimum amount out based on slippage
 */
function calculateMinAmountOut(amountOut: bigint, slippageBps: number): bigint {
  return (amountOut * BigInt(10000 - slippageBps)) / BigInt(10000)
}

/**
 * Get quote for a single-hop swap
 */
export async function getSingleHopQuote(params: QuoteParams): Promise<QuoteResult> {
  const { tokenIn, tokenOut, amountIn, slippageBps = 50, chainId } = params

  try {
    // Create pool key
    const poolKey = createPoolKey(tokenIn, tokenOut)

    // Determine swap direction
    const tokenInAddress = getPoolTokenAddress(tokenIn)
    const tokenOutAddress = getPoolTokenAddress(tokenOut)
    const zeroForOne = getZeroForOne(tokenInAddress, tokenOutAddress)

    // Create public client
    const chain = getChainFromId(chainId)
    const client = createPublicClient({
      chain,
      transport: http(),
    })

    // Get quoter address
    const quoterAddress = getQuoterAddress(chainId)

    // Call quoter contract
    const result = await client.readContract({
      address: quoterAddress,
      abi: QUOTER_ABI,
      functionName: 'quoteExactInputSingle',
      args: [
        {
          poolKey: {
            currency0: poolKey.currency0,
            currency1: poolKey.currency1,
            fee: poolKey.fee,
            tickSpacing: poolKey.tickSpacing,
            hooks: poolKey.hooks,
          },
          zeroForOne,
          exactAmount: amountIn,
          hookData: '0x' as `0x${string}`,
        },
      ],
    }) as readonly [bigint, bigint]

    // Extract amount out and gas estimate
    const [amountOut, gasEstimate] = result

    // Validate we got a valid quote
    if (!amountOut || amountOut === 0n) {
      throw new Error('Invalid quote received from quoter')
    }

    // Calculate minimum amount out based on slippage
    const minAmountOut = calculateMinAmountOut(amountOut, slippageBps)

    // Calculate price impact (simplified)
    const priceImpact = 0.1

    // Format amounts
    const amountOutFormatted = formatUnits(amountOut, tokenOut.decimals)
    const minAmountOutFormatted = formatUnits(minAmountOut, tokenOut.decimals)

    // Calculate execution price
    const amountInNum = Number(formatUnits(amountIn, tokenIn.decimals))
    const amountOutNum = Number(formatUnits(amountOut, tokenOut.decimals))
    const executionPrice = amountInNum > 0 ? `${(amountOutNum / amountInNum).toFixed(6)} ${tokenOut.symbol} per ${tokenIn.symbol}` : '0'

    return {
      amountOut,
      amountOutFormatted,
      priceImpact,
      minAmountOut,
      minAmountOutFormatted,
      route: [tokenIn, tokenOut],
      executionPrice,
      gasEstimate,
    }
  } catch (error: unknown) {
    const err = error as { message?: string }
    const message = err.message ?? ''

    if (message.includes('returned no data') || message.includes('"0x"')) {
      throw new Error(
        `Pool does not exist for ${tokenIn.symbol}/${tokenOut.symbol}. ` +
        `Uniswap V4 is newly deployed - pools may be limited. Try a different token pair or fee tier.`
      )
    }

    if (message.includes('revert') || message.includes('execution reverted')) {
      throw new Error('Pool does not exist for this token pair. Try a different fee tier or token pair.')
    }

    throw new Error(`Failed to get quote: ${message || 'Unknown error'}`)
  }
}
