/**
 * LiFi Protocol Command Handlers
 *
 * Execution logic for LiFi protocol commands (bridge, swap, etc.)
 */

import type { CommandHandler } from '@/core'

/**
 * Bridge Handler Data
 */
interface LiFiBridgeRequestData {
  lifiTransferRequest: boolean
  route: any
  fromToken: string
  toToken?: string
  fromChain: number
  toChain: number
  amount: string
  amountIn: string
  amountOut: string
  walletAddress: string
  chainId: number
  slippage?: number
  steps: any[]
  message?: string
}

/**
 * Bridge Command Handler
 *
 * Handles cross-chain bridge/swap transactions via LiFi with:
 * - Multi-step execution
 * - Automatic approvals
 * - Progress tracking
 * - Exchange rate updates
 */
export const bridgeHandler: CommandHandler<LiFiBridgeRequestData> = async (data, ctx) => {
  console.log('[LiFi Bridge] Bridge data received:', data)
  console.log('[LiFi Bridge] Steps array:', data.steps)
  console.log('[LiFi Bridge] Route:', data.route)

  // Get chain names for display
  const chainNames: Record<number, string> = {
    1: 'Ethereum',
    10: 'Optimism',
    137: 'Polygon',
    42161: 'Arbitrum',
    8453: 'Base',
    56: 'BSC',
    43114: 'Avalanche',
  }
  const fromChainName = chainNames[data.fromChain] || `Chain ${data.fromChain}`
  const toChainName = chainNames[data.toChain] || `Chain ${data.toChain}`

  // Show initial message
  ctx.updateHistory([
    `🌉 LiFi Bridge Quote:`,
    `  ${fromChainName} → ${toChainName}`,
    `  Token: ${data.fromToken.toUpperCase()}${data.toToken && data.toToken !== data.fromToken ? ` → ${data.toToken.toUpperCase()}` : ''}`,
    `  Amount: ${data.amountIn}`,
    `  Estimated Receive: ${data.amountOut}`,
    `  Steps: ${data.steps.length}`,
    ``,
    `⏳ Executing LiFi bridge...`,
  ])

  // Execute LiFi bridge flow using LiFi SDK
  try {
    const { executeRoute, createConfig, EVM } = await import('@lifi/sdk')
    const { getWalletClient, switchChain } = await import('wagmi/actions')
    const { config } = await import('@/lib/wagmi-config')

    const route = data.route
    const txHashes: string[] = []
    let txLink: string | null = null

    ctx.updateHistory([
      `🌉 LiFi Bridge Quote:`,
      `  ${fromChainName} → ${toChainName}`,
      `  Token: ${data.fromToken.toUpperCase()}${data.toToken && data.toToken !== data.fromToken ? ` → ${data.toToken.toUpperCase()}` : ''}`,
      `  Amount: ${data.amountIn}`,
      `  Estimated Receive: ${data.amountOut}`,
      ``,
      `⏳ Executing bridge via LiFi SDK...`,
    ])

    // Configure LiFi SDK with wagmi wallet provider
    createConfig({
      integrator: 'lifi-api',
      providers: [
        EVM({
          getWalletClient: async () => {
            return await getWalletClient(config)
          },
          switchChain: async (chainId: number) => {
            //@ts-ignore
            await switchChain(config, { chainId })
            return await getWalletClient(config)
          },
        }),
      ],
    })

    // Execute the route using LiFi SDK (handles approvals, multi-step execution, etc.)
    const executedRoute = await executeRoute(route, {
      infiniteApproval: false,

      updateRouteHook(updatedRoute: any) {
        console.log('[LiFi Bridge] Route update:', updatedRoute)

        // Extract transaction link and hashes
        const internalTxLink = updatedRoute?.steps?.[0]?.execution?.internalTxLink
        if (internalTxLink) {
          txLink = internalTxLink
        }

        // Collect transaction hashes
        updatedRoute?.steps?.forEach((step: any) => {
          step?.execution?.process?.forEach((proc: any) => {
            if (proc.txHash && !txHashes.includes(proc.txHash)) {
              txHashes.push(proc.txHash)
              ctx.updateHistory([
                `🌉 LiFi Bridge:`,
                `  ${fromChainName} → ${toChainName}`,
                ``,
                `✅ Transaction submitted`,
                `  Tx Hash: ${proc.txHash}`,
                ``,
                `⏳ Waiting for confirmation...`,
              ])
            }
          })
        })
      },

      acceptExchangeRateUpdateHook(params: any) {
        console.log('[LiFi Bridge] Exchange rate update:', params)
        // Auto-accept rate updates
        return Promise.resolve(true)
      },
    })

    console.log('[LiFi Bridge] Executed route:', executedRoute)

    // Get final transaction link
    const finalTxLink = txLink || executedRoute?.steps?.[0]?.execution?.internalTxLink
    const lifiExplorerLink = finalTxLink || (txHashes.length > 0 ? `https://li.quest/tx/${txHashes[txHashes.length - 1]}` : null)

    const successMessage = [
      `✅ LiFi bridge executed successfully!`,
      `  ${fromChainName} → ${toChainName}`,
      `  Token: ${data.fromToken.toUpperCase()}${data.toToken && data.toToken !== data.fromToken ? ` → ${data.toToken.toUpperCase()}` : ''}`,
      `  Amount: ${data.amountIn}`,
      `  Estimated Receive: ${data.amountOut}`,
    ]

    if (txHashes.length > 0) {
      successMessage.push(``, `Transaction Hashes:`)
      txHashes.forEach((hash, idx) => {
        successMessage.push(`  ${idx + 1}. ${hash}`)
      })
    }

    if (lifiExplorerLink) {
      successMessage.push(``, `🔍 Track on LiFi Explorer:`)
      ctx.updateHistory(successMessage)
      ctx.addHistoryLinks([{ text: lifiExplorerLink, url: lifiExplorerLink }])
    } else {
      ctx.updateHistory(successMessage)
    }
  } catch (error) {
    // Update with error
    const errorMsg = error instanceof Error ? error.message : String(error)
    ctx.updateHistory([`❌ LiFi bridge failed: ${errorMsg}`])
    console.error('[LiFi Bridge] Error:', error)
  }
}

/**
 * Handler Registry for LiFi Protocol
 */
export const lifiHandlers = {
  bridge: bridgeHandler,
}
