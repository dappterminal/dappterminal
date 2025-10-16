/**
 * Stargate Protocol Plugin
 */

import type { Plugin, PluginConfig } from '@/plugins'
import type { ProtocolFiber, ExecutionContext } from '@/core'
import { createProtocolFiber, addCommandToFiber } from '@/core'
import { bridgeCommand } from './commands'

/**
 * Stargate Bridge Plugin
 */
export const stargatePlugin: Plugin = {
  metadata: {
    id: 'stargate',
    name: 'Stargate Bridge',
    version: '1.0.0',
    description: 'LayerZero-powered cross-chain stablecoin bridge',
    author: 'DeFi Terminal',
    homepage: 'https://stargate.finance',
    tags: ['bridge', 'layerzero', 'stablecoins', 'cross-chain'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      supportedChains: [1, 10, 137, 42161, 8453, 56, 43114],
    },
    credentials: {},
  },

  /**
   * Initialize the plugin
   */
  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    // Create the protocol fiber (M_stargate)
    const fiber = createProtocolFiber(
      'stargate',
      'Stargate Bridge',
      'Cross-chain stablecoin bridge via LayerZero'
    )

    // Add bridge command to the fiber
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
    // No special configuration required for Stargate
    return true
  },

  /**
   * Health check
   */
  async healthCheck(context: ExecutionContext): Promise<boolean> {
    try {
      // Ping Stargate API to check availability
      const response = await fetch('https://stargate.finance/api/v1/quotes?srcChainKey=base&dstChainKey=arbitrum&srcToken=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913&dstToken=0xaf88d065e77c8cC2239327C5EDb3A432268e5831&srcAmount=1000000&dstAmountMin=995000&srcAddress=0x0000000000000000000000000000000000000000&dstAddress=0x0000000000000000000000000000000000000000', {
        method: 'GET',
      })
      return response.ok
    } catch {
      return false
    }
  },
}
