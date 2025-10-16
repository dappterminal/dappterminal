/**
 * Template Protocol Commands
 *
 * Define all commands for this protocol here.
 * Each command must have scope: 'G_p' and protocol: 'template-protocol'
 */

import type { Command, CommandResult, ExecutionContext } from '@/core'
import { callProtocolApi, apiToCommandResult } from '@/lib/api-client'

/**
 * Quote command - Get swap quote (read-only)
 */
export const quoteCommand: Command = {
  id: 'quote',
  scope: 'G_p',
  protocol: 'template-protocol',
  description: 'Get swap quote from Template Protocol',
  aliases: ['price', 'estimate'],

  async run(args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    try {
      // Parse arguments from string input
      const argsStr = typeof args === 'string' ? args : ''
      const [fromToken, toToken, amount] = argsStr.split(' ')

      if (!fromToken || !toToken || !amount) {
        return {
          success: false,
          error: new Error('Usage: quote <fromToken> <toToken> <amount>'),
        }
      }

      // Call protocol API endpoint
      const response = await callProtocolApi<{
        fromToken: string
        toToken: string
        amountIn: string
        amountOut: string
        priceImpact: number
      }>('template-protocol', 'quote', {
        body: {
          fromToken,
          toToken,
          amount,
        },
      })

      return apiToCommandResult(response)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}

/**
 * Swap command - Execute swap transaction
 */
export const swapCommand: Command = {
  id: 'swap',
  scope: 'G_p',
  protocol: 'template-protocol',
  description: 'Swap tokens on Template Protocol',
  aliases: ['exchange', 'trade'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // Verify wallet is connected
      if (!context.wallet.isConnected || !context.wallet.address) {
        return {
          success: false,
          error: new Error('Wallet not connected. Please connect your wallet first.'),
        }
      }

      // Parse arguments
      const argsStr = typeof args === 'string' ? args : ''
      const [fromToken, toToken, amount] = argsStr.split(' ')

      if (!fromToken || !toToken || !amount) {
        return {
          success: false,
          error: new Error('Usage: swap <fromToken> <toToken> <amount>'),
        }
      }

      // Call protocol API endpoint to execute swap
      const response = await callProtocolApi<{
        txHash: string
        fromToken: string
        toToken: string
        amountIn: string
        amountOut: string
      }>('template-protocol', 'swap', {
        body: {
          fromToken,
          toToken,
          amount,
          walletAddress: context.wallet.address,
          chainId: context.wallet.chainId,
        },
      })

      return apiToCommandResult(response)
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}

/**
 * Add/Remove liquidity command
 */
export const liquidityCommand: Command = {
  id: 'liquidity',
  scope: 'G_p',
  protocol: 'template-protocol',
  description: 'Add or remove liquidity on Template Protocol',
  aliases: ['lp', 'pool'],

  async run(args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    try {
      // Parse arguments
      // const { action, token0, token1, amount } = parseLiquidityArgs(args)

      // Execute liquidity operation
      // const result = await executeLiquidity(action, token0, token1, amount)

      // Mock implementation
      console.log('Managing liquidity on Template Protocol:', args)

      return {
        success: true,
        value: {
          txHash: '0x...',
          action: 'add',
          lpTokens: 100,
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
