/**
 * Uniswap V4 Approval Check API
 *
 * Checks ERC20 and Permit2 allowances and returns approval transactions if needed
 */

import { NextRequest, NextResponse } from 'next/server'
import { createPublicClient, http, encodeFunctionData, type Address } from 'viem'
import { mainnet, arbitrum, optimism, base } from 'viem/chains'
import { getContractsByChainId } from '@/plugins/uniswap-v4/lib/contracts'

const ERC20_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const

const PERMIT2_ABI = [
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'token', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [
      { name: 'amount', type: 'uint160' },
      { name: 'expiration', type: 'uint48' },
      { name: 'nonce', type: 'uint48' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const

function getChain(chainId: number) {
  switch (chainId) {
    case 1: return mainnet
    case 42161: return arbitrum
    case 10: return optimism
    case 8453: return base
    default: throw new Error(`Unsupported chain: ${chainId}`)
  }
}

function getRpcUrl(chainId: number): string {
  // Use public RPC endpoints
  switch (chainId) {
    case 1: return 'https://eth.llamarpc.com'
    case 42161: return 'https://arb1.arbitrum.io/rpc'
    case 10: return 'https://mainnet.optimism.io'
    case 8453: return 'https://mainnet.base.org'
    default: throw new Error(`Unsupported chain: ${chainId}`)
  }
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const chainId = parseInt(searchParams.get('chainId') || '1')
    const tokenAddress = searchParams.get('token') as Address
    const walletAddress = searchParams.get('wallet') as Address
    const amount = searchParams.get('amount')

    if (!tokenAddress || !walletAddress || !amount) {
      return NextResponse.json(
        { error: 'Missing required parameters: token, wallet, amount' },
        { status: 400 }
      )
    }

    const contracts = getContractsByChainId(chainId)
    const permit2Address = contracts.permit2
    const universalRouterAddress = contracts.universalRouter
    const requiredAmount = BigInt(amount)

    const chain = getChain(chainId)
    const client = createPublicClient({
      chain,
      transport: http(getRpcUrl(chainId)),
    })

    const approvalTxs: Array<{ to: string; data: string; description: string }> = []

    // Step 1: Check ERC20 allowance to Permit2
    const erc20Allowance = await client.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [walletAddress, permit2Address],
    })

    if (erc20Allowance < requiredAmount) {
      // Need to approve token to Permit2
      const approveData = encodeFunctionData({
        abi: [
          {
            inputs: [
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint256' },
            ],
            name: 'approve',
            outputs: [{ name: '', type: 'bool' }],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'approve',
        args: [permit2Address, requiredAmount],
      })

      approvalTxs.push({
        to: tokenAddress,
        data: approveData,
        description: 'Approve token to Permit2',
      })
    }

    // Step 2: Check Permit2 allowance to Universal Router
    const permit2Allowance = await client.readContract({
      address: permit2Address,
      abi: PERMIT2_ABI,
      functionName: 'allowance',
      args: [walletAddress, tokenAddress, universalRouterAddress],
    })

    const [permit2Amount] = permit2Allowance

    if (permit2Amount < requiredAmount) {
      // Need to approve Universal Router via Permit2
      const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days

      const permit2ApproveData = encodeFunctionData({
        abi: [
          {
            inputs: [
              { name: 'token', type: 'address' },
              { name: 'spender', type: 'address' },
              { name: 'amount', type: 'uint160' },
              { name: 'expiration', type: 'uint48' },
            ],
            name: 'approve',
            outputs: [],
            stateMutability: 'nonpayable',
            type: 'function',
          },
        ],
        functionName: 'approve',
        args: [tokenAddress, universalRouterAddress, requiredAmount, expiration],
      })

      approvalTxs.push({
        to: permit2Address,
        data: permit2ApproveData,
        description: 'Approve Universal Router via Permit2',
      })
    }

    return NextResponse.json({
      needsApproval: approvalTxs.length > 0,
      approvalTxs,
      erc20Allowance: erc20Allowance.toString(),
      permit2Allowance: permit2Amount.toString(),
      requiredAmount: requiredAmount.toString(),
    })
  } catch (error) {
    console.error('Uniswap approval check error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to check approvals' },
      { status: 500 }
    )
  }
}
