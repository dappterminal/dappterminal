/**
 * Wormhole Protocol Commands
 */

import type { Command, CommandResult, ExecutionContext } from '@/core'

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
      const parts = argsStr.split(' ')

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

      // TODO: Implement actual Wormhole quote logic
      return {
        success: true,
        value: {
          message: `Quote requested for ${amount} ${token.toUpperCase()} from ${fromChain} to ${toChain}`,
          implementation: 'pending',
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
      // TODO: Implement routes listing
      return {
        success: true,
        value: {
          message: 'Available routes',
          implementation: 'pending',
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
