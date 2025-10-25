/**
 * Aave v3 Protocol Plugin
 */

import type { Plugin, PluginConfig } from '@/plugins'
import type { ProtocolFiber, ExecutionContext } from '@/core'
import { createProtocolFiber, addCommandToFiber } from '@/core'
import {
  marketsCommand,
  ratesCommand,
  positionCommand,
  healthCommand,
} from './commands'

export const aaveV3Plugin: Plugin = {
  metadata: {
    id: 'aave-v3',
    name: 'Aave v3',
    version: '0.1.0',
    description: 'Aave v3 lending protocol integration',
    author: 'DeFi Terminal',
    homepage: 'https://aave.com',
    tags: ['lending', 'borrow', 'collateral'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      defaultMarket: 'ethereum-v3',
    },
    credentials: {},
  },

  async initialize(_context: ExecutionContext): Promise<ProtocolFiber> {
    const fiber = createProtocolFiber(
      'aave-v3',
      'Aave v3 Lending',
      'Aave v3 supply, borrow and analytics commands'
    )

    addCommandToFiber(fiber, marketsCommand)
    addCommandToFiber(fiber, ratesCommand)
    addCommandToFiber(fiber, positionCommand)
    addCommandToFiber(fiber, healthCommand)

    return fiber
  },

  async cleanup(_context: ExecutionContext): Promise<void> {
    // Nothing to clean up yet
  },

  validateConfig(_config: PluginConfig): boolean {
    // All configuration is optional for now
    return true
  },

  async healthCheck(_context: ExecutionContext): Promise<boolean> {
    try {
      const response = await fetch('https://aave.com/api/markets-data/markets', {
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
