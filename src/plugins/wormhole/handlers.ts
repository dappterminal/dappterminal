/**
 * Wormhole Protocol Command Handlers
 *
 * Execution logic for Wormhole protocol commands (bridge, etc.)
 */

import type { CommandHandler } from '@/core'

/**
 * Bridge Handler Data
 */
interface WormholeBridgeRequestData {
  wormholeBridgeRequest: boolean
  fromChain: string
  toChain: string
  fromToken: string
  toToken?: string
  amount: string
  receiver: string
  walletAddress: string
  chainId: number
  message: string
}

/**
 * Bridge Command Handler
 *
 * Handles cross-chain bridge transactions via Wormhole with:
 * - SDK initialization
 * - Route finding
 * - Multi-step execution
 * - Progress tracking
 */
export const bridgeHandler: CommandHandler<WormholeBridgeRequestData> = async (data, ctx) => {
  // Get Wormhole chain names mapping
  const chainNames: Record<string, string> = {
    base: 'Base',
    arbitrum: 'Arbitrum',
    ethereum: 'Ethereum',
    optimism: 'Optimism',
    polygon: 'Polygon',
    bsc: 'BSC',
    avalanche: 'Avalanche',
  }
  const fromChainName = chainNames[data.fromChain] || data.fromChain
  const toChainName = chainNames[data.toChain] || data.toChain

  // Show initial message
  ctx.updateHistory([
    data.message,
    ``,
    `Protocol: Wormhole`,
    `From: ${fromChainName}`,
    `To: ${toChainName}`,
    `Token: ${data.fromToken.toUpperCase()}${data.toToken && data.toToken !== data.fromToken ? ` → ${data.toToken.toUpperCase()}` : ''}`,
    `Amount: ${data.amount}`,
    ``,
    `⏳ Initializing Wormhole SDK...`,
  ])

  // Execute Wormhole bridge flow - entirely client-side
  try {
    // Import Wormhole SDK and helpers
    const { routes, Wormhole } = await import('@wormhole-foundation/sdk')
    const { initWormholeSDK } = await import('@/lib/wormhole-sdk')
    const { getWormholeChainName, getChainIdFromName, resolveTokenAddress, formatETA, getRouteInfo } = await import('@/lib/wormhole')
    const { sendTransaction } = await import('wagmi/actions')
    const { config } = await import('@/lib/wagmi-config')

    // Get chain IDs
    const destChainId = getChainIdFromName(data.toChain)
    if (!destChainId) {
      throw new Error(`Unsupported destination chain: ${data.toChain}`)
    }

    ctx.updateHistory([
      data.message,
      ``,
      `Protocol: Wormhole`,
      `From: ${fromChainName}`,
      `To: ${toChainName}`,
      `Token: ${data.fromToken.toUpperCase()}`,
      `Amount: ${data.amount}`,
      ``,
      `⏳ Initializing Wormhole SDK...`,
    ])

    // Initialize Wormhole SDK
    const wh = await initWormholeSDK()

    ctx.updateHistory([
      data.message,
      ``,
      `⏳ Finding optimal routes...`,
    ])

    // Get Wormhole chain names
    const sourceChain = getWormholeChainName(data.chainId)
    const destChain = getWormholeChainName(destChainId)

    if (!sourceChain || !destChain) {
      throw new Error('Invalid chain configuration')
    }

    // Get token address
    const fromTokenAddress = resolveTokenAddress(data.chainId, data.fromToken)

    // Resolve chains
    const resolver = wh.resolver([routes.AutomaticTokenBridgeRoute, routes.AutomaticCCTPRoute, routes.CCTPRoute])
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const srcChain = wh.getChain(sourceChain as any)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dstChain = wh.getChain(destChain as any)

    // Create token ID
    const isNative = fromTokenAddress === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE'
    const tokenId = Wormhole.tokenId(srcChain.chain, isNative ? 'native' : (fromTokenAddress || data.fromToken))

    // Find supported destination tokens
    const destTokens = await resolver.supportedDestinationTokens(tokenId, srcChain, dstChain)

    if (!destTokens || destTokens.length === 0) {
      throw new Error(`No supported routes for ${data.fromToken}`)
    }

    // Parse sender and receiver addresses
    const senderAddr = Wormhole.parseAddress(srcChain.chain, data.walletAddress)
    const receiverAddr = Wormhole.parseAddress(dstChain.chain, data.receiver)

    // Create transfer request
    const transferRequest = await routes.RouteTransferRequest.create(wh, {
      source: tokenId,
      destination: destTokens[0],
    })

    // Validate request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validated = await (transferRequest as any).validate({
      amount: data.amount,
      from: senderAddr,
      to: receiverAddr,
    })

    if (!validated.valid) {
      throw new Error(validated.error || 'Invalid transfer request')
    }

    // Get quote
    const availableRoutes = await resolver.findRoutes(validated.params)
    if (!availableRoutes || availableRoutes.length === 0) {
      throw new Error('No route found for this transfer')
    }
    const quote = availableRoutes[0] // Use the first (best) route

    // Get route info for display
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routeType = (quote as any)?.constructor?.name || 'Unknown'
    const routeInfo = getRouteInfo(routeType)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eta = formatETA(quote as any)

    // Format amounts for display
    const formatAmount = (amount: bigint | string | number, decimals: number) => {
      const value = BigInt(amount)
      const divisor = BigInt(10) ** BigInt(decimals)
      return (Number(value) / Number(divisor)).toFixed(6)
    }

    const sourceAmountFormatted = formatAmount(validated.params.amount.amount, validated.params.amount.decimals)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const destAmountFormatted = (quote as any).destinationToken?.amount
      ? formatAmount((quote as any).destinationToken.amount.amount, (quote as any).destinationToken.amount.decimals)
      : sourceAmountFormatted

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relayFeeInfo = (quote as any).relayFee ? `  Relay Fee: ${formatAmount((quote as any).relayFee.amount, (quote as any).relayFee.amount.decimals)} ${((quote as any).relayFee.token as { symbol?: string })?.symbol || data.fromToken.toUpperCase()}` : null

    ctx.updateHistory([
      data.message,
      ``,
      `Protocol: Wormhole ${routeInfo.isAutomatic ? '(Automatic)' : '(Manual)'}`,
      `Route: ${routeInfo.name}`,
      `ETA: ${eta}`,
      ``,
      `From: ${fromChainName}`,
      `  Send: ${sourceAmountFormatted} ${data.fromToken.toUpperCase()}`,
      `To: ${toChainName}`,
      `  Receive: ~${destAmountFormatted} ${data.toToken?.toUpperCase() || data.fromToken.toUpperCase()}`,
      ...(relayFeeInfo ? [relayFeeInfo] : []),
      ``,
      `⏳ Preparing transaction...`,
    ])

    // Start transfer
    const txHashes: string[] = []
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receipt = await (quote as any).initiateTransfer({
      chain: srcChain.chain,
      address: () => data.walletAddress,
      signAndSend: async (txs: Array<{
        transaction: {
          to: string
          data: string
          value?: string | number
          gasLimit?: string | number
        }
        description: string
      }>) => {
        const txids: string[] = []
        for (let i = 0; i < txs.length; i++) {
          const txn = txs[i]
          const { transaction, description } = txn

          const stepNum = i + 1
          const totalSteps = txs.length

          ctx.updateHistory([
            data.message,
            ``,
            `Protocol: Wormhole ${routeInfo.isAutomatic ? '(Automatic)' : '(Manual)'}`,
            `Route: ${routeInfo.name}`,
            `ETA: ${eta}`,
            ``,
            `From: ${fromChainName}`,
            `  Send: ${sourceAmountFormatted} ${data.fromToken.toUpperCase()}`,
            `To: ${toChainName}`,
            `  Receive: ~${destAmountFormatted} ${data.toToken?.toUpperCase() || data.fromToken.toUpperCase()}`,
            ...(relayFeeInfo ? [relayFeeInfo, ``] : []),
            `⏳ Transaction ${stepNum}/${totalSteps}: ${description}`,
            `  Please sign in your wallet...`,
          ])

          const txHash = await sendTransaction(config, {
            to: transaction.to as `0x${string}`,
            data: transaction.data as `0x${string}`,
            value: transaction.value ? BigInt(transaction.value) : BigInt(0),
            gas: transaction.gasLimit ? BigInt(transaction.gasLimit) : undefined,
          })

          txids.push(txHash)
          txHashes.push(txHash)

          ctx.updateHistory([
            data.message,
            ``,
            `Protocol: Wormhole ${routeInfo.isAutomatic ? '(Automatic)' : '(Manual)'}`,
            `Route: ${routeInfo.name}`,
            `ETA: ${eta}`,
            ``,
            `From: ${fromChainName}`,
            `  Send: ${sourceAmountFormatted} ${data.fromToken.toUpperCase()}`,
            `To: ${toChainName}`,
            `  Receive: ~${destAmountFormatted} ${data.toToken?.toUpperCase() || data.fromToken.toUpperCase()}`,
            ...(relayFeeInfo ? [relayFeeInfo, ``] : []),
            `✅ Transaction ${stepNum}/${totalSteps} sent!`,
            `  ${description}`,
            `  Hash: ${txHash}`,
            ``,
            ...(stepNum < totalSteps ? [`⏳ Preparing next transaction...`] : [`⏳ Waiting for Wormhole to process...`]),
          ])

          if (stepNum < totalSteps) {
            await new Promise(resolve => setTimeout(resolve, 1000))
          }
        }
        return txids
      },
    })

    // Try to get transaction hash from receipt
    const receiptData = receipt as { txid?: string; hash?: string }
    const txHash = receiptData.txid || receiptData.hash || 'unknown'
    if (txHash !== 'unknown') txHashes.push(txHash)

    const lastTxHash = txHashes.length > 0 ? txHashes[txHashes.length - 1] : 'pending'
    const wormholeScanLink = `https://wormholescan.io/#/tx/${lastTxHash}?network=Mainnet`

    ctx.updateHistory([
      `✅ Bridge executed successfully!`,
      `  ${fromChainName} → ${toChainName}`,
      `  Token: ${data.fromToken.toUpperCase()}${data.toToken && data.toToken !== data.fromToken ? ` → ${data.toToken.toUpperCase()}` : ''}`,
      `  Send: ${sourceAmountFormatted} → Receive: ~${destAmountFormatted}`,
      `  ETA: ${eta}`,
      ``,
      txHashes.length > 0 ? `Transaction Hashes:` : `Transaction submitted`,
      ...txHashes.map((hash: string, idx: number) => `  ${idx + 1}. ${hash}`),
      ``,
      `🔍 Track on WormholeScan:`,
    ])

    ctx.addHistoryLinks([{ text: wormholeScanLink, url: wormholeScanLink }])
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)

    // Check if error is about missing receipt but transaction was submitted
    if (errorMsg && errorMsg.includes('No receipt for')) {
      const txHashMatch = errorMsg.match(/0x[a-fA-F0-9]{64}/)
      const txHash = txHashMatch ? txHashMatch[0] : null

      if (txHash) {
        const wormholeScanLink = `https://wormholescan.io/#/tx/${txHash}?network=Mainnet`

        ctx.updateHistory([
          `✅ Bridge transactions submitted!`,
          `  ${fromChainName} → ${toChainName}`,
          `  Token: ${data.fromToken.toUpperCase()}${data.toToken && data.toToken !== data.fromToken ? ` → ${data.toToken.toUpperCase()}` : ''}`,
          ``,
          `Transaction Hash: ${txHash}`,
          ``,
          `⚠️  Note: Wormhole is processing your transfer.`,
          `    Funds will arrive automatically at the destination.`,
          ``,
          `🔍 Track on WormholeScan:`,
        ])

        ctx.addHistoryLinks([{ text: wormholeScanLink, url: wormholeScanLink }])
        return
      }
    }

    ctx.updateHistory([`❌ Bridge failed: ${errorMsg}`])
    console.error('[Wormhole Bridge] Error:', error)
  }
}

/**
 * Handler Registry for Wormhole Protocol
 */
export const wormholeHandlers = {
  bridge: bridgeHandler,
}
