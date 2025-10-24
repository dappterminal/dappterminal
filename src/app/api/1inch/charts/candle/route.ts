import { NextRequest, NextResponse } from 'next/server';

const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const token0 = searchParams.get('token0');
    const token1 = searchParams.get('token1');
    const period = searchParams.get('period') || '86400'; // Default to 86400 seconds (24 hours)
    const chainId = searchParams.get('chainId') || '1'; // Default to Ethereum

    console.log('Candle chart request for:', { token0, token1, period, chainId });

    if (!token0 || !token1) {
      return NextResponse.json(
        { error: 'Missing required parameters: token0 and token1' },
        { status: 400 }
      );
    }

    if (!ONEINCH_API_KEY) {
      return NextResponse.json(
        { error: '1inch API key not configured' },
        { status: 500 }
      );
    }

    // Call 1inch API with the correct URL pattern (aggregated/candle with seconds)
    const url = `https://api.1inch.com/charts/v1.0/chart/aggregated/candle/${token0}/${token1}/${period}/${chainId}`;

    console.log('Calling 1inch charts API:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${ONEINCH_API_KEY}`,
        'accept': 'application/json',
        'content-type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('1inch API error:', response.status, errorText);
      return NextResponse.json(
        { error: `1inch API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    console.log('Candle chart data received:', data ? 'success' : 'empty');

    return NextResponse.json({
      token0,
      token1,
      period,
      chainId: parseInt(chainId),
      candles: data
    });

  } catch (error: any) {
    console.error('Charts API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}