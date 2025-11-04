/**
 * Aave V3 Protocol Command Handlers
 *
 * Execution logic for Aave V3 protocol commands (supply, etc.)
 */

import type { CommandHandler } from '@/core'
import type { AaveV3SupplyRequestData } from './types'
import { POOL_ABI, WETH_GATEWAY_ABI, ERC20_ABI, getPoolAddress, getWETHGatewayAddress } from '@/lib/aave/contracts'
import { readContract, writeContract } from 'wagmi/actions'
import { config } from '@/lib/wagmi-config'
import { type Address, parseUnits } from 'viem'

/**
 * Supply Command Handler
 *
 * Handles supply transactions to Aave V3 Pool
 * - Checks and handles token approvals
 * - Executes supply transaction
 * - Optionally enables asset as collateral
 * - Progress tracking and UI updates
 */
export const supplyHandler: CommandHandler<AaveV3SupplyRequestData> = async (data, ctx) => {
  const { params } = data

  // Show initial message with styled output
  ctx.updateStyledHistory([
    [
      { text: 'Aave V3 Supply:', color: '#00d4aa' },
    ],
    [
      { text: `  Asset: `, color: '#9ca3af' },
      { text: `${params.asset}`, color: '#d1d5db' },
    ],
    [
      { text: `  Amount: `, color: '#9ca3af' },
      { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
    ],
    [
      { text: `  Collateral: `, color: '#9ca3af' },
      { text: params.useAsCollateral ? 'Enabled' : 'Disabled', color: params.useAsCollateral ? '#10b981' : '#6b7280' },
    ],
    [{ text: '', color: '#d1d5db' }],
    [
      { text: 'Preparing transaction...', color: '#fbbf24' },
    ],
  ])

  try {
    const poolAddress = getPoolAddress(params.chainId)

    if (!poolAddress) {
      throw new Error(`Aave V3 Pool not supported on chain ${params.chainId}`)
    }

    // Parse amount with token decimals
    const amount = parseUnits(params.amount, params.decimals)

    // Check if we need approval (skip for native token)
    if (!params.isNative) {
      ctx.updateStyledHistory([
        [
          { text: 'Aave V3 Supply:', color: '#00d4aa' },
        ],
        [
          { text: `  Asset: `, color: '#9ca3af' },
          { text: `${params.asset}`, color: '#d1d5db' },
        ],
        [
          { text: `  Amount: `, color: '#9ca3af' },
          { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
        ],
        [{ text: '', color: '#d1d5db' }],
        [
          { text: 'Checking token allowance...', color: '#fbbf24' },
        ],
      ])

      // Check ERC20 allowance to Pool
      const allowance = await readContract(config, {
        address: params.underlyingTokenAddress as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [ctx.walletAddress as Address, poolAddress],
      }) as bigint

      // If allowance is insufficient, request approval
      if (allowance < amount) {
        ctx.updateStyledHistory([
          [
            { text: 'Aave V3 Supply:', color: '#00d4aa' },
          ],
          [
            { text: `  Asset: `, color: '#9ca3af' },
            { text: `${params.asset}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: `Step 1/${params.useAsCollateral ? 3 : 2}: Approving ${params.asset} to Pool...`, color: '#fbbf24' },
          ],
        ])

        // Approve token to Pool
        const approveTxHash = await writeContract(config, {
          address: params.underlyingTokenAddress as Address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [poolAddress, amount],
        })

        ctx.updateStyledHistory([
          [
            { text: 'Aave V3 Supply:', color: '#00d4aa' },
          ],
          [
            { text: `  Asset: `, color: '#9ca3af' },
            { text: `${params.asset}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: 'Waiting for approval confirmation...', color: '#fbbf24' },
          ],
        ])

        // Wait for approval transaction to be mined
        const { waitForTransactionReceipt } = await import('wagmi/actions')
        await waitForTransactionReceipt(config, { hash: approveTxHash })

        ctx.updateStyledHistory([
          [
            { text: 'Aave V3 Supply:', color: '#00d4aa' },
          ],
          [
            { text: `  Asset: `, color: '#9ca3af' },
            { text: `${params.asset}`, color: '#d1d5db' },
          ],
          [
            { text: `  Amount: `, color: '#9ca3af' },
            { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
          ],
          [{ text: '', color: '#d1d5db' }],
          [
            { text: '✓ Approval confirmed', color: '#10b981' },
          ],
        ])
      }
    }

    // Execute supply transaction
    ctx.updateStyledHistory([
      [
        { text: 'Aave V3 Supply:', color: '#00d4aa' },
      ],
      [
        { text: `  Asset: `, color: '#9ca3af' },
        { text: `${params.asset}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount: `, color: '#9ca3af' },
        { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: `Step ${params.useAsCollateral ? '2/3' : params.isNative ? '1/2' : '2/2'}: Supplying to Aave...`, color: '#fbbf24' },
      ],
    ])

    let supplyTxHash: `0x${string}`

    // Native ETH requires WETHGateway, ERC20 uses Pool directly
    if (params.isNative) {
      const wethGatewayAddress = getWETHGatewayAddress(params.chainId)
      if (!wethGatewayAddress) {
        throw new Error(`WETH Gateway not found for chain ${params.chainId}`)
      }

      // Use WETHGateway.depositETH for native ETH
      supplyTxHash = await writeContract(config, {
        address: wethGatewayAddress,
        abi: WETH_GATEWAY_ABI,
        functionName: 'depositETH',
        args: [
          poolAddress, // pool
          ctx.walletAddress as Address, // onBehalfOf
          0, // referralCode
        ],
        value: amount, // Send ETH as value
      })
    } else {
      // Use Pool.supply for ERC20 tokens
      supplyTxHash = await writeContract(config, {
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'supply',
        args: [
          params.underlyingTokenAddress as Address,
          amount,
          ctx.walletAddress as Address, // onBehalfOf
          0, // referralCode
        ],
      })
    }

    ctx.updateStyledHistory([
      [
        { text: 'Aave V3 Supply:', color: '#00d4aa' },
      ],
      [
        { text: `  Asset: `, color: '#9ca3af' },
        { text: `${params.asset}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount: `, color: '#9ca3af' },
        { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: 'Waiting for supply confirmation...', color: '#fbbf24' },
      ],
    ])

    // Wait for supply transaction to be mined
    const { waitForTransactionReceipt } = await import('wagmi/actions')
    await waitForTransactionReceipt(config, { hash: supplyTxHash })

    // Generate transaction link
    const explorerUrls: Record<number, string> = {
      1: 'https://etherscan.io',
      10: 'https://optimistic.etherscan.io',
      8453: 'https://basescan.org',
      42161: 'https://arbiscan.io',
      137: 'https://polygonscan.com',
    }
    const explorerUrl = explorerUrls[params.chainId] || 'https://etherscan.io'
    const txLink = `${explorerUrl}/tx/${supplyTxHash}`

    ctx.updateStyledHistory([
      [
        { text: 'Aave V3 Supply:', color: '#00d4aa' },
      ],
      [
        { text: `  Asset: `, color: '#9ca3af' },
        { text: `${params.asset}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount: `, color: '#9ca3af' },
        { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: '✓ Supply successful', color: '#10b981' },
      ],
    ])

    // Add transaction link
    ctx.addHistoryLinks([
      { text: `View transaction`, url: txLink },
    ])

    // Enable as collateral if flag is set
    if (params.useAsCollateral) {
      ctx.updateStyledHistory([
        [
          { text: 'Aave V3 Supply:', color: '#00d4aa' },
        ],
        [
          { text: `  Asset: `, color: '#9ca3af' },
          { text: `${params.asset}`, color: '#d1d5db' },
        ],
        [
          { text: `  Amount: `, color: '#9ca3af' },
          { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
        ],
        [{ text: '', color: '#d1d5db' }],
        [
          { text: '✓ Supply successful', color: '#10b981' },
        ],
        [
          { text: `Step ${params.isNative ? '2/2' : '3/3'}: Enabling as collateral...`, color: '#fbbf24' },
        ],
      ])

      // For native ETH, we need to use WETH address for collateral setting
      // because WETHGateway deposits it as WETH
      const collateralAsset = params.underlyingTokenAddress as Address

      const collateralTxHash = await writeContract(config, {
        address: poolAddress,
        abi: POOL_ABI,
        functionName: 'setUserUseReserveAsCollateral',
        args: [collateralAsset, true],
      })

      await waitForTransactionReceipt(config, { hash: collateralTxHash })

      const collateralTxLink = `${explorerUrl}/tx/${collateralTxHash}`

      ctx.updateStyledHistory([
        [
          { text: 'Aave V3 Supply:', color: '#00d4aa' },
        ],
        [
          { text: `  Asset: `, color: '#9ca3af' },
          { text: `${params.asset}`, color: '#d1d5db' },
        ],
        [
          { text: `  Amount: `, color: '#9ca3af' },
          { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
        ],
        [{ text: '', color: '#d1d5db' }],
        [
          { text: '✓ Supply successful', color: '#10b981' },
        ],
        [
          { text: '✓ Collateral enabled', color: '#10b981' },
        ],
      ])

      ctx.addHistoryLinks([
        { text: `View collateral transaction`, url: collateralTxLink },
      ])
    }
  } catch (error: any) {
    // Extract detailed error information
    let errorMessage = 'Unknown error'
    let revertReason = ''

    if (error instanceof Error) {
      errorMessage = error.message

      // Try to extract revert reason from various error formats
      if (error.cause) {
        const cause = error.cause as any
        revertReason = cause.reason || cause.message || ''
      }

      // Check for contract revert data
      if (error.message.includes('reverted')) {
        const revertMatch = error.message.match(/reverted with reason string '([^']+)'/)
        if (revertMatch) {
          revertReason = revertMatch[1]
        }
      }
    }

    const displayError = revertReason || errorMessage

    ctx.updateStyledHistory([
      [
        { text: 'Aave V3 Supply:', color: '#00d4aa' },
      ],
      [
        { text: `  Asset: `, color: '#9ca3af' },
        { text: `${params.asset}`, color: '#d1d5db' },
      ],
      [
        { text: `  Amount: `, color: '#9ca3af' },
        { text: `${params.amountFormatted} ${params.asset}`, color: '#d1d5db' },
      ],
      [{ text: '', color: '#d1d5db' }],
      [
        { text: '✗ Supply failed', color: '#ef4444' },
      ],
      [
        { text: `  ${displayError}`, color: '#ef4444' },
      ],
    ])

    throw error
  }
}

/**
 * Handler registry for Aave V3 commands
 */
export const aaveV3Handlers = {
  supply: supplyHandler,
  // Future: withdraw, borrow, repay, etc.
}
