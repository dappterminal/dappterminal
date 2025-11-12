/**
 * CoinPaprika Plugin
 *
 * Cryptocurrency data provider with 56,000+ coins
 * Source: CoinPaprika API (https://coinpaprika.com)
 */

import type { ExecutionContext, ProtocolFiber } from '@/core'
import { createProtocolFiber, addCommandToFiber } from '@/core'
import type { Plugin } from '@/plugins/types'
import { cpriceCommand, coinsearchCommand, cchartCommand } from './commands'
import { coinRegistry } from './data/coin-registry'

export const coinpaprikaPlugin: Plugin = {
  metadata: {
    id: 'coinpaprika',
    name: 'CoinPaprika',
    version: '1.0.0',
    description: 'Cryptocurrency data provider with 56,000+ coins',
    author: 'DappTerminal',
    tags: ['data', 'pricing', 'market-data'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      cacheEnabled: true,
      cacheTTL: 86400000, // 24 hours
      activeOnly: true, // Default to active coins only
    },
    credentials: {},
  },

  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    console.log('[CoinPaprika Plugin] Initializing...')

    // Create protocol fiber
    const fiber = createProtocolFiber(
      'coinpaprika',
      'CoinPaprika',
      'Cryptocurrency data with 56K+ coins'
    )

    // Add commands to fiber
    addCommandToFiber(fiber, cpriceCommand)
    addCommandToFiber(fiber, coinsearchCommand)
    addCommandToFiber(fiber, cchartCommand)

    // Preload coin registry (lazy load on first use)
    // This will happen automatically when first command is executed
    coinRegistry.initialize().catch((error) => {
      console.error('[CoinPaprika Plugin] Failed to initialize registry:', error)
    })

    console.log('[CoinPaprika Plugin] Initialized successfully')
    console.log('[CoinPaprika Plugin] Commands: cprice, coinsearch, cchart')

    return fiber
  },

  async cleanup(): Promise<void> {
    console.log('[CoinPaprika Plugin] Cleaning up...')
    // No cleanup needed for now
  },

  async healthCheck(): Promise<boolean> {
    try {
      // Check if registry can be initialized
      await coinRegistry.initialize()

      // Check if API is reachable (simple ping)
      const response = await fetch('https://api.coinpaprika.com/v1/global', {
        method: 'HEAD',
      })

      return response.ok
    } catch (error) {
      console.error('[CoinPaprika Plugin] Health check failed:', error)
      return false
    }
  },
}

export * from './types'
export * from './commands'
export { coinRegistry } from './data/coin-registry'
export { coinPaprikaClient } from './api/client'
