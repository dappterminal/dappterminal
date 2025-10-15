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
            commands: Array.from(fiber?.commands.values() || []).map(cmd => ({
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

  async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    return {
      success: true,
      value: {
        name: 'The DeFi Terminal',
        version: '0.1.0',
        architecture: 'Fibered Monoid',
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
  historyCommand,
  clearCommand,
  versionCommand,
]

/**
 * Register all core commands with the registry
 */
export function registerCoreCommands(): void {
  for (const command of coreCommands) {
    registry.registerCoreCommand(command)
  }
}
