/**
 * Faucet Plugin
 *
 * Provides testnet token distribution functionality
 */

import type { Plugin, PluginConfig } from '@/plugins'
import type { ProtocolFiber, ExecutionContext } from '@/core'
import { createProtocolFiber } from '@/core'
import { requestCommand, statusCommand, historyCommand } from './commands'
import { faucetHandlers } from './handlers'

export const faucetPlugin: Plugin = {
  metadata: {
    id: 'faucet',
    name: 'Faucet',
    version: '1.0.0',
    description: 'Request testnet tokens for Sepolia, Holesky, and Optimism Sepolia',
    author: 'DeFi Terminal',
    homepage: 'https://github.com/your-repo/defi-terminal',
    tags: ['testnet', 'faucet', 'tokens'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      supportedNetworks: ['sepolia', 'holesky', 'optimism-sepolia'],
    },
    credentials: {},
  },

  handlers: faucetHandlers,

  async initialize(_context: ExecutionContext): Promise<ProtocolFiber> {
    const fiber = createProtocolFiber(
      'faucet',
      'Testnet Faucet',
      'Request testnet tokens for development'
    )

    // Commands are registered as G_core, so they should not be added to a G_p fiber.

    return fiber
  },

  async cleanup(_context: ExecutionContext): Promise<void> {
    // Nothing to clean up
  },

  validateConfig(config: PluginConfig): boolean {
    // Validate that supportedNetworks is an array if present
    if (config.config.supportedNetworks) {
      return Array.isArray(config.config.supportedNetworks)
    }
    return true
  },

  async healthCheck(_context: ExecutionContext): Promise<boolean> {
    try {
      // Check if faucet config endpoint is accessible
      const response = await fetch('/api/faucet/config', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
        },
      })
      return response.ok
    } catch {
      return false
    }
  },
}

// Re-export commands for direct use if needed
export { requestCommand, statusCommand, historyCommand }
export * from './types'
