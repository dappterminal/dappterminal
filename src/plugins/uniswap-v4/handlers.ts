/**
 * Uniswap V4 Protocol Command Handlers
 *
 * Execution logic for Uniswap V4 protocol commands (swap, etc.)
 */

import type { CommandHandler } from '@/core'
import type { UniswapV4SwapRequestData, UniswapV4MultiHopSwapRequestData } from './types'
import { prepareSingleHopSwap } from './lib/singleHopSwap'
import { prepareMultiHopSwap } from './lib/multiHopSwap'
import { isNativeToken } from './lib/tokens'
import { getUniversalRouterAddress, getPermit2Address, ERC20_ABI, PERMIT2_ABI } from './lib/contracts'
import { readContract, writeContract } from 'wagmi/actions'
import { config } from '@/lib/wagmi-config'
import { type Address } from 'viem'

/**
 * Swap Command Handler
 *
 * Handles both single-hop and multi-hop swap transactions via Uniswap V4
 * - Transaction preparation using V4 Planner
 * - Wallet signing
 * - Transaction submission
 * - Progress tracking
 */
export const swapHandler: CommandHandler<UniswapV4SwapRequestData | UniswapV4MultiHopSwapRequestData> = async (data, ctx) => {
  // Detect if this is a multi-hop swap
  const isMultiHop = 'uniswapV4MultiHopSwapRequest' in data && data.uniswapV4MultiHopSwapRequest

  if (isMultiHop) {
    // Route to multi-hop handler
    return multiHopSwapHandler(data as UniswapV4MultiHopSwapRequestData, ctx)
  }

  // Single-hop swap logic
  const singleHopData = data as UniswapV4SwapRequestData

  // Show initial message with styled output
  ctx.updateStyledHistory([
    [
      { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
    ],
    [
      { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Amount: `, color: '#9ca3af' },
      { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Min Receive: `, color: '#9ca3af' },
      { text: `${singleHopData.minAmountOutFormatted} ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Slippage: `, color: '#9ca3af' },
      { text: `${singleHopData.slippageBps / 100}%`, color: '#d1d5db' },
    ],
    [
      { text: `  Deadline: `, color: '#9ca3af' },
      { text: `${singleHopData.deadlineSeconds}s`, color: '#d1d5db' },
    ],
    [{ text: '', color: '#d1d5db' }],
    [
      { text: 'Preparing transaction...', color: '#fbbf24' },
    ],
  ])

  // Execute Uniswap V4 swap
  try {
    const { tokenIn, amountIn, chainId } = singleHopData.params
    const universalRouterAddress = getUniversalRouterAddress(chainId)
    const permit2Address = getPermit2Address(chainId)

    // Check if we need approval (skip for native ETH)
    if (!isNativeToken(tokenIn.address)) {
      ctx.updateStyledHistory([
        [
          { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
        ],
        [
          { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
        ],
        [
          { text: `  Amount: `, color: '#9ca3af' },
          { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
        ],
        [{ text: '', color: '#d1d5db' }],
        [
          { text: 'Checking token allowance...', color: '#fbbf24' },
        ],
      ])

      // Step 1: Check ERC20 allowance to Permit2
      const erc20Allowance = await readContract(config, {
        address: tokenIn.address as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ctx.walletAddress as Address, permit2Address],
      }) as bigint

      // If ERC20 allowance to Permit2 is insufficient, request approval
      if (erc20Allowance < amountIn) {
        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Step 1/2: Approving token to Permit2...', color: '#fbbf24' },
          ],
        ])

        // Approve token to Permit2 (unlimited)
        const approveTxHash = await writeContract(config, {
          address: tokenIn.address as Address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [permit2Address, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
        })

        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Waiting for Permit2 approval confirmation...', color: '#fbbf24' },
          ],
        ])

        // Wait for approval transaction to be mined
        const { waitForTransactionReceipt } = await import('wagmi/actions')
        await waitForTransactionReceipt(config, { hash: approveTxHash })

        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Permit2 approval confirmed!', color: '#10b981' },
          ],
        ])
      }

      // Step 2: Check Permit2 allowance to Universal Router
      const permit2Allowance = await readContract(config, {
        address: permit2Address,
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        args: [ctx.walletAddress as Address, tokenIn.address as Address, universalRouterAddress],
      }) as readonly [bigint, number, number]

      const [permit2Amount] = permit2Allowance

      // If Permit2 allowance to Universal Router is insufficient, request approval
      if (permit2Amount < amountIn) {
        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Step 2/2: Approving Permit2 to Universal Router...', color: '#fbbf24' },
          ],
        ])

        // Approve Universal Router via Permit2 (max uint160, 30 days expiration)
        const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days
        const permit2ApproveTxHash = await writeContract(config, {
          address: permit2Address,
          abi: PERMIT2_ABI,
          functionName: 'approve',
          args: [
            tokenIn.address as Address,
            universalRouterAddress,
            BigInt('0xffffffffffffffffffffffffffffffffffffffff'), // max uint160
            expiration,
          ],
        })

        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Waiting for final approval confirmation...', color: '#fbbf24' },
          ],
        ])

        const { waitForTransactionReceipt } = await import('wagmi/actions')
        await waitForTransactionReceipt(config, { hash: permit2ApproveTxHash })

        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'All approvals confirmed!', color: '#10b981' },
          ],
        ])
      }
    }

    // Prepare transaction using V4 Planner
    const tx = prepareSingleHopSwap(singleHopData.params)

    ctx.updateStyledHistory([
      [
        { text: 'Uniswap V4 Swap:', color: '#FF69B4' },
      ],
      [
        { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount: `, color: '#9ca3af' },
        { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Min Receive: `, color: '#9ca3af' },
        { text: `${singleHopData.minAmountOutFormatted} ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: 'Please sign the swap transaction in your wallet...', color: '#fbbf24' },
      ],
    ])

    // Send transaction via wagmi
    const { sendTransaction } = await import('wagmi/actions')

    const txHash = await sendTransaction(config, {
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })

    // Get block explorer URL
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
        { text: 'Swap transaction submitted!', color: '#10b981' },
      ],
      [
        { text: `  ${singleHopData.tokenInSymbol} → ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount: `, color: '#9ca3af' },
        { text: `${singleHopData.amountInFormatted} ${singleHopData.tokenInSymbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Min Receive: `, color: '#9ca3af' },
        { text: `${singleHopData.minAmountOutFormatted} ${singleHopData.tokenOutSymbol}`, color: '#d1d5db' },
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
        { text: 'Swap failed: ', color: '#ef4444' },
        { text: errorMsg, color: '#fca5a5' },
      ],
    ])
    console.error('[Uniswap V4 Swap] Error:', error)
  }
}

/**
 * Multi-Hop Swap Command Handler
 *
 * Handles multi-hop swap transactions via Uniswap V4 with:
 * - Transaction preparation using V4 Planner
 * - Wallet signing
 * - Transaction submission
 * - Progress tracking
 */
export const multiHopSwapHandler: CommandHandler<UniswapV4MultiHopSwapRequestData> = async (data, ctx) => {
  const routeStr = data.route.map(t => t.symbol).join(' → ')

  // Show initial message with styled output
  ctx.updateStyledHistory([
    [
      { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
    ],
    [
      { text: `  Route: ${routeStr}`, color: '#d1d5db' },
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

  // Execute Uniswap V4 multi-hop swap
  try {
    const { route, amountIn, chainId } = data.params
    const tokenIn = route[0]
    const universalRouterAddress = getUniversalRouterAddress(chainId)
    const permit2Address = getPermit2Address(chainId)

    // Check if we need approval (skip for native ETH)
    if (!isNativeToken(tokenIn.address)) {
      ctx.updateStyledHistory([
        [
          { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
        ],
        [
          { text: `  Route: ${routeStr}`, color: '#d1d5db' },
        ],
        [
          { text: `  Amount: `, color: '#9ca3af' },
          { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
        ],
        [{ text: '', color: '#d1d5db' }],
        [
          { text: 'Checking token allowance...', color: '#fbbf24' },
        ],
      ])

      // Step 1: Check ERC20 allowance to Permit2
      const erc20Allowance = await readContract(config, {
        address: tokenIn.address as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ctx.walletAddress as Address, permit2Address],
      }) as bigint

      // If ERC20 allowance to Permit2 is insufficient, request approval
      if (erc20Allowance < amountIn) {
        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  Route: ${routeStr}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Step 1/2: Approving token to Permit2...', color: '#fbbf24' },
          ],
        ])

        // Approve token to Permit2 (unlimited)
        const approveTxHash = await writeContract(config, {
          address: tokenIn.address as Address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [permit2Address, BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff')],
        })

        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  Route: ${routeStr}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Waiting for Permit2 approval confirmation...', color: '#fbbf24' },
          ],
        ])

        // Wait for approval transaction to be mined
        const { waitForTransactionReceipt } = await import('wagmi/actions')
        await waitForTransactionReceipt(config, { hash: approveTxHash })

        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  Route: ${routeStr}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Permit2 approval confirmed!', color: '#10b981' },
          ],
        ])
      }

      // Step 2: Check Permit2 allowance to Universal Router
      const permit2Allowance = await readContract(config, {
        address: permit2Address,
        abi: PERMIT2_ABI,
        functionName: 'allowance',
        args: [ctx.walletAddress as Address, tokenIn.address as Address, universalRouterAddress],
      }) as readonly [bigint, number, number]

      const [permit2Amount] = permit2Allowance

      // If Permit2 allowance to Universal Router is insufficient, request approval
      if (permit2Amount < amountIn) {
        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  Route: ${routeStr}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Step 2/2: Approving Permit2 to Universal Router...', color: '#fbbf24' },
          ],
        ])

        // Approve Universal Router via Permit2 (max uint160, 30 days expiration)
        const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days
        const permit2ApproveTxHash = await writeContract(config, {
          address: permit2Address,
          abi: PERMIT2_ABI,
          functionName: 'approve',
          args: [
            tokenIn.address as Address,
            universalRouterAddress,
            BigInt('0xffffffffffffffffffffffffffffffffffffffff'), // max uint160
            expiration,
          ],
        })

        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  Route: ${routeStr}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Waiting for final approval confirmation...', color: '#fbbf24' },
          ],
        ])

        const { waitForTransactionReceipt } = await import('wagmi/actions')
        await waitForTransactionReceipt(config, { hash: permit2ApproveTxHash })

        ctx.updateStyledHistory([
          [
            { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
          ],
          [
            { text: `  Route: ${routeStr}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${data.amountInFormatted} ${data.tokenInSymbol}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'All approvals confirmed!', color: '#10b981' },
          ],
        ])
      }
    }

    // Prepare transaction using V4 Planner
    const tx = prepareMultiHopSwap(data.params)

    ctx.updateStyledHistory([
      [
        { text: 'Uniswap V4 Multi-Hop Swap:', color: '#FF69B4' },
      ],
      [
        { text: `  Route: ${routeStr}`, color: '#d1d5db' },
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
        { text: 'Please sign the swap transaction in your wallet...', color: '#fbbf24' },
      ],
    ])

    // Send transaction via wagmi
    const { sendTransaction } = await import('wagmi/actions')

    const txHash = await sendTransaction(config, {
      to: tx.to,
      data: tx.data,
      value: tx.value,
    })

    // Get block explorer URL
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
        { text: 'Multi-hop swap transaction submitted!', color: '#10b981' },
      ],
      [
        { text: `  Route: ${routeStr}`, color: '#d1d5db' },
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
        { text: 'Multi-hop swap failed: ', color: '#ef4444' },
        { text: errorMsg, color: '#fca5a5' },
      ],
    ])
    console.error('[Uniswap V4 Multi-Hop Swap] Error:', error)
  }
}

/**
 * Handler Registry for Uniswap V4 Protocol
 */
export const uniswapV4Handlers = {
  swap: swapHandler,
  multihop: multiHopSwapHandler,
}
