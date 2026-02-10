/**
 * Uniswap V4 Protocol Command Handlers
 *
 * Execution logic for Uniswap V4 protocol commands (swap, etc.)
 */

import type { CommandHandler } from '@/core'
import type { UniswapV4SwapRequestData, UniswapV4MultiHopSwapRequestData, UniswapV4AddLiquidityRequestData, UniswapV4RemoveLiquidityRequestData, UniswapV4DiscoverRequestData } from './types'
import { prepareSingleHopSwap } from './lib/singleHopSwap'
import { prepareMultiHopSwap } from './lib/multiHopSwap'
import { isNativeToken } from './lib/tokens'
import { getUniversalRouterAddress, getPermit2Address, ERC20_ABI, PERMIT2_ABI, getPositionManagerAddress, POSITION_MANAGER_ABI } from './lib/contracts'
import { readContract, writeContract, getPublicClient } from 'wagmi/actions'
import { config } from '@/lib/wagmi-config'
import { type Address, createPublicClient, http } from 'viem'
import { getUserPositions, findPositionsForPool } from './lib/positionManager'
import { createPoolKey } from './lib/poolUtils'
import { prepareAddLiquidity } from './lib/prepareAddLiquidity'
import { prepareRemoveLiquidityByPool } from './lib/prepareRemoveLiquidity'
import { trackSwap } from '@/lib/tracking/track-client'

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

        // Approve token to Permit2 (exact amount needed)
        const approveTxHash = await writeContract(config, {
          address: tokenIn.address as Address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [permit2Address, amountIn],
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

        // Approve Universal Router via Permit2 (exact amount needed, 30 days expiration)
        const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days
        const permit2ApproveTxHash = await writeContract(config, {
          address: permit2Address,
          abi: PERMIT2_ABI,
          functionName: 'approve',
          args: [
            tokenIn.address as Address,
            universalRouterAddress,
            amountIn, // exact amount needed
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

    // Track swap transaction in database
    if (ctx.walletAddress) {
      trackSwap({
        txHash,
        chainId,
        protocol: 'uniswap-v4',
        command: 'swap',
        txType: 'swap',
        walletAddress: ctx.walletAddress,
        tokenIn: singleHopData.tokenInSymbol,
        tokenOut: singleHopData.tokenOutSymbol,
        amountIn: amountIn.toString(),
        amountOut: singleHopData.params.minAmountOut.toString(),
      })
    }

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

        // Approve token to Permit2 (exact amount needed)
        const approveTxHash = await writeContract(config, {
          address: tokenIn.address as Address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [permit2Address, amountIn],
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

        // Approve Universal Router via Permit2 (exact amount needed, 30 days expiration)
        const expiration = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60 // 30 days
        const permit2ApproveTxHash = await writeContract(config, {
          address: permit2Address,
          abi: PERMIT2_ABI,
          functionName: 'approve',
          args: [
            tokenIn.address as Address,
            universalRouterAddress,
            amountIn, // exact amount needed
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

    // Track multi-hop swap transaction in database
    if (ctx.walletAddress) {
      trackSwap({
        txHash,
        chainId,
        protocol: 'uniswap-v4',
        command: 'multihop',
        txType: 'swap',
        walletAddress: ctx.walletAddress,
        tokenIn: data.tokenInSymbol,
        tokenOut: data.tokenOutSymbol,
        amountIn: amountIn.toString(),
        amountOut: data.params.minAmountOut.toString(),
        route: data.route.map(t => ({ symbol: t.symbol, address: t.address })),
      })
    }

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
 * Add Liquidity Handler
 *
 * Handles adding liquidity to a Uniswap V4 pool
 * NOTE: This is a simplified implementation that shows the structure.
 * Full implementation requires V4 SDK integration for encoding actions.
 */
export const addLiquidityHandler: CommandHandler<UniswapV4AddLiquidityRequestData> = async (data, ctx) => {
  // Show initial message
  ctx.updateStyledHistory([
    [
      { text: 'Uniswap V4 Add Liquidity:', color: '#FF69B4' },
    ],
    [
      { text: `  Pool: ${data.token0Symbol}/${data.token1Symbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Amount0: `, color: '#9ca3af' },
      { text: `${data.amount0Formatted} ${data.token0Symbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Amount1: `, color: '#9ca3af' },
      { text: `${data.amount1Formatted} ${data.token1Symbol}`, color: '#d1d5db' },
    ],
    [{ text: '', color: '#d1d5db' }],
    [
      { text: 'Preparing liquidity transaction...', color: '#fbbf24' },
    ],
  ])

  try {
    const { token0, token1, amount0, amount1, usePermit2, chainId } = data.params
    const positionManagerAddress = getPositionManagerAddress(chainId)

    // Handle approvals
    if (!usePermit2) {
      // Standard ERC20 approvals for both tokens
      for (const [token, amount, symbol] of [
        [token0, amount0, data.token0Symbol],
        [token1, amount1, data.token1Symbol],
      ] as const) {
        if (isNativeToken(token.address)) continue

        // Check allowance
        const allowance = await readContract(config, {
          address: token.address as Address,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [ctx.walletAddress as Address, positionManagerAddress],
        }) as bigint

        if (allowance < amount) {
          ctx.updateStyledHistory([
            [
              { text: 'Uniswap V4 Add Liquidity:', color: '#FF69B4' },
            ],
            [
              { text: `  Approving ${symbol}...`, color: '#fbbf24' },
            ],
          ])

          const approveTxHash = await writeContract(config, {
            address: token.address as Address,
            abi: ERC20_ABI,
            functionName: 'approve',
            args: [positionManagerAddress, amount],
          })

          const { waitForTransactionReceipt } = await import('wagmi/actions')
          await waitForTransactionReceipt(config, { hash: approveTxHash })

          ctx.updateStyledHistory([
            [
              { text: `  ${symbol} approval confirmed!`, color: '#10b981' },
            ],
          ])
        }
      }
    }

    // Prepare transaction using V4 SDK
    ctx.updateStyledHistory([
      [
        { text: 'Uniswap V4 Add Liquidity:', color: '#FF69B4' },
      ],
      [
        { text: `  Pool: ${data.token0Symbol}/${data.token1Symbol}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: 'Preparing position transaction...', color: '#fbbf24' },
      ],
    ])

    // Get public client for pool state fetching
    const publicClient = getPublicClient(config, { chainId: chainId as any })

    // Prepare add liquidity transaction
    const tx = await prepareAddLiquidity(data.params, publicClient as any)

    ctx.updateStyledHistory([
      [
        { text: 'Uniswap V4 Add Liquidity:', color: '#FF69B4' },
      ],
      [
        { text: `  Pool: ${data.token0Symbol}/${data.token1Symbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount0: `, color: '#9ca3af' },
        { text: `${data.amount0Formatted} ${data.token0Symbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount1: `, color: '#9ca3af' },
        { text: `${data.amount1Formatted} ${data.token1Symbol}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: 'Please sign the transaction in your wallet...', color: '#fbbf24' },
      ],
    ])

    // Send transaction
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
        { text: 'Transaction submitted!', color: '#10b981' },
      ],
      [
        { text: `  Pool: ${data.token0Symbol}/${data.token1Symbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Tx: ${txLink}`, color: '#60a5fa' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: 'Waiting for confirmation...', color: '#fbbf24' },
      ],
    ])

    // Wait for transaction receipt
    const { waitForTransactionReceipt } = await import('wagmi/actions')
    await waitForTransactionReceipt(config, { hash: txHash })

    ctx.updateStyledHistory([
      [
        { text: 'Liquidity added successfully!', color: '#10b981' },
      ],
      [
        { text: `  Pool: ${data.token0Symbol}/${data.token1Symbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount0: `, color: '#9ca3af' },
        { text: `${data.amount0Formatted} ${data.token0Symbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount1: `, color: '#9ca3af' },
        { text: `${data.amount1Formatted} ${data.token1Symbol}`, color: '#d1d5db' },
      ],
      [
        { text: `  Tx: ${txLink}`, color: '#60a5fa' },
      ],
    ])

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    const errorStack = error instanceof Error ? error.stack : ''

    // Provide helpful context for common errors
    let userMessage = errorMsg
    if (errorMsg.includes('PRICE_BOUNDS')) {
      userMessage = `Pool price validation failed. This likely means:\\n` +
        `  1. The pool doesn't exist on Uniswap V4 yet\\n` +
        `  2. The pool is not initialized (sqrtPriceX96 = 0)\\n` +
        `  3. Your price range is invalid\\n\\n` +
        `Try a different token pair or check if the pool exists on V4.\\n` +
        `Original error: ${errorMsg}`
    } else if (errorMsg.includes('does not exist')) {
      userMessage = `Pool not found on Uniswap V4.\\n` +
        `This ${data.token0Symbol}/${data.token1Symbol} pool may only exist on V3.\\n` +
        `Try a different token pair or use a V3 interface.`
    }

    ctx.updateStyledHistory([
      [
        { text: 'Add Liquidity Failed', color: '#ef4444' },
      ],
      [
        { text: userMessage, color: '#fca5a5' },
      ],
    ])

    // Log full error for debugging
    console.error('[Uniswap V4 Add Liquidity] Error:', error)
    console.error('[Uniswap V4 Add Liquidity] Stack:', errorStack)
    console.error('[Uniswap V4 Add Liquidity] Params:', data.params)
  }
}

/**
 * Remove Liquidity Handler
 *
 * Handles removing liquidity from a Uniswap V4 position
 * NOTE: This is a simplified implementation that shows the structure.
 * Full implementation requires V4 SDK integration for encoding actions.
 */
export const removeLiquidityHandler: CommandHandler<UniswapV4RemoveLiquidityRequestData> = async (data, ctx) => {
  // Show initial message
  ctx.updateStyledHistory([
    [
      { text: 'Uniswap V4 Remove Liquidity:', color: '#FF69B4' },
    ],
    [
      { text: `  Pool: ${data.token0Symbol}/${data.token1Symbol}`, color: '#d1d5db' },
    ],
    [
      { text: `  Percentage: `, color: '#9ca3af' },
      { text: `${data.liquidityPercentage}%`, color: '#d1d5db' },
    ],
    [{ text: '', color: '#d1d5db' }],
    [
      { text: 'Finding your position...', color: '#fbbf24' },
    ],
  ])

  try {
    const { position, liquidityPercentage, burnToken, chainId } = data.params
    const { token0, token1, fee } = position

    // Create a public client to query positions
    const publicClient = createPublicClient({
      chain: {
        id: chainId,
        name: 'Current Chain',
        nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [''] }, // Would use actual RPC URL
          public: { http: [''] },
        },
      },
      transport: http(),
    })

    // Get user's positions for this pool
    // NOTE: In production, this would query the actual positions
    ctx.updateStyledHistory([
      [
        { text: 'Uniswap V4 Remove Liquidity:', color: '#FF69B4' },
      ],
      [
        { text: '  ⚠️  Implementation Note:', color: '#fbbf24' },
      ],
      [
        { text: '  Full remove liquidity requires V4 SDK integration', color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: '  The transaction preparation would involve:', color: '#9ca3af' },
      ],
      [
        { text: '    1. Querying user positions via PositionManager', color: '#d1d5db' },
      ],
      [
        { text: '    2. Finding position tokenId for specified pool', color: '#d1d5db' },
      ],
      [
        { text: '    3. Calculating liquidity amount to remove', color: '#d1d5db' },
      ],
      [
        { text: '    4. Encoding DECREASE_LIQUIDITY action', color: '#d1d5db' },
      ],
      [
        { text: '    5. Encoding TAKE_PAIR for token collection', color: '#d1d5db' },
      ],
      [
        { text: '    6. Optionally encoding BURN_POSITION', color: '#d1d5db' },
      ],
      [
        { text: '    7. Calling PositionManager.modifyLiquidities()', color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: '  Status: Handler structure complete, awaiting SDK integration', color: '#10b981' },
      ],
    ])

    // TODO: Implement actual transaction preparation using V4 SDK
    // const positions = await getUserPositions(ctx.walletAddress, chainId, publicClient)
    // const poolPositions = findPositionsForPool(positions, token0, token1, fee)
    // if (poolPositions.length === 0) throw new Error('No position found for this pool')
    // const position = poolPositions[0]
    // const tx = prepareRemoveLiquidity({ tokenId: position.tokenId, percentage, burnToken, ...})
    // const txHash = await sendTransaction(config, { to: tx.to, data: tx.data })
    // await waitForTransactionReceipt(config, { hash: txHash })

  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    ctx.updateStyledHistory([
      [
        { text: 'Remove Liquidity Failed', color: '#ef4444' },
      ],
      [
        { text: errorMsg, color: '#fca5a5' },
      ],
    ])
    console.error('[Uniswap V4 Remove Liquidity] Error:', error)
  }
}

/**
 * Liquidity Handler (unified router for add/remove)
 *
 * Routes to appropriate liquidity handler based on request type
 */
export const liquidityHandler: CommandHandler<UniswapV4AddLiquidityRequestData | UniswapV4RemoveLiquidityRequestData> = async (data, ctx) => {
  // Detect request type and route to appropriate handler
  if ('uniswapV4AddLiquidityRequest' in data && data.uniswapV4AddLiquidityRequest) {
    return addLiquidityHandler(data as UniswapV4AddLiquidityRequestData, ctx)
  }

  if ('uniswapV4RemoveLiquidityRequest' in data && data.uniswapV4RemoveLiquidityRequest) {
    return removeLiquidityHandler(data as UniswapV4RemoveLiquidityRequestData, ctx)
  }

  // Fallback error
  ctx.updateStyledHistory([
    [
      { text: 'Liquidity Operation Failed', color: '#ef4444' },
    ],
    [
      { text: 'Invalid liquidity request type', color: '#fca5a5' },
    ],
  ])
}

/**
 * Handler Registry for Uniswap V4 Protocol
 */
/**
 * Discover Pools Handler
 *
 * Scans for existing V4 pools
 */
export const discoverHandler: CommandHandler<UniswapV4DiscoverRequestData> = async (data, ctx) => {
  const { findExistingPoolForPair, discoverPoolsForPairs } = await import('./lib/discoverPools')

  ctx.updateStyledHistory([[{ text: 'Discovering V4 Pools...', color: '#FF69B4' }]])

  try {
    const publicClient = getPublicClient(config, { chainId: data.chainId as any })
    if (!publicClient) {
      throw new Error('Failed to get public client')
    }

    // Single pair scan
    if (data.token0 && data.token1) {
      ctx.updateStyledHistory([
        [{ text: `Scanning ${data.token0.symbol}/${data.token1.symbol}...`, color: '#fbbf24' }],
      ])

      const result = await findExistingPoolForPair(
        data.token0,
        data.token1,
        data.chainId,
        publicClient as any
      )

      if (result) {
        ctx.updateStyledHistory([
          [{ text: '✓ Pool Found!', color: '#10b981' }],
          [{ text: `  ${result.token0Symbol}/${result.token1Symbol}`, color: '#d1d5db' }],
          [{ text: `  Fee: ${result.fee / 10000}% (${result.fee})`, color: '#d1d5db' }],
          [{ text: `  Pool ID: ${result.poolId}`, color: '#9ca3af' }],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: `You can now add liquidity with:`, color: '#fbbf24' },
          ],
          [
            {
              text: `  liquidity add ${result.token0Symbol.toLowerCase()} ${result.token1Symbol.toLowerCase()} <amount0> <amount1> --fee ${result.fee}`,
              color: '#d1d5db',
            },
          ],
        ])
      } else {
        ctx.updateStyledHistory([
          [{ text: '✗ No pool found', color: '#ef4444' }],
          [{ text: `  ${data.token0.symbol}/${data.token1.symbol} has no V4 pools yet`, color: '#9ca3af' }],
          [{ text: `  This pair may only exist on V3`, color: '#9ca3af' }],
        ])
      }

      return
    }

    // Multiple pairs scan
    if (data.pairs) {
      ctx.updateStyledHistory([
        [{ text: `Scanning ${data.pairs.length} token pairs...`, color: '#fbbf24' }],
        [{ text: 'This may take a minute...', color: '#9ca3af' }],
        [{ text: '', color: '#d1d5db' }],
      ])

      const results = await discoverPoolsForPairs(data.pairs, data.chainId, publicClient as any)

      if (results.length === 0) {
        ctx.updateStyledHistory([
          [{ text: '✗ No V4 pools found', color: '#ef4444' }],
          [{ text: '', color: '#d1d5db' }],
          [{ text: 'Uniswap V4 launched on January 31, 2025.', color: '#9ca3af' }],
          [{ text: 'Liquidity is still migrating from V3 to V4.', color: '#9ca3af' }],
          [{ text: '', color: '#d1d5db' }],
          [{ text: 'Try these options:', color: '#fbbf24' }],
          [{ text: '  1. Use V3 on app.uniswap.org', color: '#d1d5db' }],
          [{ text: '  2. Try Ethereum mainnet (more V4 liquidity)', color: '#d1d5db' }],
          [{ text: '  3. Check back later as pools are created', color: '#d1d5db' }],
        ])
      } else {
        ctx.updateStyledHistory([
          [{ text: `✓ Found ${results.length} V4 pool(s)!`, color: '#10b981' }],
          [{ text: '', color: '#d1d5db' }],
        ])

        for (const pool of results) {
          ctx.updateStyledHistory([
            [{ text: `${pool.token0Symbol}/${pool.token1Symbol}`, color: '#FF69B4' }],
            [{ text: `  Fee: ${pool.fee / 10000}% (${pool.fee})`, color: '#d1d5db' }],
            [{ text: `  Pool ID: ${pool.poolId.slice(0, 20)}...`, color: '#9ca3af' }],
            [{ text: `  Command: liquidity add ${pool.token0Symbol.toLowerCase()} ${pool.token1Symbol.toLowerCase()} <amt0> <amt1> --fee ${pool.fee}`, color: '#9ca3af' }],
            [{ text: '', color: '#d1d5db' }],
          ])
        }
      }
    }
  } catch (error) {
    console.error('[Discover Handler] Error:', error)
    ctx.updateStyledHistory([
      [{ text: 'Pool Discovery Failed', color: '#ef4444' }],
      [
        {
          text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          color: '#9ca3af',
        },
      ],
    ])
  }
}

export const uniswapV4Handlers = {
  swap: swapHandler,
  multihop: multiHopSwapHandler,
  liquidity: liquidityHandler,
  discover: discoverHandler,
}
