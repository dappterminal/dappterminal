/**
 * Uniswap V4 Protocol Command Handlers
 *
 * Execution logic for Uniswap V4 protocol commands (swap, etc.)
 */

import type { CommandHandler } from '@/core'
import type { UniswapV4SwapRequestData } from './types'
import { prepareSingleHopSwap } from './lib/singleHopSwap'

/**
 * Swap Command Handler
 *
 * Handles single-hop swap transactions via Uniswap V4 with:
 * - Transaction preparation using V4 Planner
 * - Wallet signing
 * - Transaction submission
 * - Progress tracking
 */
export const swapHandler: CommandHandler<UniswapV4SwapRequestData> = async (data, ctx) => {
  // Show initial message with styled output
  ctx.updateStyledHistory([
    [
      { text: 'Uniswap V4 Swap', color: '#FF69B4', bold: true },
      { text: ':', color: '#d1d5db' },
    ],
    [
      { text: `  ${data.tokenInSymbol} → ${data.tokenOutSymbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Amount: `, color: '#9ca3af' },
      { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Min Receive: `, color: '#9ca3af' },
      { text: `${data.minAmountOutFormatted} ${data.tokenOutSymbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Slippage: `, color: '#9ca3af' },
      { text: `${data.slippageBps / 100}%`, color: '#d1d5db' },
    ],
    [
      { text: `  Deadline: `, color: '#9ca3af' },
      { text: `${data.deadlineSeconds}s`, color: '#d1d5db' },
    ],
    [{ text: '', color: '#d1d5db' }],
    [
      { text: 'Preparing transaction...', color: '#fbbf24' },
    ],
  ])

  // Execute Uniswap V4 swap
  try {
    // Prepare transaction using V4 Planner
    const tx = prepareSingleHopSwap(data.params)

    ctx.updateStyledHistory([
      [
        { text: 'Uniswap V4 Swap', color: '#FF69B4', bold: true },
        { text: ':', color: '#d1d5db' },
      ],
      [
        { text: `  ${data.tokenInSymbol} → ${data.tokenOutSymbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount: `, color: '#9ca3af' },
        { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Min Receive: `, color: '#9ca3af' },
        { text: `${data.minAmountOutFormatted} ${data.tokenOutSymbol}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: 'Please sign the transaction in your wallet...', color: '#fbbf24' },
      ],
    ])

    // Send transaction via wagmi
    const { sendTransaction } = await import('wagmi/actions')
    const { config } = await import('@/lib/wagmi-config')

    const txHash = await sendTransaction(config, {
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })

    // Get block explorer URL
    const chainId = data.params.chainId
    const explorerUrls: Record<number, string> = {
      1: 'https://etherscan.io',
      8453: 'https://basescan.org',
      42161: 'https://arbiscan.io',
      10: 'https://optimistic.etherscan.io',
    }
    const explorerUrl = explorerUrls[chainId] || 'https://etherscan.io'
    const txLink = `${explorerUrl}/tx/${txHash}`

    ctx.updateStyledHistory([
      [
        { text: 'Swap transaction submitted!', color: '#10b981', bold: true },
      ],
      [
        { text: `  ${data.tokenInSymbol} → ${data.tokenOutSymbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount: `, color: '#9ca3af' },
        { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Min Receive: `, color: '#9ca3af' },
        { text: `${data.minAmountOutFormatted} ${data.tokenOutSymbol}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: 'Transaction Hash: ', color: '#9ca3af' },
        { text: txHash, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: 'View on Explorer:', color: '#9ca3af' },
      ],
    ])

    ctx.addHistoryLinks([{ text: txLink, url: txLink }])
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    ctx.updateStyledHistory([
      [
        { text: 'Swap failed: ', color: '#ef4444', bold: true },
        { text: errorMsg, color: '#fca5a5' },
      ],
    ])
    console.error('[Uniswap V4 Swap] Error:', error)
  }
}

/**
 * Handler Registry for Uniswap V4 Protocol
 */
export const uniswapV4Handlers = {
  swap: swapHandler,
}
