import { NextRequest, NextResponse } from 'next/server'
import { OneInchAPI } from '@/plugins/1inch/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const src = searchParams.get('src')
    const dst = searchParams.get('dst')
    const amount = searchParams.get('amount')
    const from = searchParams.get('from')
    const slippage = searchParams.get('slippage')
    const chainId = searchParams.get('chainId') || '42161' // Default to Arbitrum

    if (!src || !dst || !amount || !from) {
      return NextResponse.json(
        { error: 'Missing required parameters: src, dst, amount, from' },
        { status: 400 }
      )
    }

    const api = new OneInchAPI(process.env.ONEINCH_API_KEY || '')
    const data = await api.executeSwap({
      chainId: parseInt(chainId),
      src,
      dst,
      amount,
      from,
      slippage: slippage ? parseFloat(slippage) : undefined,
    })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Swap execution API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to execute swap' },
      { status: 500 }
    )
  }
}
