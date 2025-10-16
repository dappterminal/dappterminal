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
   * Creates the protocol fiber and registers commands
   */
  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    // Create the protocol fiber (M_P)
    const fiber = createProtocolFiber(
      'template-protocol',
      'Template Protocol',
      'Template for protocol plugins'
    )

    // Add commands to the fiber
    addCommandToFiber(fiber, quoteCommand)
    addCommandToFiber(fiber, swapCommand)
    addCommandToFiber(fiber, liquidityCommand)

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
