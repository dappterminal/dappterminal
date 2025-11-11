/**
 * 1inch Protocol Command Handlers
 *
 * Execution logic for 1inch protocol commands (swap, limitorder, etc.)
 */

import type { CommandHandler } from '@/core'
import { getTxUrl } from '@/lib/explorers'
import { trackSwapTransaction } from '@/lib/tracking/swaps'

/**
 * Swap Handler Data
 */
interface SwapRequestData {
  swapRequest: boolean
  fromToken: string
  toToken: string
  amountIn: string
  amountOut: string
  gas: string
  slippage: number
  srcAddress: string
  dstAddress: string
  amount: string
  chainId: number
  walletAddress: string
}

/**
 * Limit Order Handler Data
 */
interface LimitOrderRequestData {
  limitOrderRequest: boolean
  fromToken: string
  toToken: string
  amount: string
  rate: number
  fromAddress: string
  toAddress: string
  chainId: number
  walletAddress: string
  fromDecimals: number
  toDecimals: number
}

/**
 * Swap Command Handler
 *
 * Handles token swaps via 1inch aggregator with:
 * - Allowance checking
 * - Token approval (if needed)
 * - Swap execution
 */
export const swapHandler: CommandHandler<SwapRequestData> = async (data, ctx) => {
  const formatQuote = () => [
    `📊 Swap Quote:`,
    `  ${data.fromToken.toUpperCase()} → ${data.toToken.toUpperCase()}`,
    `  Input: ${data.amountIn}`,
    `  Output: ${data.amountOut}`,
    `  Gas: ${data.gas}`,
    `  Slippage: ${data.slippage}%`,
    ``,
  ]

  try {
    // Initial state: checking approval
    ctx.updateHistory([...formatQuote(), `⏳ Checking token approval...`])

    const { sendTransaction } = await import('wagmi/actions')
    const { config } = await import('@/lib/wagmi-config')

    // Skip allowance check for native ETH
    const isNativeEth = data.srcAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'

    if (!isNativeEth) {
      // Check allowance
      const allowanceResponse = await fetch(
        `/api/1inch/swap/allowance?chainId=${data.chainId}&tokenAddress=${data.srcAddress}&walletAddress=${data.walletAddress}`
      )

      if (!allowanceResponse.ok) {
        throw new Error('Failed to check token allowance')
      }

      const allowanceData = await allowanceResponse.json()
      const allowance = BigInt(allowanceData.allowance || '0')
      const requiredAmount = BigInt(data.amount)

      // If allowance is insufficient, request approval
      if (allowance < requiredAmount) {
        ctx.updateHistory([
          ...formatQuote(),
          `⚠️  Insufficient allowance`,
          `  Current: ${allowance.toString()}`,
          `  Required: ${requiredAmount.toString()}`,
          ``,
          `📝 Requesting token approval...`,
        ])

        // Get approve transaction for the exact swap amount
        const approveResponse = await fetch(
          `/api/1inch/swap/approve/transaction?chainId=${data.chainId}&tokenAddress=${data.srcAddress}&amount=${data.amount}`
        )

        if (!approveResponse.ok) {
          throw new Error('Failed to get approval transaction')
        }

        const approveTx = await approveResponse.json()

        // Send approval transaction
        const approveHash = await sendTransaction(config, {
          to: approveTx.to as `0x${string}`,
          data: approveTx.data as `0x${string}`,
          value: BigInt(0),
          gas: approveTx.gas ? BigInt(approveTx.gas) : approveTx.gasLimit ? BigInt(approveTx.gasLimit) : undefined,
        })

        ctx.updateHistory([
          ...formatQuote(),
          `✅ Token approved!`,
          `  Approval Tx: ${approveHash}`,
          ``,
          `⏳ Executing swap...`,
        ])
      }
    }

    // Execute the swap
    const swapResponse = await fetch(
      `/api/1inch/swap/classic/swap?chainId=${data.chainId}&src=${data.srcAddress}&dst=${data.dstAddress}&amount=${data.amount}&from=${data.walletAddress}&slippage=${data.slippage}`
    )

    if (!swapResponse.ok) {
      const errorData = await swapResponse.json()
      throw new Error(errorData.error || 'Failed to get swap transaction')
    }

    const swapTx = await swapResponse.json()

    // Send the swap transaction
    const hash = await sendTransaction(config, {
      to: swapTx.tx.to as `0x${string}`,
      data: swapTx.tx.data as `0x${string}`,
      value: BigInt(swapTx.tx.value || '0'),
      gas: BigInt(swapTx.tx.gas || '0'),
    })

    // Track swap transaction in database
    trackSwapTransaction({
      txHash: hash,
      chainId: data.chainId,
      protocol: '1inch',
      command: 'swap',
      txType: 'swap',
      walletAddress: data.walletAddress,
      tokenIn: data.fromToken,
      tokenOut: data.toToken,
      amountIn: data.amount,
      amountOut: swapTx.dstAmount || '0',
      gasUsed: swapTx.tx.gas,
    }).catch(err => console.error('Failed to track 1inch swap:', err))

    // Update with success
    ctx.updateHistory([
      `✅ Swap executed successfully!`,
      `  ${data.fromToken.toUpperCase()} → ${data.toToken.toUpperCase()}`,
      `  Input: ${data.amountIn}`,
      `  Output: ${data.amountOut}`,
      `  Tx Hash: ${hash}`,
    ])

    // Add explorer link
    ctx.addHistoryLinks([
      { text: 'View Transaction', url: getTxUrl(data.chainId, hash) },
    ])
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    ctx.updateHistory([`❌ Swap failed: ${errorMsg}`])
  }
}

/**
 * Limit Order Command Handler
 *
 * Handles limit order creation on 1inch orderbook with:
 * - Order creation (EIP-712 typed data)
 * - Signature request
 * - Order submission to orderbook
 */
export const limitOrderHandler: CommandHandler<LimitOrderRequestData> = async (data, ctx) => {
  const formatOrder = () => [
    `📝 Creating Limit Order:`,
    `  ${data.fromToken.toUpperCase()} → ${data.toToken.toUpperCase()}`,
    `  Amount: ${data.amount}`,
    `  Rate: ${data.rate}`,
    ``,
  ]

  try {
    // Initial state: preparing order
    ctx.updateHistory([...formatOrder(), `⏳ Preparing order...`])

    const { signTypedData } = await import('wagmi/actions')
    const { config } = await import('@/lib/wagmi-config')

    // Call create endpoint to get EIP-712 typed data
    const createResponse = await fetch('/api/1inch/orderbook/limit/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromChainId: data.chainId,
        fromToken: {
          address: data.fromAddress,
          decimals: data.fromDecimals,
        },
        toToken: {
          address: data.toAddress,
          decimals: data.toDecimals,
        },
        amount: data.amount,
        price: data.rate,
        userAddress: data.walletAddress,
      }),
    })

    if (!createResponse.ok) {
      const errorData = await createResponse.json()
      throw new Error(errorData.error || 'Failed to create limit order')
    }

    const orderData = await createResponse.json()

    ctx.updateHistory([...formatOrder(), `✍️  Requesting signature...`])

    // Sign the order with EIP-712 (off-chain signature, no gas)
    const signature = await signTypedData(config, orderData.typedData)

    ctx.updateHistory([...formatOrder(), `⏳ Submitting order to 1inch orderbook...`])

    // Submit the signed order to 1inch orderbook
    const submitResponse = await fetch('/api/1inch/orderbook/limit/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        fromChainId: orderData.fromChainId,
        build: orderData.build,
        extension: orderData.extension,
        signature,
      }),
    })

    if (!submitResponse.ok) {
      const errorData = await submitResponse.json()
      throw new Error(errorData.error || 'Failed to submit limit order')
    }

    // Update with success (no tx hash for limit orders)
    ctx.updateHistory([
      `✅ Limit Order Created!`,
      `  ${data.fromToken.toUpperCase()} → ${data.toToken.toUpperCase()}`,
      `  Amount: ${data.amount}`,
      `  Rate: ${data.rate}`,
      ``,
      `📋 Order placed on 1inch orderbook`,
      `  The order will execute when the target rate is reached`,
    ])
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    ctx.updateHistory([`❌ Limit order failed: ${errorMsg}`])
  }
}

/**
 * Handler Registry for 1inch Protocol
 */
export const oneInchHandlers = {
  swap: swapHandler,
  limitorder: limitOrderHandler,
}
