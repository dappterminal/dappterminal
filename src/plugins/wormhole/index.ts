/**
 * Wormhole Protocol Plugin
 */

import type { Plugin, PluginConfig } from '@/plugins'
import type { ProtocolFiber, ExecutionContext } from '@/core'
import { createProtocolFiber, addCommandToFiber } from '@/core'
import { quoteCommand, routesCommand, bridgeCommand } from './commands'

/**
 * Wormhole Plugin
 */
export const wormholePlugin: Plugin = {
  metadata: {
    id: 'wormhole',
    name: 'Wormhole Bridge',
    version: '1.0.0',
    description: 'Cross-chain token bridge via Wormhole protocol',
    author: 'DeFi Terminal',
    homepage: 'https://wormhole.com',
    tags: ['bridge', 'cross-chain', 'wormhole'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      network: 'Mainnet',
    },
  },

  /**
   * Initialize the plugin
   */
  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    // Create the protocol fiber (M_P)
    const fiber = createProtocolFiber(
      'wormhole',
      'Wormhole Bridge',
      'Cross-chain token bridge via Wormhole protocol'
    )

    // Add commands to the fiber
    addCommandToFiber(fiber, quoteCommand)
    addCommandToFiber(fiber, routesCommand)
    addCommandToFiber(fiber, bridgeCommand)

    return fiber
  },

  /**
   * Cleanup plugin resources
   */
  async cleanup(context: ExecutionContext): Promise<void> {
    // Nothing to cleanup for now
  },

  /**
   * Validate plugin configuration
   */
  validateConfig(config: PluginConfig): boolean {
    return true
  },

  /**
   * Health check
   */
  async healthCheck(context: ExecutionContext): Promise<boolean> {
    return true
  },
}
