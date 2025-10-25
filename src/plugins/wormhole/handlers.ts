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
    `Initializing Wormhole SDK...`,
  ])

  // Execute Wormhole bridge flow - entirely client-side
  try {
    // Import Wormhole SDK and helpers
    const { routes, Wormhole } = await import('@wormhole-foundation/sdk')
    const { initWormholeSDK } = await import('@/lib/wormhole-sdk')
    const { getWormholeChainName, getChainIdFromName, resolveTokenAddress, formatETA, getRouteInfo, getTokenDecimals } = await import('@/lib/wormhole')
    const { sendTransaction, getWalletClient, signTransaction } = await import('wagmi/actions')
    const { config } = await import('@/lib/wagmi-config')
    const { parseUnits } = await import('viem')

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
      `Initializing Wormhole SDK...`,
    ])

    // Initialize Wormhole SDK
    const wh = await initWormholeSDK()

    ctx.updateHistory([
      data.message,
      ``,
      `Finding optimal routes...`,
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

    // Create transfer request
    const transferRequest = await routes.RouteTransferRequest.create(wh, {
      source: tokenId,
      destination: destTokens[0],
    })

    // Set sender and receiver on the request
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(transferRequest as any).from = Wormhole.parseAddress(srcChain.chain, data.walletAddress)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(transferRequest as any).to = Wormhole.parseAddress(dstChain.chain, data.receiver)

    // Find routes
    const availableRoutes = await resolver.findRoutes(transferRequest)
    if (!availableRoutes || availableRoutes.length === 0) {
      throw new Error('No route found for this transfer')
    }
    const route = availableRoutes[0] // Use the first (best) route

    // Convert amount to smallest unit (e.g., "10" USDC -> "10000000")
    const tokenDecimals = getTokenDecimals(data.fromToken)

    if (!data.amount || typeof data.amount !== 'string') {
      throw new Error(`Invalid amount: ${data.amount}`)
    }

    const parsedAmount = parseUnits(data.amount, tokenDecimals)
    if (parsedAmount === undefined || parsedAmount === null) {
      throw new Error(`Failed to parse amount: ${data.amount} with decimals: ${tokenDecimals}`)
    }

    const amountInSmallestUnit = parsedAmount.toString()

    // Validate and get quote
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const validation = await (route as any).validate(transferRequest, {
      amount: amountInSmallestUnit,
      options: { nativeGas: 0 }
    })

    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid transfer parameters')
    }

    // Get quote with validated params
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = await (route as any).quote(transferRequest, validation.params)

    // Get route info for display
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const routeType = (route as any)?.constructor?.name || 'Unknown'
    const routeInfo = getRouteInfo(routeType)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const eta = formatETA(quote as any)

    // Format amounts for display
    const formatAmount = (amount: bigint | string | number, decimals: number) => {
      const value = BigInt(amount)
      const divisor = BigInt(10) ** BigInt(decimals)
      return (Number(value) / Number(divisor)).toFixed(6)
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sourceAmountFormatted = (quote as any).sourceToken?.amount
      ? formatAmount((quote as any).sourceToken.amount.amount, (quote as any).sourceToken.amount.decimals)
      : data.amount
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const destAmountFormatted = (quote as any).destinationToken?.amount
      ? formatAmount((quote as any).destinationToken.amount.amount, (quote as any).destinationToken.amount.decimals)
      : sourceAmountFormatted

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const relayFeeInfo = (quote as any).relayFee ? `  Relay Fee: ${formatAmount((quote as any).relayFee.amount.amount, (quote as any).relayFee.amount.decimals)} ${((quote as any).relayFee.token as { symbol?: string })?.symbol || data.fromToken.toUpperCase()}` : null

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
      `Preparing transaction...`,
    ])

    // Get wallet client
    const walletClient = await getWalletClient(config, { chainId: data.chainId })
    if (!walletClient) {
      throw new Error('Failed to get wallet client')
    }

    // Create a proper signer adapter for Wormhole SDK
    const signer = {
      chain: () => srcChain.chain,
      address: () => data.walletAddress,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      signAndSend: async (txs: any[]) => {
        const results = []
        for (const { transaction } of txs) {
          const txHash = await sendTransaction(config, {
            to: transaction.to as `0x${string}`,
            data: transaction.data as `0x${string}`,
            value: transaction.value ? BigInt(transaction.value) : BigInt(0),
            gas: transaction.gasLimit ? BigInt(transaction.gasLimit) : undefined,
          })
          results.push({ txid: txHash })
        }
        return results
      },
    }

    // Get destination address
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const toAddress = Wormhole.parseAddress(dstChain.chain, data.receiver)

    // Track transaction hashes
    const txHashes: string[] = []

    // Start transfer using route.initiate
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
      `Please sign the transaction in your wallet...`,
    ])

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const receipt = await (route as any).initiate(transferRequest, signer, quote, toAddress)

    // Extract transaction hashes from receipt
    if (receipt && receipt.originTxs) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      receipt.originTxs.forEach((tx: any) => {
        if (tx.txid) txHashes.push(tx.txid)
      })
    }

    // Try to get transaction hash from receipt
    const receiptData = receipt as { txid?: string; hash?: string }
    const txHash = receiptData.txid || receiptData.hash || 'unknown'
    if (txHash !== 'unknown') txHashes.push(txHash)

    const lastTxHash = txHashes.length > 0 ? txHashes[txHashes.length - 1] : 'pending'
    const wormholeScanLink = `https://wormholescan.io/#/tx/${lastTxHash}?network=Mainnet`

    ctx.updateHistory([
      `Bridge executed successfully!`,
      `  ${fromChainName} → ${toChainName}`,
      `  Token: ${data.fromToken.toUpperCase()}${data.toToken && data.toToken !== data.fromToken ? ` → ${data.toToken.toUpperCase()}` : ''}`,
      `  Send: ${sourceAmountFormatted} → Receive: ~${destAmountFormatted}`,
      `  ETA: ${eta}`,
      ``,
      txHashes.length > 0 ? `Transaction Hashes:` : `Transaction submitted`,
      ...txHashes.map((hash: string, idx: number) => `  ${idx + 1}. ${hash}`),
      ``,
      `Track on WormholeScan:`,
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
          `Bridge transactions submitted!`,
          `  ${fromChainName} → ${toChainName}`,
          `  Token: ${data.fromToken.toUpperCase()}${data.toToken && data.toToken !== data.fromToken ? ` → ${data.toToken.toUpperCase()}` : ''}`,
          ``,
          `Transaction Hash: ${txHash}`,
          ``,
          `Note: Wormhole is processing your transfer.`,
          `      Funds will arrive automatically at the destination.`,
          ``,
          `Track on WormholeScan:`,
        ])

        ctx.addHistoryLinks([{ text: wormholeScanLink, url: wormholeScanLink }])
        return
      }
    }

    ctx.updateStyledHistory([
      [
        { text: 'Bridge failed: ', color: '#ef4444' },
        { text: errorMsg, color: '#fca5a5' },
      ],
    ])
    console.error('[Wormhole Bridge] Error:', error)
  }
}

/**
 * Handler Registry for Wormhole Protocol
 */
export const wormholeHandlers = {
  bridge: bridgeHandler,
}
