import { NextRequest, NextResponse } from 'next/server'
import { OneInchAPI } from '@/plugins/1inch/api'

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainId = searchParams.get('chainId') || '1'
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { error: 'Token parameter is required' },
        { status: 400 }
      )
    }

    const api = new OneInchAPI(process.env.ONEINCH_API_KEY || '')
    const data = await api.getTokenPrice({
      chainId: parseInt(chainId),
      token,
    })

    // The API returns { [tokenAddress]: priceInUSD }
    const tokenAddress = token.toLowerCase()
    const price = data[tokenAddress]

    if (!price) {
      return NextResponse.json(
        { error: 'Price not found for token' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      price: price,
      token: tokenAddress,
    })
  } catch (error: any) {
    console.error('Token price API error:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to get token price' },
      { status: 500 }
    )
  }
}
