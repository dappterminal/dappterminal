/**
 * Core global commands (G_core scope)
 *
 * These commands are protocol-agnostic and available globally
 */

import type { Command, CommandResult, ExecutionContext } from './types'
import { registry } from './command-registry'

/**
 * Help command - displays available commands
 * Fiber-aware: shows only fiber commands when in M_p, all commands when in M_G
 */
export const helpCommand: Command = {
  id: 'help',
  scope: 'G_core',
  description: 'Display available commands',
  aliases: ['h', '?'],

  async run(_args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      // If in a protocol fiber (M_p), show only that fiber's commands + essential globals
      if (context.activeProtocol) {
        const fiber = registry.σ(context.activeProtocol)

        if (!fiber) {
          return {
            success: false,
            error: new Error(`Active protocol '${context.activeProtocol}' not found`),
          }
        }

        const fiberCommands = Array.from(fiber.commands.values())
          .filter(cmd => cmd.id !== 'identity') // Hide protocol-specific identity
          .map(cmd => ({
            id: cmd.id,
            description: cmd.description || 'No description',
            aliases: cmd.aliases || [],
          }))

        // Essential global commands always available
        const essentialGlobals = ['help', 'exit', 'clear', 'history', 'wallet', 'whoami', 'balance']
        const allCommands = registry.getAllCommands()
        const essentialCommands = allCommands
          .filter(cmd => cmd.scope === 'G_core' && essentialGlobals.includes(cmd.id))
          .map(cmd => ({
            id: cmd.id,
            description: cmd.description || 'No description',
            aliases: cmd.aliases || [],
          }))

        return {
          success: true,
          value: {
            message: `${fiber.name} Commands`,
            fiber: true,
            protocol: context.activeProtocol,
            protocolName: fiber.name,
            commands: fiberCommands,
            globals: essentialCommands,
            exitHint: 'Use "exit" to return to global context',
          },
        }
      }

      // In global context (M_G), show all commands
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
 * Chart command - Add charts to the analytics panel
 * Usage:
 *   chart btc - Add BTC price chart
 *   chart eth --line - Add ETH price chart (line mode)
 *   chart sol - Add SOL price chart
 *   chart performance - Add performance metrics chart
 *   chart network - Add network graph chart
 */
export const chartCommand: Command = {
  id: 'chart',
  scope: 'G_core',
  description: 'Add a chart to the analytics panel',
  aliases: ['c', 'add-chart'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const rawArgs = typeof args === 'string' ? args.trim() : ''
      const argTokens = rawArgs.split(/\s+/).filter(Boolean)

      if (argTokens.length === 0) {
        return {
          success: false,
          error: new Error('Usage: chart <symbol|type> [--line]\nExamples:\n  chart btc\n  chart eth --line\n  chart performance\n  chart network'),
        }
      }

      const chartType = argTokens[0].toLowerCase()
      const isLineMode = argTokens.includes('--line')

      // Validate chart type
      const validCharts = ['btc', 'eth', 'sol', 'performance', 'network', 'network-graph']
      if (!validCharts.includes(chartType)) {
        return {
          success: false,
          error: new Error(`Invalid chart type: ${chartType}\nValid types: ${validCharts.join(', ')}`),
        }
      }

      // Return chart request - CLI component will handle adding the chart
      return {
        success: true,
        value: {
          addChart: true,
          chartType,
          chartMode: isLineMode ? 'line' : 'candlestick',
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
 * Bridge command - Global alias for cross-chain bridging
 * Routes to the active protocol when possible, otherwise falls back to available bridge plugins
 */
export const bridgeAliasCommand: Command = {
  id: 'bridge',
  scope: 'G_alias',
  description: 'Bridge tokens cross-chain (use --protocol <stargate|wormhole|lifi> to specify)',
  aliases: ['br'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const rawArgs = typeof args === 'string' ? args : ''
      const argTokens = rawArgs.split(/\s+/).filter(Boolean)
      let explicitProtocolFromArgs: string | undefined
      const filteredTokens: string[] = []

      for (let i = 0; i < argTokens.length; i++) {
        const token = argTokens[i]
        if (token === '--protocol' && i + 1 < argTokens.length) {
          explicitProtocolFromArgs = argTokens[i + 1]
          i++ // Skip the protocol value
          continue
        }
        filteredTokens.push(token)
      }

      const sanitizedArgs = filteredTokens.join(' ')

      const candidateProtocols: string[] = []
      const seen = new Set<string>()
      const addProtocol = (protocol?: string) => {
        if (!protocol) return
        const normalized = protocol.trim().toLowerCase()
        if (!normalized || seen.has(normalized)) return
        candidateProtocols.push(normalized)
        seen.add(normalized)
      }

      addProtocol(explicitProtocolFromArgs)
      addProtocol(context.activeProtocol)
      addProtocol(context.protocolPreferences?.bridge)
      addProtocol('wormhole')
      addProtocol('lifi')
      addProtocol('stargate')
      for (const protocolId of registry.getProtocols()) {
        addProtocol(protocolId)
      }

      for (const protocol of candidateProtocols) {
        const fiber = registry.σ(protocol)
        if (!fiber) {
          continue
        }

        const bridgeCommand = fiber.commands.get('bridge')
        if (bridgeCommand) {
          return await bridgeCommand.run(sanitizedArgs, context)
        }
      }

      return {
        success: false,
        error: new Error('No bridge-capable protocol is currently loaded'),
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
  chartCommand,
]

/**
 * Global alias commands
 */
export const aliasCommands = [
  bridgeAliasCommand,
]

/**
 * Register all core commands with the registry
 */
export function registerCoreCommands(): void {
  for (const command of coreCommands) {
    registry.registerCoreCommand(command)
  }

  // Register alias commands
  for (const command of aliasCommands) {
    registry.registerAliasedCommand(command)
  }
}
