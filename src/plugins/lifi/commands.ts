/**
 * LiFi Plugin Commands
 *
 * Commands for the LiFi bridge aggregator integration
 */

import type { Command, CommandResult, ExecutionContext } from '@/core/types'
import { lifiAPI } from './api'
import type { LiFiPluginState } from './types'
import {
  resolveTokenInfo,
  parseChainInput,
  formatRouteSummary,
  getChainName,
  LIFI_CHAINS,
} from '@/lib/lifi'
import { parseUnits, formatUnits } from 'viem'

// ============================================================================
// Helper Functions
// ============================================================================

function getLiFiState(context: ExecutionContext): LiFiPluginState {
  const storedState = context.protocolState?.get('lifi')
  if (!storedState) {
    return {} as LiFiPluginState
  }
  return storedState as LiFiPluginState
}

function setLiFiState(context: ExecutionContext, state: LiFiPluginState): void {
  if (!context.protocolState) {
    context.protocolState = new Map()
  }
  context.protocolState.set('lifi', state)
}

// ============================================================================
// Commands
// ============================================================================

/**
 * Health check command
 */
export const healthCommand: Command = {
  id: 'health',
  scope: 'G_p',
  protocol: 'lifi',
  description: 'Validate LiFi API key and connectivity',
  aliases: ['ping'],

  async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    const result = await lifiAPI.testKey()

    if (!result.success) {
      return {
        success: false,
        // @ts-expect-error - Type 'string' is not assignable to type 'Error' (but it works at runtime)
        error: result.error || 'Failed to validate API key',
      }
    }

    return {
      success: true,
      value: {
        status: 'healthy',
        message: result.data?.message || 'LiFi API is accessible',
        timestamp: new Date().toISOString(),
      },
    }
  },
}

/**
 * Quote command - fetch bridge routes
 */
export const quoteCommand: Command = {
  id: 'quote',
  scope: 'G_p',
  protocol: 'lifi',
  description: 'Get bridge quote for cross-chain transfer',
  aliases: ['estimate', 'price'],

  async run(args: any, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Parse arguments: quote <fromChain> <toChain> <token> <amount> [--dest-token <symbol>] [--slippage 0.5]
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter(p => p && !p.startsWith('--'))

      if (parts.length < 4) {
        return {
          success: false,
          error: new Error(
            'Usage: quote <fromChain> <toChain> <token> <amount> [--dest-token <symbol>] [--slippage 0.5]\n' +
            'Example: quote base arbitrum usdc 100\n' +
            'Example: quote ethereum polygon usdc eth 50 --slippage 1'
          ),
        }
      }

      const [fromChainInput, toChainInput, fromTokenInput, amountInput] = parts
      let toTokenInput = fromTokenInput // Default to same token

      // Parse dest-token flag
      const destTokenIndex = argsStr.indexOf('--dest-token')
      if (destTokenIndex !== -1) {
        const afterDestToken = argsStr.substring(destTokenIndex + 12).trim()
        const destToken = afterDestToken.split(' ')[0]
        if (destToken) {
          toTokenInput = destToken
        }
      }

      // Parse slippage flag
      let slippage = 0.5 // Default 0.5%
      const slippageIndex = argsStr.indexOf('--slippage')
      if (slippageIndex !== -1) {
        const afterSlippage = argsStr.substring(slippageIndex + 10).trim()
        const slippageValue = parseFloat(afterSlippage.split(' ')[0])
        if (!isNaN(slippageValue)) {
          slippage = slippageValue
        }
      }

      // Verify wallet is connected
      if (!context.wallet?.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      // Parse chain inputs
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

      // Resolve token info
      const fromTokenInfo = resolveTokenInfo(fromTokenInput, fromChainId)
      const toTokenInfo = resolveTokenInfo(toTokenInput, toChainId)

      if (!fromTokenInfo || !toTokenInfo) {
        return {
          success: false,
          error: new Error(
            `Token not found. From: ${fromTokenInput} on ${getChainName(fromChainId)}, ` +
            `To: ${toTokenInput} on ${getChainName(toChainId)}`
          ),
        }
      }

      // Convert amount to base units
      const amount = parseUnits(amountInput, fromTokenInfo.decimals).toString()

      // Call API
      const result = await lifiAPI.getRoutes({
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken: fromTokenInfo.address,
        toToken: toTokenInfo.address,
        fromAmount: amount,
        fromAddress: context.wallet.address,
        toAddress: context.wallet.address,
        slippage,
      })

      if (!result.success || !result.data?.routes.length) {
        return {
          success: false,
          error: new Error(result.error || 'No routes found'),
        }
      }

      // Cache the quote
      const state = getLiFiState(context)
      state.lastQuote = {
        routes: result.data.routes,
        selectedRoute: result.data.selectedRoute!,
        timestamp: Date.now(),
      }
      setLiFiState(context, state)

      // Format response
      const summary = formatRouteSummary(result.data.selectedRoute!)

      return {
        success: true,
        value: {
          ...summary,
          routeCount: result.data.routes.length,
          message: `Found ${result.data.routes.length} route(s). Best route cached.`,
          hint: 'Use `lifi:routes` to see all options or `lifi:execute` to proceed',
        },
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
 * Routes command - list all available routes
 */
export const routesCommand: Command = {
  id: 'routes',
  scope: 'G_p',
  protocol: 'lifi',
  description: 'List all available bridge routes',
  aliases: ['options', 'list'],

  async run(args: any, context: ExecutionContext): Promise<CommandResult> {
    try {
      const state = getLiFiState(context)

      if (!state.lastQuote) {
        return {
          success: false,
          error: new Error('No cached quote. Run `lifi:quote` first'),
        }
      }

      // Check if quote is stale (older than 5 minutes)
      const age = Date.now() - state.lastQuote.timestamp
      if (age > 5 * 60 * 1000 && !args.cached) {
        return {
          success: false,
          error: new Error('Cached quote is stale. Run `lifi:quote` again or use --cached flag'),
        }
      }

      // Parse --select flag
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const selectIndex = argsStr.indexOf('--select')
      if (selectIndex !== -1) {
        const afterSelect = argsStr.substring(selectIndex + 8).trim()
        const routeIndex = parseInt(afterSelect.split(' ')[0])

        if (!isNaN(routeIndex) && routeIndex >= 0 && routeIndex < state.lastQuote.routes.length) {
          state.lastQuote.selectedRoute = state.lastQuote.routes[routeIndex]
          setLiFiState(context, state)

          return {
            success: true,
            value: {
              message: `Selected route ${routeIndex}`,
              route: formatRouteSummary(state.lastQuote.selectedRoute),
            },
          }
        } else {
          return {
            success: false,
            error: new Error(`Invalid route index. Available: 0-${state.lastQuote.routes.length - 1}`),
          }
        }
      }

      // List all routes
      const routes = state.lastQuote.routes.map((route, index) => ({
        index,
        ...formatRouteSummary(route),
        isSelected: route.id === state.lastQuote?.selectedRoute.id,
      }))

      return {
        success: true,
        value: {
          routes,
          selectedRouteId: state.lastQuote.selectedRoute.id,
          timestamp: new Date(state.lastQuote.timestamp).toISOString(),
          hint: 'Use --select <index> to choose a different route',
        },
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
 * Bridge command - unified quote + execute for cross-chain bridging
 */
export const bridgeCommand: Command = {
  id: 'bridge',
  scope: 'G_p',
  protocol: 'lifi',
  description: 'Bridge tokens across chains using LiFi',
  aliases: ['b', 'transfer'],

  async run(args: any, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Parse arguments: bridge <amount> <token> <fromChain> <toChain> [--dest-token <symbol>] [--slippage 0.5]
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter(p => p && !p.startsWith('--'))

      if (parts.length < 4) {
        return {
          success: false,
          error: new Error(
            'Usage: bridge <amount> <token> <fromChain> <toChain> [--dest-token <symbol>] [--slippage 0.5]\n' +
            'Example: bridge 100 usdc base arbitrum\n' +
            'Example: bridge 50 usdc ethereum polygon --dest-token usdt --slippage 1\n\n' +
            'Supported chains: ethereum, polygon, arbitrum, optimism, base, bsc, avalanche'
          ),
        }
      }

      const [amountInput, fromTokenInput, fromChainInput, toChainInput] = parts
      let toTokenInput = fromTokenInput // Default to same token

      // Parse dest-token flag
      const destTokenIndex = argsStr.indexOf('--dest-token')
      if (destTokenIndex !== -1) {
        const afterDestToken = argsStr.substring(destTokenIndex + 12).trim()
        const destToken = afterDestToken.split(' ')[0]
        if (destToken) {
          toTokenInput = destToken
        }
      }

      // Parse slippage flag
      let slippage = 0.5 // Default 0.5%
      const slippageIndex = argsStr.indexOf('--slippage')
      if (slippageIndex !== -1) {
        const afterSlippage = argsStr.substring(slippageIndex + 10).trim()
        const slippageValue = parseFloat(afterSlippage.split(' ')[0])
        if (!isNaN(slippageValue)) {
          slippage = slippageValue
        }
      }

      // Verify wallet is connected
      if (!context.wallet?.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      // Parse chain inputs
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

      // Resolve token info
      const fromTokenInfo = resolveTokenInfo(fromTokenInput, fromChainId)
      const toTokenInfo = resolveTokenInfo(toTokenInput, toChainId)

      if (!fromTokenInfo || !toTokenInfo) {
        return {
          success: false,
          error: new Error(
            `Token not found. From: ${fromTokenInput} on ${getChainName(fromChainId)}, ` +
            `To: ${toTokenInput} on ${getChainName(toChainId)}`
          ),
        }
      }

      // Convert amount to base units
      const amount = parseUnits(amountInput, fromTokenInfo.decimals).toString()

      // Get route quote from LiFi
      const result = await lifiAPI.getRoutes({
        fromChain: fromChainId,
        toChain: toChainId,
        fromToken: fromTokenInfo.address,
        toToken: toTokenInfo.address,
        fromAmount: amount,
        fromAddress: context.wallet.address,
        toAddress: context.wallet.address,
        slippage,
      })

      if (!result.success || !result.data?.routes.length) {
        return {
          success: false,
          error: new Error(result.error || 'No routes found'),
        }
      }

      const route = result.data.selectedRoute!

      // Cache the quote for potential status checking later
      const state = getLiFiState(context)
      state.lastQuote = {
        routes: result.data.routes,
        selectedRoute: route,
        timestamp: Date.now(),
      }
      state.execution = {
        routeId: route.id,
        currentStep: 0,
        txHashes: [],
        status: 'idle',
        lastUpdated: Date.now(),
      }
      setLiFiState(context, state)

      let formattedAmountOut = '~'
      try {
        const lastStep = route.steps[route.steps.length - 1]
        const destinationToken = route.toToken || lastStep?.action.toToken
        if (route.toAmount && destinationToken?.decimals !== undefined) {
          formattedAmountOut = `${formatUnits(BigInt(route.toAmount), destinationToken.decimals)} ${destinationToken.symbol}`
        }
      } catch {
        formattedAmountOut = '~'
      }

      // Return bridge request for terminal to handle transaction signing
      return {
        success: true,
        value: {
          lifiTransferRequest: true, // Flag for frontend to recognize LiFi execution
          route,
          fromToken: fromTokenInput,
          toToken: toTokenInput,
          fromChain: route.fromChainId,
          toChain: route.toChainId,
          amount,
          amountIn: amountInput,
          amountOut: formattedAmountOut,
          walletAddress: context.wallet.address,
          chainId: context.wallet.chainId,
          slippage,
          steps: route.steps.map((step, index) => ({
            stepIndex: index,
            type: step.type,
            action: step.action,
            estimate: step.estimate,
            includedSteps: step.includedSteps,
            transactionRequest: step.transactionRequest,
            tool: step.tool,
            toolDetails: step.toolDetails,
          })),
          message: `Ready to execute ${route.steps.length}-step route via LiFi`,
        },
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
 * Execute command - execute the selected route
 */
export const executeCommand: Command = {
  id: 'execute',
  scope: 'G_p',
  protocol: 'lifi',
  description: 'Execute the selected bridge route',
  aliases: [],

  async run(_args: any, context: ExecutionContext): Promise<CommandResult> {
    try {
      const state = getLiFiState(context)

      if (!state.lastQuote) {
        return {
          success: false,
          error: new Error('No cached quote. Run `lifi:quote` first'),
        }
      }

      // Verify wallet is connected
      if (!context.wallet?.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      const route = state.lastQuote.selectedRoute

      state.execution = {
        routeId: route.id,
        currentStep: 0,
        txHashes: [],
        status: 'idle',
        lastUpdated: Date.now(),
      }
      setLiFiState(context, state)

      // Return execution request for frontend to handle (similar to Stargate pattern)
      return {
        success: true,
        value: {
          lifiTransferRequest: true, // Flag for frontend to recognize LiFi execution
          route,
          fromChain: route.fromChainId,
          toChain: route.toChainId,
          walletAddress: context.wallet.address,
          chainId: context.wallet.chainId,
          steps: route.steps.map((step, index) => ({
            stepIndex: index,
            type: step.type,
            action: step.action,
            estimate: step.estimate,
          })),
          message: `Ready to execute ${route.steps.length}-step route via LiFi`,
        },
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
 * Prepare step command - get transaction data for a specific step
 */
export const prepareStepCommand: Command = {
  id: 'prepare-step',
  scope: 'G_p',
  protocol: 'lifi',
  description: 'Get transaction data for a route step',

  async run(args: any, context: ExecutionContext): Promise<CommandResult> {
    try {
      const state = getLiFiState(context)

      if (!state.lastQuote) {
        return {
          success: false,
          error: new Error('No cached quote. Run `lifi:quote` first'),
        }
      }

      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ')
      const stepIndex = parseInt(parts[0] || '0')
      const route = state.lastQuote.selectedRoute

      if (stepIndex < 0 || stepIndex >= route.steps.length) {
        return {
          success: false,
          error: new Error(`Invalid step index. Route has ${route.steps.length} steps (0-${route.steps.length - 1})`),
        }
      }

      const result = await lifiAPI.getStepTransaction({
        route,
        stepIndex,
      })

      if (!result.success || !result.data) {
        return {
          success: false,
          error: new Error(result.error || 'Failed to get step transaction'),
        }
      }

      return {
        success: true,
        value: {
          stepIndex,
          transactionRequest: result.data.transactionRequest,
        },
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
 * Chains command - list supported chains
 */
export const chainsCommand: Command = {
  id: 'chains',
  scope: 'G_p',
  protocol: 'lifi',
  description: 'List supported chains',
  aliases: ['networks'],

  async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    const chains = Object.values(LIFI_CHAINS).map(chain => ({
      id: chain.id,
      name: chain.name,
      shortName: chain.shortName,
    }))

    return {
      success: true,
      value: {
        chains,
        totalCount: chains.length,
      },
    }
  },
}

/**
 * Status command - check bridge transaction status
 */
export const statusCommand: Command = {
  id: 'status',
  scope: 'G_p',
  protocol: 'lifi',
  description: 'Check bridge transaction status',
  aliases: ['track'],

  async run(args: any, context: ExecutionContext): Promise<CommandResult> {
    try {
      const state = getLiFiState(context)

      // Parse tx hash from args or use last cached hash
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ')
      const txHash = parts[0] || state.execution?.txHashes?.[0]

      if (!txHash) {
        return {
          success: false,
          error: new Error('Usage: status [txHash]\nNo transaction hash provided and no cached execution found.'),
        }
      }

      // Get bridge and chain info from last quote or execution
      if (!state.lastQuote) {
        return {
          success: false,
          error: new Error('No route information found. Cannot check status without route context.'),
        }
      }

      const route = state.lastQuote.selectedRoute
      // Find bridge name from route steps
      const bridgeStep = route.steps.find(step => step.type === 'cross' || step.type === 'lifi')
      const bridge =
        bridgeStep?.toolDetails?.key ||
        bridgeStep?.tool ||
        route.steps[0]?.toolDetails?.key ||
        route.steps[0]?.tool ||
        route.integrator ||
        'unknown'

      const result = await lifiAPI.getStatus({
        bridge,
        fromChain: route.fromChainId,
        toChain: route.toChainId,
        txHash,
      })

      if (!result.success || !result.data) {
        return {
          success: false,
          error: new Error(result.error || 'Failed to get transaction status'),
        }
      }

      return {
        success: true,
        value: {
          txHash,
          status: result.data.status,
          substatus: result.data.substatus,
          sending: result.data.sending,
          receiving: result.data.receiving,
          lifiExplorerLink: result.data.lifiExplorerLink,
          hint: result.data.status === 'PENDING' ? 'Run `status` again to check progress' : undefined,
        },
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}
