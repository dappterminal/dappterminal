import { NextRequest, NextResponse } from 'next/server'
import { OneInchAPI } from '@/plugins/1inch/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainId = searchParams.get('chainId') || '1'
    const tokenAddress = searchParams.get('tokenAddress')
    const walletAddress = searchParams.get('walletAddress')

    if (!tokenAddress || !walletAddress) {
      return NextResponse.json(
        { error: 'tokenAddress and walletAddress parameters are required' },
        { status: 400 }
      )
    }

    const api = new OneInchAPI(process.env.ONEINCH_API_KEY || '')
    const data = await api.getAllowance({
      chainId: parseInt(chainId),
      tokenAddress,
      walletAddress,
    })

    return NextResponse.json(data)
  } catch (error: unknown) {
    console.error('Allowance API error:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to get allowance'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
