/**
 * Stargate Protocol Commands
 */

import type { Command, CommandResult, ExecutionContext } from '@/core'
import { resolveTokenAddress, getTokenDecimals } from './tokens'
import { getStargateChainKey, isChainSupported } from '@/lib/stargate'
import type { BridgeRequestData } from './types'

/**
 * Bridge command - Cross-chain token bridge via Stargate
 *
 * Usage: bridge <amount> <token> <fromChain> <toChain> [--slippage <percent>]
 * Example: bridge 100 usdc base arbitrum
 * Example: bridge 50 usdt ethereum optimism --slippage 1
 */
export const bridgeCommand: Command = {
  id: 'bridge',
  scope: 'G_p',
  protocol: 'stargate',
  description: 'Bridge tokens across chains using Stargate',
  aliases: ['b', 'transfer'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Verify wallet is connected
      if (!context.wallet.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      // Parse arguments: bridge <amount> <token> <fromChain> <toChain> [--slippage <percent>]
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ')

      if (parts.length < 4) {
        return {
          success: false,
          error: new Error(
            'Usage: bridge <amount> <token> <fromChain> <toChain> [--slippage <percent>]\n' +
            'Example: bridge 100 usdc base arbitrum\n' +
            'Example: bridge 50 usdt 8453 42161 --slippage 1\n\n' +
            'Supported chains: ethereum (1), polygon (137), arbitrum (42161), optimism (10), base (8453), bsc (56), avalanche (43114)'
          ),
        }
      }

      const amountInput = parts[0]
      const token = parts[1]
      const fromChainInput = parts[2]
      const toChainInput = parts[3]

      // Parse slippage flag
      let slippage = 0.5 // Default 0.5%
      const slippageIndex = parts.indexOf('--slippage')
      if (slippageIndex !== -1 && slippageIndex + 1 < parts.length) {
        slippage = parseFloat(parts[slippageIndex + 1])
      }

      // Parse chain inputs (support both chain ID numbers and chain names)
      const fromChainId = parseChainInput(fromChainInput)
      const toChainId = parseChainInput(toChainInput)

      if (!fromChainId || !toChainId) {
        return {
          success: false,
          error: new Error(
            `Invalid chain input. Use chain ID (e.g., 8453) or name (e.g., base)\n` +
            `Supported: ethereum, polygon, arbitrum, optimism, base, bsc, avalanche`
          ),
        }
      }

      // Validate chains are supported by Stargate
      if (!isChainSupported(fromChainId) || !isChainSupported(toChainId)) {
        return {
          success: false,
          error: new Error(
            `Unsupported chain. From: ${fromChainId}, To: ${toChainId}\n` +
            `Supported chain IDs: 1 (ethereum), 137 (polygon), 42161 (arbitrum), 10 (optimism), 8453 (base), 56 (bsc), 43114 (avalanche)`
          ),
        }
      }

      // Resolve token addresses for both chains
      let fromTokenAddress: string
      let toTokenAddress: string
      let srcDecimals: number

      try {
        fromTokenAddress = resolveTokenAddress(token, fromChainId)
        toTokenAddress = resolveTokenAddress(token, toChainId)
        srcDecimals = getTokenDecimals(token, fromChainId)
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error : new Error(String(error)),
        }
      }

      // Convert decimal amount to base units
      const { parseUnits } = await import('viem')
      const amount = parseUnits(amountInput, srcDecimals).toString()

      // Get bridge quote from Stargate API
      const quoteResponse = await fetch('/api/stargate/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fromChainId,
          toChainId,
          fromTokenAddress,
          toTokenAddress,
          fromAmount: amount,
          fromAddress: context.wallet.address,
          toAddress: context.wallet.address,
          slippage,
        }),
      })

      if (!quoteResponse.ok) {
        const errorData = await quoteResponse.json()
        return {
          success: false,
          error: new Error(errorData.error || 'Failed to get bridge quote'),
        }
      }

      const quoteData = await quoteResponse.json()

      if (!quoteData.success || !quoteData.data) {
        return {
          success: false,
          error: new Error('Invalid quote response from Stargate'),
        }
      }

      const quote = quoteData.data

      // Return bridge request for terminal to handle transaction signing
      const bridgeData: BridgeRequestData = {
        bridgeRequest: true,
        fromToken: token,
        toToken: token, // Stargate bridges same token across chains
        fromChain: fromChainId,
        toChain: toChainId,
        amount,
        amountIn: amount,
        amountOut: quote.toAmount,
        walletAddress: context.wallet.address,
        stargateSteps: quote.stargateSteps,
        slippage,
      }

      return {
        success: true,
        value: bridgeData,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}

/**
 * Parse chain input - accepts both chain ID (number) and chain name (string)
 */
function parseChainInput(input: string): number | undefined {
  // Try parsing as number first
  const chainId = parseInt(input)
  if (!isNaN(chainId)) {
    return chainId
  }

  // Map chain names to IDs
  const chainNameMap: Record<string, number> = {
    ethereum: 1,
    eth: 1,
    polygon: 137,
    matic: 137,
    arbitrum: 42161,
    arb: 42161,
    optimism: 10,
    op: 10,
    base: 8453,
    bsc: 56,
    bnb: 56,
    avalanche: 43114,
    avax: 43114,
  }

  return chainNameMap[input.toLowerCase()]
}
