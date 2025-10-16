import { NextRequest, NextResponse } from 'next/server'
import { OneInchAPI } from '@/plugins/1inch/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainId = searchParams.get('chainId') || '1'

    const api = new OneInchAPI(process.env.ONEINCH_API_KEY || '')
    const data = await api.getGasPrice({ chainId: parseInt(chainId) })

    return NextResponse.json(data)
  } catch (error: any) {
    console.error('Gas price API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get gas prices' },
      { status: 500 }
    )
  }
}
