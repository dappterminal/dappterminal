import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  try {
    const apiKey = process.env.ONEINCH_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: '1inch API key not configured' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('query');
    const chainId = searchParams.get('chainId') || '1';

    if (!query) {
      return NextResponse.json(
        { error: 'Missing required parameter: query' },
        { status: 400 }
      );
    }

    const url = `https://api.1inch.com/token/v1.2/${chainId}/search?query=${encodeURIComponent(query)}&ignore_listed=false&only_positive_rating=false&limit=1&country=us`;

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('1inch token search API error:', response.status, errorText);
      return NextResponse.json(
        { error: `1inch API error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();

    if (!Array.isArray(data) || data.length === 0) {
      return NextResponse.json(
        { error: `Token '${query}' not found on chain ${chainId}` },
        { status: 404 }
      );
    }

    const token = data[0];
    return NextResponse.json({
      chainId: parseInt(chainId),
      address: token.address,
      symbol: token.symbol,
      name: token.name,
      decimals: token.decimals,
      logoURI: token.logoURI,
    });

  } catch (error) {
    console.error('Token search API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
