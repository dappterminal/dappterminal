import { NextRequest, NextResponse } from 'next/server';
import { createOneInchPlugin } from '@/plugins/1inch';

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

    // Use the 1inch plugin
    const plugin = createOneInchPlugin();
    const data = await plugin.getTokenBalances({
      chainId: parseInt(chainId),
      walletAddress
    });

    console.log('Response status: success');

    // Transform the response to include more readable information
    const transformedBalances = Object.entries(data).map(([tokenAddress, tokenData]: [string, any]) => {
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

  } catch (error: any) {
    console.error('Balance API error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}