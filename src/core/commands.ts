/**
 * Core global commands (G_core scope)
 *
 * These commands are protocol-agnostic and available globally
 */

import type { Command, CommandResult, ExecutionContext } from './types'
import { registry as globalRegistry, type CommandRegistry } from './command-registry'
import { requestCommand, statusCommand, historyCommand as faucetHistoryCommand } from '@/plugins/faucet'
import { cpriceCommand, coinsearchCommand, cchartCommand } from '@/plugins/coinpaprika'

function withExecutionMetadata(
  result: CommandResult,
  executedProtocol: string,
  executedCommandId: string
): CommandResult {
  if (!result.success) {
    return result
  }

  if (typeof result.value !== 'object' || result.value === null || Array.isArray(result.value)) {
    return result
  }

  return {
    success: true,
    value: {
      ...(result.value as Record<string, unknown>),
      executedProtocol,
      executedCommandId,
    },
  }
}

function getRegistry(context: ExecutionContext): CommandRegistry {
  const scopedRegistry = context.globalState?.commandRegistry
  if (scopedRegistry && typeof scopedRegistry === 'object') {
    return scopedRegistry as CommandRegistry
  }

  return globalRegistry
}

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
        const registry = getRegistry(context)
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
      const registry = getRegistry(context)
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
      const registry = getRegistry(_context)
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
      const registry = getRegistry(context)
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
 *   chart wbtc - Add WBTC price chart
 *   chart eth --line - Add ETH price chart (line mode)
 *   chart btc --protocol coinpaprika - Add BTC chart from CoinPaprika
 *   chart pepe --protocol 1inch - Add PEPE chart from 1inch
 *   chart pepe --protocol dexscreener - Add PEPE chart from DexScreener
 *   chart performance - Add performance metrics chart
 *   chart network - Add network graph chart
 *   chart portfolio [address] [chainIds] - Add portfolio pie chart
 *   chart portfolio 0x742d35Cc... - View specific address's portfolio
 *   chart portfolio vitalik.eth - View ENS name's portfolio
 *   chart balances [address] [chainIds] - Add portfolio pie chart (alias)
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
          error: new Error('Usage: chart <symbol|type> [options]\nExamples:\n  chart wbtc\n  chart eth --line\n  chart pepe --protocol 1inch\n  chart btc --protocol coinpaprika\n  chart performance\n  chart network\n  chart portfolio [address] [chainIds]\n  chart portfolio 0x742d35Cc...\n  chart portfolio vitalik.eth\n  chart balances 1,8453,42161'),
        }
      }

      const chartType = argTokens[0].toLowerCase()
      const isLineMode = argTokens.includes('--line')

      // Parse --protocol flag (or use active protocol context)
      let explicitProtocol: string | undefined
      const filteredTokens: string[] = []
      for (let i = 0; i < argTokens.length; i++) {
        const token = argTokens[i]
        if (token === '--protocol' && i + 1 < argTokens.length) {
          explicitProtocol = argTokens[i + 1]
          i++ // Skip the protocol value
          continue
        }
        if (token !== '--line') {
          filteredTokens.push(token)
        }
      }

      // If no explicit protocol specified, use the active protocol context
      if (!explicitProtocol && context.activeProtocol) {
        explicitProtocol = context.activeProtocol
      }

      // Handle portfolio/balances chart
      if (chartType === 'portfolio' || chartType === 'balances') {
        // Parse chain IDs and optional address from arguments
        let chainIds: number[] = []
        let walletAddress: string | undefined

        // Look for arguments
        if (argTokens.length > 1) {
          const secondArg = argTokens[1]

          // Check if it's an Ethereum address (0x followed by 40 hex chars) or ENS name
          if (/^0x[a-fA-F0-9]{40}$/.test(secondArg) || /\.eth$/.test(secondArg)) {
            walletAddress = secondArg

            // If there's a third argument, it might be chain IDs
            if (argTokens.length > 2 && /^[\d,\s]+$/.test(argTokens[2])) {
              try {
                chainIds = argTokens[2].split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
              } catch (error) {
                // Ignore parsing errors, will use defaults
              }
            }
          }
          // Check if it's comma-separated chain IDs
          else if (/^[\d,\s]+$/.test(secondArg)) {
            try {
              chainIds = secondArg.split(',').map(id => parseInt(id.trim())).filter(id => !isNaN(id))
            } catch (error) {
              return {
                success: false,
                error: new Error('Failed to parse chain IDs. Use comma-separated numbers (e.g., "1,8453,42161")'),
              }
            }
          }
        }

        // Validate chain IDs if provided
        if (chainIds.length > 0) {
          const validChainIds = [1, 10, 137, 8453, 42161]
          const invalidChains = chainIds.filter(id => !validChainIds.includes(id))

          if (invalidChains.length > 0) {
            return {
              success: false,
              error: new Error(
                `Invalid chain IDs: ${invalidChains.join(', ')}\n` +
                `Valid chain IDs: 1 (Ethereum), 10 (Optimism), 137 (Polygon), 8453 (Base), 42161 (Arbitrum)`
              ),
            }
          }
        }

        // If no chain IDs specified, use current connected chain or default to Ethereum
        if (chainIds.length === 0) {
          chainIds = context.wallet.chainId ? [context.wallet.chainId] : [1]
        }

        // If no address provided, use connected wallet address
        if (!walletAddress) {
          // Check if wallet is connected
          if (!context.wallet.isConnected || !context.wallet.address) {
            return {
              success: false,
              error: new Error('Wallet not connected. Please connect your wallet or provide an address (e.g., "chart portfolio 0x...")'),
            }
          }
          walletAddress = context.wallet.address
        }

        // Return portfolio chart request
        return {
          success: true,
          value: {
            addChart: true,
            chartType: 'portfolio',
            chainIds,
            walletAddress,
          },
        }
      }

      // Validate chart type or search for token if protocol is specified
      const validCharts = ['wbtc', 'eth', 'performance', 'network', 'network-graph', 'portfolio', 'balances']

      // If token is not in valid charts and --protocol coinpaprika is specified, route to cchart
      if (!validCharts.includes(chartType) && explicitProtocol === 'coinpaprika') {
        const registry = getRegistry(context)
        const allCommands = registry.getAllCommands()
        const cchartCmd = allCommands.find((cmd: Command) => cmd.id === 'cchart')

        if (cchartCmd) {
          // Build args for cchart command
          const cchartArgs = isLineMode ? `${chartType} --line` : chartType
          return await cchartCmd.run(cchartArgs, context)
        } else {
          return {
            success: false,
            error: new Error('CoinPaprika plugin not loaded. Please ensure coinpaprika plugin is enabled.'),
          }
        }
      }

      // If token is not in valid charts and --protocol dexscreener is specified, fetch pair data
      if (!validCharts.includes(chartType) && explicitProtocol === 'dexscreener') {
        try {
          const searchUrl = `/api/dexscreener/pairs?q=${encodeURIComponent(chartType)}`
          const response = await fetch(searchUrl)

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            return {
              success: false,
              error: new Error(errorData.error || `Failed to search for token '${chartType}'`),
            }
          }

          const data = await response.json()

          if (!data.pairs || data.pairs.length === 0) {
            return {
              success: false,
              error: new Error(`No DEX pairs found for '${chartType}' on DexScreener`),
            }
          }

          // Pick the highest-liquidity pair
          const pair = data.pairs.reduce((best: any, p: any) =>
            (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
          , data.pairs[0])

          return {
            success: true,
            value: {
              addChart: true,
              chartType: pair.baseToken?.address || chartType,
              symbol: pair.baseToken?.symbol || chartType.toUpperCase(),
              name: pair.baseToken?.name,
              chartMode: isLineMode ? 'line' : 'candlestick',
              protocol: 'dexscreener',
              dexscreenerPair: pair,
            },
          }
        } catch (error) {
          return {
            success: false,
            error: new Error(`Failed to search DexScreener: ${error instanceof Error ? error.message : String(error)}`),
          }
        }
      }

      // If token is not in valid charts and --protocol 1inch is specified, search for it
      if (!validCharts.includes(chartType) && explicitProtocol === '1inch') {
        try {
          const chainId = context.wallet.chainId || 1
          const searchUrl = `/api/1inch/tokens/search?query=${encodeURIComponent(chartType)}&chainId=${chainId}`

          const response = await fetch(searchUrl)

          if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
            return {
              success: false,
              error: new Error(errorData.error || `Failed to search for token '${chartType}'`),
            }
          }

          const tokenData = await response.json()

          // Return chart request with contract address
          return {
            success: true,
            value: {
              addChart: true,
              chartType: tokenData.address, // Use contract address
              symbol: tokenData.symbol, // Original symbol for display
              name: tokenData.name, // Full token name
              chartMode: isLineMode ? 'line' : 'candlestick',
              protocol: '1inch',
            },
          }
        } catch (error) {
          return {
            success: false,
            error: new Error(`Failed to search for token: ${error instanceof Error ? error.message : String(error)}`),
          }
        }
      }

      if (!validCharts.includes(chartType)) {
        return {
          success: false,
          error: new Error(`Invalid chart type: ${chartType}\nValid types: ${validCharts.join(', ')}\nOr use --protocol <1inch|coinpaprika|dexscreener> to search for any token`),
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
 * Swap command - Global alias for token swaps
 * Routes to the active protocol when possible, otherwise falls back to available swap plugins
 */
export const swapAliasCommand: Command = {
  id: 'swap',
  scope: 'G_alias',
  description: 'Swap tokens (use --protocol <1inch|uniswap-v4> to specify)',
  aliases: ['s'],

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
      addProtocol(context.protocolPreferences?.swap)
      addProtocol('uniswap-v4')
      addProtocol('1inch')
      const registry = getRegistry(context)
      for (const protocolId of registry.getProtocols()) {
        addProtocol(protocolId)
      }

      for (const protocol of candidateProtocols) {
        const fiber = registry.σ(protocol)
        if (!fiber) {
          continue
        }

        const swapCommand = fiber.commands.get('swap')
        if (swapCommand) {
          const result = await swapCommand.run(sanitizedArgs, context)
          return withExecutionMetadata(result, protocol, swapCommand.id)
        }
      }

      return {
        success: false,
        error: new Error('No swap-capable protocol is currently loaded'),
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
      const registry = getRegistry(context)
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
          const result = await bridgeCommand.run(sanitizedArgs, context)
          return withExecutionMetadata(result, protocol, bridgeCommand.id)
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
 * Price command - Global alias for token prices
 * Routes to the active protocol when possible, otherwise falls back to available price sources
 */
export const priceAliasCommand: Command = {
  id: 'price',
  scope: 'G_alias',
  description: 'Get token price (use --protocol <1inch|coinpaprika|dexscreener> to specify)',
  aliases: ['p'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const rawArgs = typeof args === 'string' ? args : ''
      const argTokens = rawArgs.split(/\s+/).filter(Boolean)
      let explicitProtocolFromArgs: string | undefined
      const filteredTokens: string[] = []

      // Parse --protocol flag
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

      // Build priority list of protocols to try
      const candidateProtocols: string[] = []
      const seen = new Set<string>()
      const addProtocol = (protocol?: string) => {
        if (!protocol) return
        const normalized = protocol.trim().toLowerCase()
        if (!normalized || seen.has(normalized)) return
        candidateProtocols.push(normalized)
        seen.add(normalized)
      }

      // Priority order:
      // 1. Explicit --protocol flag
      // 2. Active protocol
      // 3. User preference
      // 4. Default: 1inch
      // 5. Fallback: coinpaprika
      addProtocol(explicitProtocolFromArgs)
      addProtocol(context.activeProtocol)
      addProtocol(context.protocolPreferences?.price)
      addProtocol('1inch')
      addProtocol('coinpaprika')
      addProtocol('dexscreener')

      // Try each protocol in order
      const registry = getRegistry(context)
      for (const protocol of candidateProtocols) {
        // For coinpaprika, use the cprice command directly
        if (protocol === 'coinpaprika') {
          const allCommands = registry.getAllCommands()
          const cpriceCmd = allCommands.find(cmd => cmd.id === 'cprice')
          if (cpriceCmd) {
            const result = await cpriceCmd.run(sanitizedArgs, context)
            return withExecutionMetadata(result, protocol, cpriceCmd.id)
          }
          continue
        }

        // For dexscreener, use the dprice command directly
        if (protocol === 'dexscreener') {
          const allCommands = registry.getAllCommands()
          const dpriceCmd = allCommands.find(cmd => cmd.id === 'dprice')
          if (dpriceCmd) {
            const result = await dpriceCmd.run(sanitizedArgs, context)
            return withExecutionMetadata(result, protocol, dpriceCmd.id)
          }
          continue
        }

        // For other protocols, look for price command in their fiber
        const fiber = registry.σ(protocol)
        if (!fiber) {
          continue
        }

        const priceCommand = fiber.commands.get('price')
        if (priceCommand) {
          const result = await priceCommand.run(sanitizedArgs, context)
          return withExecutionMetadata(result, protocol, priceCommand.id)
        }
      }

      return {
        success: false,
        error: new Error('No price-capable protocol is currently loaded'),
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
 * DexScreener price command - Get DEX token price
 *
 * Usage: dprice <symbol>
 * Example: dprice ETH
 */
export const dpriceCommand: Command = {
  id: 'dprice',
  scope: 'G_core',
  description: 'Get DEX token price from DexScreener',

  async run(args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const symbol = argsStr.split(' ')[0]

      if (!symbol) {
        return {
          success: false,
          error: new Error(
            'Usage: dprice <symbol>\nExample: dprice ETH\n         dprice PEPE'
          ),
        }
      }

      const response = await fetch(`/api/dexscreener/pairs?q=${encodeURIComponent(symbol)}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!data.pairs || data.pairs.length === 0) {
        return {
          success: false,
          error: new Error(
            `No DEX pairs found for '${symbol.toUpperCase()}'.\n\nTry searching: dpairs ${symbol}`
          ),
        }
      }

      // Pick the highest-liquidity pair
      const pair = data.pairs.reduce((best: any, p: any) =>
        (p.liquidity?.usd || 0) > (best.liquidity?.usd || 0) ? p : best
      , data.pairs[0])

      const price = parseFloat(pair.priceUsd) || 0
      const change24h = pair.priceChange?.h24 || 0
      const volume24h = pair.volume?.h24 || 0
      const liquidity = pair.liquidity?.usd || 0

      const formatNumber = (num: number): string => {
        if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
      }

      const formatPrice = (p: number): string => {
        if (p >= 1) return `$${p.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        if (p >= 0.01) return `$${p.toFixed(4)}`
        if (p >= 0.0001) return `$${p.toFixed(6)}`
        return `$${p.toExponential(4)}`
      }

      const changeSign = change24h >= 0 ? '+' : ''

      return {
        success: true,
        value: {
          message: [
            `${change24h >= 0 ? '📈' : '📉'} ${pair.baseToken?.name || symbol.toUpperCase()} (${pair.baseToken?.symbol || symbol.toUpperCase()})`,
            ``,
            `  Price: ${formatPrice(price)}`,
            `  24h Change: ${changeSign}${change24h.toFixed(2)}%`,
            `  Volume (24h): ${formatNumber(volume24h)}`,
            `  Liquidity: ${formatNumber(liquidity)}`,
            `  DEX: ${pair.dexId} | Chain: ${pair.chainId}`,
            `  Pair: ${pair.baseToken?.symbol}/${pair.quoteToken?.symbol}`,
            ``,
            `  Source: DexScreener`,
          ].join('\n'),
          pair,
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        error: new Error(`Failed to fetch DEX price: ${errorMsg}`),
      }
    }
  },
}

/**
 * DexScreener pairs search command - Search DEX pairs
 *
 * Usage: dpairs <symbol>
 * Example: dpairs PEPE
 */
export const dpairsCommand: Command = {
  id: 'dpairs',
  scope: 'G_core',
  description: 'Search DEX pairs on DexScreener',

  async run(args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    try {
      const argsStr = typeof args === 'string' ? args.trim() : ''
      const query = argsStr.split(' ')[0]

      if (!query) {
        return {
          success: false,
          error: new Error(
            'Usage: dpairs <symbol>\nExample: dpairs PEPE\n         dpairs ETH'
          ),
        }
      }

      const response = await fetch(`/api/dexscreener/pairs?q=${encodeURIComponent(query)}`)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP ${response.status}`)
      }

      const data = await response.json()

      if (!data.pairs || data.pairs.length === 0) {
        return {
          success: false,
          error: new Error(
            `No DEX pairs found for '${query}'.\n\nTry a different search term.`
          ),
        }
      }

      const formatNumber = (num: number): string => {
        if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`
        if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`
        if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`
        return `$${num.toFixed(2)}`
      }

      // Show top 10 pairs
      const pairs = data.pairs.slice(0, 10)
      const formattedPairs = pairs.map((pair: any, index: number) => {
        const price = parseFloat(pair.priceUsd) || 0
        const vol = pair.volume?.h24 || 0
        const liq = pair.liquidity?.usd || 0
        const priceStr = price >= 1 ? `$${price.toFixed(2)}` : price >= 0.0001 ? `$${price.toFixed(6)}` : `$${price.toExponential(2)}`
        return `  ${index + 1}. ${pair.baseToken?.symbol}/${pair.quoteToken?.symbol} on ${pair.dexId} (${pair.chainId})\n     Price: ${priceStr} | Vol: ${formatNumber(vol)} | Liq: ${formatNumber(liq)}`
      })

      return {
        success: true,
        value: {
          message: [
            `🔍 DEX pairs for '${query}' (top ${pairs.length}):`,
            ``,
            ...formattedPairs,
            ``,
            `💡 Use 'dprice <symbol>' to get detailed price data`,
          ].join('\n'),
          pairs,
        },
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error)
      return {
        success: false,
        error: new Error(`Failed to search DEX pairs: ${errorMsg}`),
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
  // Faucet commands
  requestCommand,
  statusCommand,
  faucetHistoryCommand,
  // CoinPaprika commands
  cpriceCommand,
  coinsearchCommand,
  cchartCommand,
  // DexScreener commands
  dpriceCommand,
  dpairsCommand,
]

/**
 * Global alias commands
 */
export const aliasCommands = [
  swapAliasCommand,
  bridgeAliasCommand,
  priceAliasCommand,
]

/**
 * Register all core commands with the registry
 */
export function registerCoreCommands(registry: CommandRegistry = globalRegistry): void {
  for (const command of coreCommands) {
    registry.registerCoreCommand(command as Command<unknown, unknown>)
  }

  // Register alias commands
  for (const command of aliasCommands) {
    registry.registerAliasedCommand(command as Command<unknown, unknown>)
  }
}
