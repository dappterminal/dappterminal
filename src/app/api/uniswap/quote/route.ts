import { NextRequest, NextResponse } from 'next/server'
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
    const slippage = searchParams.get('slippage')
    const chainId = parseInt(searchParams.get('chainId') || '1')

    if (!src || !dst || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: src, dst, amount' },
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

    // Try single-hop first
    try {
      const quote = await getSingleHopQuote({
        tokenIn,
        tokenOut,
        amountIn,
        slippageBps,
        chainId,
      })

      return NextResponse.json({
        dstAmount: quote.amountOut.toString(),
        dstAmountFormatted: quote.amountOutFormatted,
        minAmountOut: quote.minAmountOut.toString(),
        minAmountOutFormatted: quote.minAmountOutFormatted,
        priceImpact: quote.priceImpact,
        executionPrice: quote.executionPrice,
        gas: quote.gasEstimate?.toString() || '0',
        route: 'single-hop',
        srcToken: {
          symbol: tokenIn.symbol,
          name: tokenIn.name,
          decimals: tokenIn.decimals,
          address: tokenIn.address,
        },
        dstToken: {
          symbol: tokenOut.symbol,
          name: tokenOut.name,
          decimals: tokenOut.decimals,
          address: tokenOut.address,
        },
      })
    } catch (singleHopError) {
      // Single-hop failed, try multi-hop with intermediate tokens
      console.log('Single-hop failed, trying multi-hop routing...')

      const errors: string[] = []

      for (const intermediateSymbol of INTERMEDIATE_TOKENS) {
        // Skip if intermediate is same as src or dst
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

          return NextResponse.json({
            dstAmount: quote.amountOut.toString(),
            dstAmountFormatted: quote.amountOutFormatted,
            minAmountOut: quote.minAmountOut.toString(),
            minAmountOutFormatted: quote.minAmountOutFormatted,
            priceImpact: quote.priceImpact,
            executionPrice: quote.executionPrice,
            gas: quote.gasEstimate?.toString() || '0',
            route: `multi-hop via ${intermediateSymbol}`,
            intermediateToken: intermediateSymbol,
            srcToken: {
              symbol: tokenIn.symbol,
              name: tokenIn.name,
              decimals: tokenIn.decimals,
              address: tokenIn.address,
            },
            dstToken: {
              symbol: tokenOut.symbol,
              name: tokenOut.name,
              decimals: tokenOut.decimals,
              address: tokenOut.address,
            },
          })
        } catch (multiHopError) {
          const errMsg = multiHopError instanceof Error ? multiHopError.message : 'Unknown error'
          errors.push(`${intermediateSymbol}: ${errMsg}`)
          continue
        }
      }

      // All routing attempts failed
      const singleHopMsg = singleHopError instanceof Error ? singleHopError.message : 'Unknown error'
      throw new Error(
        `No route found for ${src}/${dst}. ` +
        `Direct pool: ${singleHopMsg}. ` +
        `Multi-hop attempts also failed.`
      )
    }
  } catch (error: unknown) {
    console.error('Uniswap quote API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to get quote'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
