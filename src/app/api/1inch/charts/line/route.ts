import { NextRequest, NextResponse } from 'next/server';
import { chartCache } from '@/lib/cache';
import { rateLimit, getClientIdentifier } from '@/lib/rate-limit';

const ONEINCH_API_KEY = process.env.ONEINCH_API_KEY;

export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30 req/min per client
    const clientId = getClientIdentifier(request);
    const rl = await rateLimit(`chart:1inch-line:${clientId}`, 'MODERATE');
    if (!rl.success) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again shortly.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.reset - Date.now()) / 1000)) } }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const token0 = searchParams.get('token0');
    const token1 = searchParams.get('token1');
    const period = searchParams.get('period') || '24H'; // Default to 24H
    const chainId = searchParams.get('chainId') || '1'; // Default to Ethereum

    if (process.env.NODE_ENV === 'development') {
      console.log('Line chart request for:', { token0, token1, period, chainId });
    }

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

    // Check server-side cache
    const cacheKey = `1inch:line:${token0}:${token1}:${period}:${chainId}`;
    const cached = chartCache.oneInchLine.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }

    // Call 1inch API with the correct URL pattern
    const url = `https://api.1inch.com/charts/v1.0/chart/line/${token0}/${token1}/${period}/${chainId}`;

    if (process.env.NODE_ENV === 'development') {
      console.log('Calling 1inch charts API:', url);
    }

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
      if (process.env.NODE_ENV === 'development') {
        console.error('1inch API error:', response.status, errorText);
      }
      return NextResponse.json(
        { error: `1inch API error: ${response.status}`, details: errorText },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (process.env.NODE_ENV === 'development') {
      console.log('Line chart data received:', data ? 'success' : 'empty');
    }

    const responseBody = {
      token0,
      token1,
      period,
      chainId: parseInt(chainId),
      data
    };

    // Store in cache
    chartCache.oneInchLine.set(cacheKey, responseBody);

    return NextResponse.json(responseBody);

  } catch (error: unknown) {
    console.error('Chart line error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}