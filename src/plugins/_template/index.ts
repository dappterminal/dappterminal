/**
 * Template Plugin
 *
 * This is a template for creating new protocol plugins.
 * Copy this directory and customize for your protocol.
 */

import type { Plugin, PluginConfig } from '@/plugins'
import type { ProtocolFiber, ExecutionContext, Command } from '@/core'
import { createProtocolFiber, addCommandToFiber } from '@/core'
import { quoteCommand, swapCommand, liquidityCommand } from './commands'

/**
 * Plugin metadata
 */
export const templatePlugin: Plugin = {
  metadata: {
    id: 'template-protocol',
    name: 'Template Protocol',
    version: '1.0.0',
    description: 'Template for protocol plugins',
    author: 'Your Name',
    homepage: 'https://github.com/yourorg/your-protocol',
    tags: ['dex', 'swap', 'defi'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      // Protocol-specific configuration
      rpcUrl: 'https://mainnet.infura.io/v3/YOUR-API-KEY',
      chainId: 1,
    },
    credentials: {
      // API keys or other credentials
      // apiKey: 'your-api-key',
    },
  },

  /**
   * Initialize the plugin
   * Creates the protocol fiber (submonoid) and registers commands
   *
   * Protocol Fiber (Submonoid):
   * The fiber M_P you create is a proper mathematical submonoid:
   * - Contains your protocol-specific commands (scope G_p, protocol: P)
   * - Contains protocol-specific identity element (automatically added)
   * - Closed under composition: composing two fiber commands stays in the fiber
   * - Preserves protocol-specific state during composition
   *
   * Identity Element:
   * - createProtocolFiber() automatically adds a protocol-specific identity
   * - This identity has scope: 'G_p' and protocol: 'template-protocol'
   * - It preserves your protocol's state in ExecutionContext.protocolState
   * - You don't need to manually add identity - it's already there!
   *
   * Why Protocol-Specific Identity:
   * - Maintains protocol "session" during composition chains
   * - Preserves protocol state (connection pools, caches, rate limits)
   * - Ensures type safety: YourProtocol:TokenA → YourProtocol:TokenA
   * - Makes M_P a true submonoid, not just a semigroup
   */
  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    // Create the protocol fiber (M_P)
    // This automatically includes a protocol-specific identity element
    const fiber = createProtocolFiber(
      'template-protocol',
      'Template Protocol',
      'Template for protocol plugins'
    )

    // Add your protocol-specific commands to the fiber
    // Each command must have: scope: 'G_p' and protocol: 'template-protocol'
    addCommandToFiber(fiber, quoteCommand)
    addCommandToFiber(fiber, swapCommand)
    addCommandToFiber(fiber, liquidityCommand)

    // The fiber now contains: identity, quote, swap, liquidity
    // All are in M_P with scope: 'G_p' and protocol: 'template-protocol'

    // Composing commands within the fiber stays in the fiber:
    // compose(swapCommand, liquidityCommand).protocol === 'template-protocol' ✓
    // compose(identityCommand_P, swapCommand).protocol === 'template-protocol' ✓

    // Perform any protocol-specific initialization
    // e.g., connect to RPC, initialize SDK, etc.

    return fiber
  },

  /**
   * Cleanup plugin resources
   */
  async cleanup(context: ExecutionContext): Promise<void> {
    // Cleanup any resources
    // e.g., disconnect from RPC, close connections, etc.
  },

  /**
   * Validate plugin configuration
   */
  validateConfig(config: PluginConfig): boolean {
    // Validate configuration
    if (!config.config.rpcUrl) {
      return false
    }
    return true
  },

  /**
   * Health check
   */
  async healthCheck(context: ExecutionContext): Promise<boolean> {
    try {
      // Check if the protocol is accessible
      // e.g., ping RPC, check API status, etc.
      return true
    } catch {
      return false
    }
  },
}
