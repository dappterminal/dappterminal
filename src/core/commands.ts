/**
 * Core global commands (G_core scope)
 *
 * These commands are protocol-agnostic and available globally
 */

import type { Command, CommandResult, ExecutionContext } from './types'
import { registry } from './command-registry'

/**
 * Help command - displays available commands
 */
export const helpCommand: Command = {
  id: 'help',
  scope: 'G_core',
  description: 'Display available commands',
  aliases: ['h', '?'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const allCommands = registry.getAllCommands()

      const coreCommands = allCommands.filter(cmd => cmd.scope === 'G_core')
      const aliasCommands = allCommands.filter(cmd => cmd.scope === 'G_alias')
      const protocols = registry.getProtocols()

      const output = {
        message: 'Available commands',
        core: coreCommands.map(cmd => ({
          id: cmd.id,
          description: cmd.description || 'No description',
          aliases: cmd.aliases || [],
        })),
        aliases: aliasCommands.map(cmd => ({
          id: cmd.id,
          description: cmd.description || 'No description',
          aliases: cmd.aliases || [],
        })),
        protocols: protocols.map(protocolId => {
          const fiber = registry.σ(protocolId)
          return {
            id: protocolId,
            name: fiber?.name || protocolId,
            commands: Array.from(fiber?.commands.values() || [])
              .filter(cmd => cmd.id !== 'identity') // Hide protocol-specific identity from help
              .map(cmd => ({
                id: cmd.id,
                description: cmd.description || 'No description',
              })),
          }
        }),
      }

      return {
        success: true,
        value: output,
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
 * List protocols command
 */
export const listProtocolsCommand: Command = {
  id: 'protocols',
  scope: 'G_core',
  description: 'List all available protocols',
  aliases: ['ls-protocols', 'list-protocols'],

  async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    try {
      const protocols = registry.getProtocols()
      const protocolInfo = protocols.map(protocolId => {
        const fiber = registry.σ(protocolId)
        return {
          id: protocolId,
          name: fiber?.name || protocolId,
          description: fiber?.description || 'No description',
          commandCount: fiber?.commands.size || 0,
        }
      })

      return {
        success: true,
        value: protocolInfo,
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
 * Use protocol command - set active protocol
 */
export const useProtocolCommand: Command = {
  id: 'use',
  scope: 'G_core',
  description: 'Set the active protocol',
  aliases: ['protocol', 'set-protocol'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const protocolId = typeof args === 'string' ? args : (args as any)?.protocol

      if (!protocolId) {
        return {
          success: false,
          error: new Error('Protocol ID required. Usage: use <protocol-id>'),
        }
      }

      // Verify protocol exists
      const fiber = registry.σ(protocolId)
      if (!fiber) {
        const available = registry.getProtocols()
        return {
          success: false,
          error: new Error(
            `Protocol '${protocolId}' not found. Available protocols: ${available.join(', ')}`
          ),
        }
      }

      // Update context
      context.activeProtocol = protocolId
      console.log('[use command] Set activeProtocol to:', protocolId, 'context:', context)

      return {
        success: true,
        value: {
          message: `Active protocol set to: ${fiber.name}`,
          protocol: protocolId,
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
 * Exit protocol command - clear active protocol
 */
export const exitProtocolCommand: Command = {
  id: 'exit',
  scope: 'G_core',
  description: 'Exit the current protocol context',
  aliases: ['unuse', 'leave'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const previousProtocol = context.activeProtocol

      if (!previousProtocol) {
        return {
          success: true,
          value: {
            message: 'Not currently in a protocol context',
          },
        }
      }

      // Clear active protocol
      context.activeProtocol = undefined
      console.log('[exit command] Cleared activeProtocol, was:', previousProtocol)

      return {
        success: true,
        value: {
          message: `Exited protocol context`,
          previousProtocol,
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
 * History command - show command execution history
 */
export const historyCommand: Command = {
  id: 'history',
  scope: 'G_core',
  description: 'Show command execution history',
  aliases: ['hist'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const history = context.history.map((exec, index) => ({
        index: index + 1,
        command: exec.commandId,
        protocol: exec.protocol,
        timestamp: exec.timestamp.toISOString(),
        success: exec.success,
        error: exec.error?.message,
      }))

      return {
        success: true,
        value: history,
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
 * Clear command - clear terminal history
 */
export const clearCommand: Command = {
  id: 'clear',
  scope: 'G_core',
  description: 'Clear the terminal',
  aliases: ['cls'],

  async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    return {
      success: true,
      value: { cleared: true },
    }
  },
}

/**
 * Version command - show version info
 */
export const versionCommand: Command = {
  id: 'version',
  scope: 'G_core',
  description: 'Show DeFi Terminal version',
  aliases: ['v', 'ver'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    const chainName = context.wallet.chainId
      ? `Chain ID: ${context.wallet.chainId}`
      : 'Not connected to chain'

    return {
      success: true,
      value: {
        name: 'The DeFi Terminal',
        version: '0.1.0',
        architecture: 'Fibered Monoid',
        chain: chainName,
      },
    }
  },
}

/**
 * Wallet command - show wallet information
 */
export const walletCommand: Command = {
  id: 'wallet',
  scope: 'G_core',
  description: 'Show wallet information',
  aliases: ['w', 'account'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    if (!context.wallet.isConnected) {
      return {
        success: false,
        error: new Error('No wallet connected. Please connect your wallet first.'),
      }
    }

    return {
      success: true,
      value: {
        address: context.wallet.address,
        chainId: context.wallet.chainId,
        isConnected: context.wallet.isConnected,
      },
    }
  },
}

/**
 * WhoAmI command - display current wallet address and ENS
 * Client-side data (ENS, balance) will be injected by terminal component
 */
export const whoamiCommand: Command = {
  id: 'whoami',
  scope: 'G_core',
  description: 'Display current wallet address and ENS name',
  aliases: ['who'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    if (!context.wallet.isConnected || !context.wallet.address) {
      return {
        success: true,
        value: 'No wallet connected',
      }
    }

    // Simple response - terminal will enhance with ENS name
    return {
      success: true,
      value: {
        address: context.wallet.address,
        chainId: context.wallet.chainId,
      },
    }
  },
}

/**
 * Balance command - query balances for the connected address
 * Balance data will be injected by terminal component via client-side fetch
 */
export const balanceCommand: Command = {
  id: 'balance',
  scope: 'G_core',
  description: 'Show native token balance on connected network',
  aliases: ['bal', 'b'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    if (!context.wallet.isConnected || !context.wallet.address) {
      return {
        success: false,
        error: new Error('No wallet connected. Please connect your wallet first.'),
      }
    }

    // Return placeholder - terminal will fetch and display actual balance
    return {
      success: true,
      value: {
        fetchBalance: true, // Signal to fetch balance
        address: context.wallet.address,
        chainId: context.wallet.chainId,
      },
    }
  },
}

/**
 * Transfer command - send ETH to an address
 * Transaction will be built and signed client-side
 */
export const transferCommand: Command = {
  id: 'transfer',
  scope: 'G_core',
  description: 'Send ETH to an address',
  aliases: ['send', 'tx'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    if (!context.wallet.isConnected || !context.wallet.address) {
      return {
        success: false,
        error: new Error('No wallet connected. Please connect your wallet first.'),
      }
    }

    // Parse arguments: transfer <amount> <address>
    const argsStr = typeof _args === 'string' ? _args.trim() : ''
    const parts = argsStr.split(/\s+/)

    if (parts.length !== 2) {
      return {
        success: false,
        error: new Error('Usage: transfer <amount> <address>'),
      }
    }

    const amount = parts[0]
    const toAddress = parts[1]

    // Validate amount
    if (isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return {
        success: false,
        error: new Error('Invalid amount. Must be a positive number.'),
      }
    }

    // Validate address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(toAddress)) {
      return {
        success: false,
        error: new Error('Invalid address format. Must be a valid Ethereum address (0x...).'),
      }
    }

    // Return transfer request - terminal will handle signing and sending
    return {
      success: true,
      value: {
        transferRequest: true, // Signal to terminal
        amount,
        toAddress,
        fromAddress: context.wallet.address,
        chainId: context.wallet.chainId,
      },
    }
  },
}

/**
 * All core commands
 */
export const coreCommands = [
  helpCommand,
  listProtocolsCommand,
  useProtocolCommand,
  exitProtocolCommand,
  historyCommand,
  clearCommand,
  versionCommand,
  walletCommand,
  whoamiCommand,
  balanceCommand,
  transferCommand,
]

/**
 * Register all core commands with the registry
 */
export function registerCoreCommands(): void {
  for (const command of coreCommands) {
    registry.registerCoreCommand(command)
  }
}
