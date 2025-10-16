/**
 * 1inch Protocol Plugin
 */

import type { Plugin, PluginConfig } from '@/plugins'
import type { ProtocolFiber, ExecutionContext } from '@/core'
import { createProtocolFiber, addCommandToFiber } from '@/core'
import { priceCommand, gasCommand, swapCommand } from './commands'

/**
 * 1inch Plugin
 */
export const oneInchPlugin: Plugin = {
  metadata: {
    id: '1inch',
    name: '1inch Aggregator',
    version: '1.0.0',
    description: 'DEX aggregator with best swap rates across multiple protocols',
    author: 'DeFi Terminal',
    homepage: 'https://1inch.io',
    tags: ['dex', 'aggregator', 'swap'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      supportedChains: [1, 10, 137, 42161, 8453, 56, 43114],
    },
    credentials: {
      apiKey: process.env.ONEINCH_API_KEY || '',
    },
  },

  /**
   * Initialize the plugin
   */
  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    // Create the protocol fiber (M_P)
    const fiber = createProtocolFiber(
      '1inch',
      '1inch Aggregator',
      'DEX aggregator with best swap rates'
    )

    // Add commands to the fiber
    addCommandToFiber(fiber, priceCommand)
    addCommandToFiber(fiber, gasCommand)
    addCommandToFiber(fiber, swapCommand)

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
    if (!config.credentials?.apiKey) {
      console.warn('1inch: API key not configured. Some features may be limited.')
    }
    return true
  },

  /**
   * Health check
   */
  async healthCheck(context: ExecutionContext): Promise<boolean> {
    try {
      // Ping 1inch gas price API
      const response = await fetch('https://api.1inch.dev/gas-price/v1.6/1', {
        headers: {
          'Authorization': `Bearer ${process.env.ONEINCH_API_KEY || ''}`,
        },
      })
      return response.ok
    } catch {
      return false
    }
  },
}
