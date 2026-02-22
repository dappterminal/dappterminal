/**
 * Stargate Protocol Command Handlers
 *
 * Execution logic for Stargate protocol commands (bridge, etc.)
 */

import type { CommandHandler } from '@/core'
import { getTxUrl } from '@/lib/explorers'
import { trackSwap } from '@/lib/tracking/track-client'

/**
 * Stargate Transaction Step
 */
interface StargateStep {
  type: string
  transaction?: {
    to: string
    data: string
    value?: string
    gas?: string
    gasPrice?: string
  }
}

/**
 * Bridge Handler Data
 */
interface BridgeRequestData {
  bridgeRequest: boolean
  fromToken: string
  toToken: string
  fromChain: number
  toChain: number
  amount: string
  amountIn: string
  amountOut: string
  walletAddress: string
  stargateSteps: StargateStep[]
  slippage: number
}

/**
 * Bridge Command Handler
 *
 * Handles cross-chain bridge transactions via Stargate with:
 * - Multi-step execution (approval + bridge)
 * - Progress updates for each step
 * - Transaction tracking
 */
export const bridgeHandler: CommandHandler<BridgeRequestData> = async (data, ctx) => {
  // Get chain names for display
  const chainNames: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    137: 'Polygon',
    8453: 'Base',
    42161: 'Arbitrum',
    56: 'BSC',
    43114: 'Avalanche',
  }

  const fromChainName = chainNames[data.fromChain] || `Chain ${data.fromChain}`
  const toChainName = chainNames[data.toChain] || `Chain ${data.toChain}`

  const formatQuote = () => [
    `🌉 Bridge Quote:`,
    `  ${fromChainName} → ${toChainName}`,
    `  Token: ${data.fromToken.toUpperCase()}`,
    `  Amount: ${data.amountIn}`,
    ``,
  ]

  try {
    // Initial state: checking steps
    ctx.updateHistory([...formatQuote(), `⏳ Preparing bridge transaction...`])

    const { sendTransaction } = await import('wagmi/actions')
    const { config } = await import('@/lib/wagmi-config')

    const stargateSteps = data.stargateSteps || []
    const txHashes: string[] = []

    if (!stargateSteps.length) {
      throw new Error('No bridge steps received from Stargate')
    }

    // Execute each step sequentially (approval + bridge)
    for (let i = 0; i < stargateSteps.length; i++) {
      const step = stargateSteps[i]
      const stepNumber = i + 1

      ctx.updateHistory([
        ...formatQuote(),
        `⏳ Executing step ${stepNumber}/${stargateSteps.length}: ${step.type}...`,
      ])

      if (!step.transaction) {
        console.warn(`Step ${stepNumber} has no transaction data, skipping`)
        continue
      }

      // Send the transaction
      const hash = await sendTransaction(config, {
        to: step.transaction.to as `0x${string}`,
        data: step.transaction.data as `0x${string}`,
        value: BigInt(step.transaction.value || '0'),
        gas: step.transaction.gas ? BigInt(step.transaction.gas) : undefined,
        gasPrice: step.transaction.gasPrice ? BigInt(step.transaction.gasPrice) : undefined,
      })

      txHashes.push(hash)

      ctx.updateHistory([
        ...formatQuote(),
        `✅ Step ${stepNumber}/${stargateSteps.length} complete!`,
        `  ${step.type}`,
        `  Tx Hash: ${hash}`,
        ``,
        ...(stepNumber < stargateSteps.length
          ? [`⏳ Executing step ${stepNumber + 1}/${stargateSteps.length}...`]
          : []),
      ])
    }

    // Track bridge transaction in database
    if (txHashes.length > 0) {
      // Track the main bridge transaction (last tx is typically the bridge)
      const bridgeTxHash = txHashes[txHashes.length - 1]
      trackSwap({
        txHash: bridgeTxHash,
        chainId: data.fromChain,
        protocol: 'stargate',
        command: 'bridge',
        txType: 'bridge',
        walletAddress: data.walletAddress,
        tokenIn: data.fromToken,
        tokenOut: data.toToken,
        amountIn: data.amount,
        amountOut: data.amountOut,
        route: {
          fromChain: data.fromChain,
          toChain: data.toChain,
          steps: stargateSteps.map(s => s.type),
          txHashes,
        },
      })
    }

    // Update with final success
    ctx.updateHistory([
      `✅ Bridge executed successfully!`,
      `  ${fromChainName} → ${toChainName}`,
      `  Token: ${data.fromToken.toUpperCase()}`,
      `  Amount: ${data.amountIn}`,
      ``,
      `Transaction Hashes:`,
      ...txHashes.map((hash, idx) => `  ${idx + 1}. ${hash}`),
    ])

    // Add explorer links for all transactions (chain explorer + LayerZero Scan)
    const links = txHashes.flatMap((hash, idx) => [
      {
        text: `View Transaction ${idx + 1} on ${fromChainName} Explorer`,
        url: getTxUrl(data.fromChain, hash),
      },
      {
        text: `View Transaction ${idx + 1} on LayerZero Scan`,
        url: `https://layerzeroscan.com/tx/${hash}`,
      },
    ])
    ctx.addHistoryLinks(links)
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    ctx.updateHistory([`❌ Bridge failed: ${errorMsg}`])
  }
}

/**
 * Handler Registry for Stargate Protocol
 */
export const stargateHandlers = {
  bridge: bridgeHandler,
}
