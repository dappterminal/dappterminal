import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const walletAddress = searchParams.get('walletAddress');
  const chainId = searchParams.get('chainId') || '1'; // Default to Ethereum

  if (!walletAddress) {
    return NextResponse.json(
      { error: 'Wallet address is required' },
      { status: 400 }
    );
  }

  // Validate wallet address format
  if (!/^0x[a-fA-F0-9]{40}$/.test(walletAddress)) {
    return NextResponse.json(
      { error: 'Invalid wallet address format' },
      { status: 400 }
    );
  }

  try {
    console.log('Fetching balances for:', walletAddress, 'on chain:', chainId);

    // Call 1inch Balance API directly
    const apiKey = process.env.ONEINCH_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key not configured' },
        { status: 500 }
      );
    }

    const url = `https://api.1inch.dev/balance/v1.2/${chainId}/balances/${walletAddress}`;
    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${apiKey}`,
      },
    });

    if (!response.ok) {
      throw new Error(`1inch API error: ${response.statusText}`);
    }

    const data = await response.json() as Record<string, {
      balance: string
      decimals: number
      symbol: string
      name: string
    }>;
    console.log('Response status: success');

    // Transform the response to include more readable information
    const transformedBalances = Object.entries(data).map(([tokenAddress, tokenData]) => {
      const balance = parseFloat(tokenData.balance) / Math.pow(10, tokenData.decimals);

      return {
        tokenAddress,
        symbol: tokenData.symbol,
        name: tokenData.name,
        decimals: tokenData.decimals,
        balance: tokenData.balance,
        formattedBalance: balance.toFixed(6),
        displayBalance: balance < 0.000001 && balance > 0 ? balance.toExponential(3) : balance.toFixed(6)
      };
    });

    // Sort by balance value (highest first)
    transformedBalances.sort((a, b) => parseFloat(b.formattedBalance) - parseFloat(a.formattedBalance));

    return NextResponse.json({
      walletAddress,
      chainId,
      balances: transformedBalances,
      totalTokens: transformedBalances.length
    });

  } catch (error: unknown) {
    console.error('Balance API error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}