import { NextRequest, NextResponse } from 'next/server'
import { prepareSingleHopSwap } from '@/plugins/uniswap-v4/lib/singleHopSwap'
import { prepareMultiHopSwap } from '@/plugins/uniswap-v4/lib/multiHopSwap'
import { getSingleHopQuote, getMultiHopQuote } from '@/plugins/uniswap-v4/lib/quote'
import { resolveToken, getTokenBySymbol } from '@/plugins/uniswap-v4/lib/tokens'
import type { Token } from '@/plugins/uniswap-v4/types'

// Common intermediate tokens for multi-hop routing
const INTERMEDIATE_TOKENS = ['WETH', 'USDC', 'USDT', 'DAI']

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const src = searchParams.get('src')
    const dst = searchParams.get('dst')
    const amount = searchParams.get('amount')
    const from = searchParams.get('from')
    const slippage = searchParams.get('slippage')
    const chainId = parseInt(searchParams.get('chainId') || '1')

    if (!src || !dst || !amount || !from) {
      return NextResponse.json(
        { error: 'Missing required parameters: src, dst, amount, from' },
        { status: 400 }
      )
    }

    // Resolve token symbols to Token objects
    const tokenIn = resolveToken(src, chainId)
    const tokenOut = resolveToken(dst, chainId)

    if (!tokenIn) {
      return NextResponse.json(
        { error: `Unknown token: ${src}` },
        { status: 400 }
      )
    }

    if (!tokenOut) {
      return NextResponse.json(
        { error: `Unknown token: ${dst}` },
        { status: 400 }
      )
    }

    // Parse slippage (default 0.5% = 50 bps)
    const slippageBps = slippage ? Math.round(parseFloat(slippage) * 100) : 50
    const amountIn = BigInt(amount)
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 20 * 60)

    // Try single-hop first
    try {
      const quote = await getSingleHopQuote({
        tokenIn,
        tokenOut,
        amountIn,
        slippageBps,
        chainId,
      })

      const tx = prepareSingleHopSwap({
        tokenIn,
        tokenOut,
        amountIn,
        minAmountOut: quote.minAmountOut,
        recipient: from as `0x${string}`,
        deadline,
        chainId,
      })

      return NextResponse.json({
        tx: {
          to: tx.to,
          data: tx.data,
          value: tx.value.toString(),
        },
        dstAmount: quote.amountOut.toString(),
        dstAmountFormatted: quote.amountOutFormatted,
        minAmountOut: quote.minAmountOut.toString(),
        gas: quote.gasEstimate?.toString() || '150000',
        route: 'single-hop',
      })
    } catch (singleHopError) {
      // Single-hop failed, try multi-hop with intermediate tokens
      console.log('Single-hop swap failed, trying multi-hop routing...')

      for (const intermediateSymbol of INTERMEDIATE_TOKENS) {
        if (
          intermediateSymbol.toUpperCase() === src.toUpperCase() ||
          intermediateSymbol.toUpperCase() === dst.toUpperCase()
        ) {
          continue
        }

        const intermediateToken = getTokenBySymbol(intermediateSymbol, chainId)
        if (!intermediateToken) continue

        try {
          const route: Token[] = [tokenIn, intermediateToken, tokenOut]

          const quote = await getMultiHopQuote({
            route,
            amountIn,
            slippageBps,
            chainId,
          })

          const tx = prepareMultiHopSwap({
            route,
            amountIn,
            minAmountOut: quote.minAmountOut,
            recipient: from as `0x${string}`,
            deadline,
            chainId,
          })

          return NextResponse.json({
            tx: {
              to: tx.to,
              data: tx.data,
              value: tx.value.toString(),
            },
            dstAmount: quote.amountOut.toString(),
            dstAmountFormatted: quote.amountOutFormatted,
            minAmountOut: quote.minAmountOut.toString(),
            gas: quote.gasEstimate?.toString() || '250000',
            route: `multi-hop via ${intermediateSymbol}`,
          })
        } catch {
          continue
        }
      }

      // All routing attempts failed
      const singleHopMsg = singleHopError instanceof Error ? singleHopError.message : 'Unknown error'
      throw new Error(`No route found for ${src}/${dst}. ${singleHopMsg}`)
    }
  } catch (error: unknown) {
    console.error('Uniswap swap API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to prepare swap'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
