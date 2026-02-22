/**
 * Wormhole Protocol Commands
 */

import type { Command, CommandResult, ExecutionContext } from '@/core'
import { getChainIdFromName, resolveTokenAddress } from '@/lib/wormhole'

interface WormholeTokenAmount {
  amount: string
  decimals: number
  symbol: string
}

interface WormholeQuotePayload {
  sourceToken?: WormholeTokenAmount | null
  destinationToken?: WormholeTokenAmount | null
}

interface WormholeRouteSummary {
  type: string
  name: string
  description: string
  isAutomatic: boolean
  eta: string
  relayFee?: WormholeTokenAmount | null
  quote?: WormholeQuotePayload
}

interface WormholeQuoteCache {
  bestRoute: WormholeRouteSummary
  allRoutes: WormholeRouteSummary[]
  sourceChainId: number
  destChainId: number
  fromToken: string
  toToken: string
  amount: string
  sourceAddress: string
  destAddress: string
  timestamp: number
}

interface WormholePluginState {
  lastQuote?: WormholeQuoteCache
  selectedRouteType?: string
}

function getWormholeState(context: ExecutionContext): WormholePluginState {
  const state = context.protocolState?.get('wormhole')
  if (!state) {
    return {}
  }
  return state as WormholePluginState
}

function setWormholeState(context: ExecutionContext, state: WormholePluginState): void {
  if (!context.protocolState) {
    context.protocolState = new Map()
  }
  context.protocolState.set('wormhole', state as unknown as Record<string, unknown>)
}

function parseFlag(args: string, longFlag: string): string | undefined {
  const flagIndex = args.indexOf(longFlag)
  if (flagIndex === -1) {
    return undefined
  }

  const raw = args.substring(flagIndex + longFlag.length).trim()
  const value = raw.split(' ')[0]
  return value || undefined
}

function formatAmount(amount?: WormholeTokenAmount | null): string | null {
  if (!amount) {
    return null
  }

  try {
    const raw = BigInt(amount.amount)
    const divisor = BigInt(10) ** BigInt(amount.decimals)
    const integerPart = raw / divisor
    const fractionPart = raw % divisor
    const fractionString = fractionPart.toString().padStart(amount.decimals, '0').slice(0, 6)
    const trimmedFraction = fractionString.replace(/0+$/, '')
    const numeric = trimmedFraction.length > 0
      ? `${integerPart.toString()}.${trimmedFraction}`
      : integerPart.toString()

    return `${numeric} ${amount.symbol.toUpperCase()}`
  } catch {
    return `${amount.amount} ${amount.symbol.toUpperCase()}`
  }
}

/**
 * Quote command - Get cross-chain transfer quote
 */
export const quoteCommand: Command = {
  id: 'quote',
  scope: 'G_p',
  protocol: 'wormhole',
  description: 'Get cross-chain transfer quote via Wormhole',
  aliases: ['estimate', 'preview'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter(p => p && !p.startsWith('--'))

      if (parts.length < 4) {
        return {
          success: false,
          error: new Error(
            'Usage: quote <fromChain> <toChain> <token> <amount>\n' +
            'Example: quote ethereum base usdc 100'
          ),
        }
      }

      const [fromChain, toChain, token, amount] = parts

      if (!context.wallet.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      const sourceChainId = getChainIdFromName(fromChain)
      const destChainId = getChainIdFromName(toChain)

      if (!sourceChainId || !destChainId) {
        return {
          success: false,
          error: new Error(
            `Invalid chain input. Supported values include: ethereum, base, arbitrum, optimism, polygon, bsc, avalanche`
          ),
        }
      }

      const destTokenFlag = parseFlag(argsStr, '--dest-token')
        || parseFlag(argsStr, '--destToken')
      const fromToken = resolveTokenAddress(sourceChainId, token) || token
      const toTokenSymbol = destTokenFlag || token
      const toToken = resolveTokenAddress(destChainId, toTokenSymbol) || toTokenSymbol
      const receiver = parseFlag(argsStr, '--receiver') || context.wallet.address

      const response = await fetch('/api/wormhole/quote', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sourceChainId,
          destChainId,
          fromToken,
          toToken,
          amount,
          sourceAddress: context.wallet.address,
          destAddress: receiver,
        }),
      })

      const result = await response.json().catch(() => ({ success: false, error: 'Invalid response' }))
      if (!response.ok || !result.success || !result.data) {
        return {
          success: false,
          error: new Error(result.error || `Failed to get Wormhole quote (HTTP ${response.status})`),
        }
      }

      const bestRoute = result.data.bestRoute as WormholeRouteSummary
      const allRoutes = result.data.quotes as WormholeRouteSummary[]

      if (!bestRoute || !Array.isArray(allRoutes) || allRoutes.length === 0) {
        return {
          success: false,
          error: new Error('No valid Wormhole routes found for this transfer'),
        }
      }

      const state = getWormholeState(context)
      state.lastQuote = {
        bestRoute,
        allRoutes,
        sourceChainId,
        destChainId,
        fromToken,
        toToken,
        amount,
        sourceAddress: context.wallet.address,
        destAddress: receiver,
        timestamp: Date.now(),
      }
      state.selectedRouteType = bestRoute.type
      setWormholeState(context, state)

      const sendAmount = formatAmount(bestRoute.quote?.sourceToken) || `${amount} ${token.toUpperCase()}`
      const receiveAmount = formatAmount(bestRoute.quote?.destinationToken) || 'Unavailable'
      const relayFee = bestRoute.relayFee ? formatAmount(bestRoute.relayFee) : null

      return {
        success: true,
        value: {
          message: [
            `Best route: ${bestRoute.name} (${bestRoute.type})`,
            `ETA: ${bestRoute.eta}`,
            relayFee ? `Relay Fee: ${relayFee}` : null,
            '',
            `Send: ${sendAmount} (${fromChain})`,
            `Receive: ${receiveAmount} (${toChain})`,
            '',
            `Found ${allRoutes.length} route(s). Cached for this session.`,
            `Use \`wormhole:routes\` to inspect/select alternatives.`,
          ].filter(Boolean).join('\n'),
          routeCount: allRoutes.length,
          bestRoute,
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
 * Routes command - List available routes
 */
export const routesCommand: Command = {
  id: 'routes',
  scope: 'G_p',
  protocol: 'wormhole',
  description: 'List available Wormhole routes',
  aliases: ['options'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const state = getWormholeState(context)
      const lastQuote = state.lastQuote

      if (!lastQuote) {
        return {
          success: false,
          error: new Error('No cached quote found. Run `wormhole:quote` first.'),
        }
      }

      const argsStr = typeof args === 'string' ? args.trim() : ''
      const selectRaw = parseFlag(argsStr, '--select')
      if (selectRaw !== undefined) {
        const index = Number.parseInt(selectRaw, 10)
        if (!Number.isFinite(index) || index < 0 || index >= lastQuote.allRoutes.length) {
          return {
            success: false,
            error: new Error(`Invalid route index ${selectRaw}. Valid range: 0-${lastQuote.allRoutes.length - 1}`),
          }
        }
        state.selectedRouteType = lastQuote.allRoutes[index].type
        setWormholeState(context, state)
      }

      const selectedRouteType = state.selectedRouteType || lastQuote.bestRoute.type
      const lines = [
        `Available Wormhole routes (${lastQuote.allRoutes.length}):`,
        '',
      ]

      lastQuote.allRoutes.forEach((route, index) => {
        const selected = route.type === selectedRouteType ? '*' : ' '
        const relayFee = route.relayFee ? formatAmount(route.relayFee) : 'N/A'
        lines.push(`${selected} [${index}] ${route.name} (${route.type})`)
        lines.push(`    ETA: ${route.eta} | Relay Fee: ${relayFee}`)
      })

      lines.push('')
      lines.push(`Selected route: ${selectedRouteType}`)
      lines.push('Use `routes --select <index>` to change selection.')

      return {
        success: true,
        value: {
          message: lines.join('\n'),
          selectedRouteType,
          routeCount: lastQuote.allRoutes.length,
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
 * Bridge command - Execute cross-chain transfer
 */
export const bridgeCommand: Command = {
  id: 'bridge',
  scope: 'G_p',
  protocol: 'wormhole',
  description: 'Bridge tokens cross-chain via Wormhole',
  aliases: ['transfer', 'execute'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Verify wallet is connected
      if (!context.wallet.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      // Parse arguments: bridge <amount> <fromToken> [toToken] <fromChain> <toChain> [--receiver 0x...]
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const parts = argsStr.split(' ').filter(p => p && !p.startsWith('--'))

      // Parse receiver flag
      let receiver = context.wallet.address
      const receiverIndex = argsStr.indexOf('--receiver')
      if (receiverIndex !== -1) {
        const afterReceiver = argsStr.substring(receiverIndex + 10).trim()
        const receiverAddr = afterReceiver.split(' ')[0]
        if (receiverAddr) {
          receiver = receiverAddr as `0x${string}`
        }
      }

      if (parts.length < 4) {
        return {
          success: false,
          error: new Error(
            'Usage: bridge <amount> <fromToken> <fromChain> <toChain> [--receiver <address>]\n' +
            'Usage: bridge <amount> <fromToken> <toToken> <fromChain> <toChain> [--receiver <address>]\n' +
            'Example: bridge 10 usdc base arbitrum\n' +
            'Example: bridge 10 usdc weth base arbitrum\n' +
            'Example: bridge 10 usdc base arbitrum --receiver 0x...'
          ),
        }
      }

      let amount: string
      let fromToken: string
      let toToken: string
      let fromChain: string
      let toChain: string

      // Determine if this is a same-token bridge (4 args) or cross-token bridge (5 args)
      if (parts.length === 4) {
        // Same token: bridge <amount> <fromToken> <fromChain> <toChain>
        amount = parts[0]
        fromToken = parts[1]
        toToken = parts[1] // Same token
        fromChain = parts[2]
        toChain = parts[3]
      } else if (parts.length >= 5) {
        // Cross-token: bridge <amount> <fromToken> <toToken> <fromChain> <toChain>
        amount = parts[0]
        fromToken = parts[1]
        toToken = parts[2]
        fromChain = parts[3]
        toChain = parts[4]
      } else {
        return {
          success: false,
          error: new Error('Invalid number of arguments'),
        }
      }

      // Build message
      const message = fromToken.toLowerCase() === toToken.toLowerCase()
        ? `Bridge request: ${amount} ${fromToken.toUpperCase()} from ${fromChain} to ${toChain}`
        : `Bridge request: ${amount} ${fromToken.toUpperCase()} → ${toToken.toUpperCase()} from ${fromChain} to ${toChain}`

      // Return bridge request for client-side execution
      return {
        success: true,
        value: {
          wormholeBridgeRequest: true, // Use different key to distinguish from Stargate
          fromChain,
          toChain,
          fromToken,
          toToken,
          amount,
          receiver,
          walletAddress: context.wallet.address,
          chainId: context.wallet.chainId,
          message,
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
