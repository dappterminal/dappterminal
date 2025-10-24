import { NextRequest, NextResponse } from 'next/server'
import { OneInchAPI } from '@/plugins/1inch/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const src = searchParams.get('src')
    const dst = searchParams.get('dst')
    const amount = searchParams.get('amount')
    const slippage = searchParams.get('slippage')
    const chainId = searchParams.get('chainId') || '42161' // Default to Arbitrum

    if (!src || !dst || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: src, dst, amount' },
        { status: 400 }
      )
    }

    const api = new OneInchAPI(process.env.ONEINCH_API_KEY || '')
    const data = await api.getSwapQuote({
      chainId: parseInt(chainId),
      src,
      dst,
      amount,
      slippage: slippage ? parseFloat(slippage) : undefined,
    })

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Swap quote API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to get swap quote'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
