/**
 * LiFi Plugin
 *
 * Bridge aggregator integration for cross-chain transfers
 */

import type { Plugin, PluginConfig } from '../types'
import type { ExecutionContext, ProtocolFiber } from '@/core/types'
import { createProtocolFiber, addCommandToFiber } from '@/core/monoid'
import {
  healthCommand,
  quoteCommand,
  routesCommand,
  bridgeCommand,
  executeCommand,
  prepareStepCommand,
  chainsCommand,
  statusCommand,
} from './commands'
import { lifiHandlers } from './handlers'

export const lifiPlugin: Plugin = {
  metadata: {
    id: 'lifi',
    name: 'LiFi Bridge',
    version: '1.0.0',
    description: 'Cross-chain bridge aggregator powered by LiFi',
    tags: ['bridge', 'cross-chain', 'aggregator', 'lifi'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      // API proxy base URL (defaults to /api/lifi)
      apiBaseUrl: '/api/lifi',
      // Default slippage tolerance (0.5%)
      defaultSlippage: 0.5,
      // Route refresh interval (5 minutes)
      quoteExpiryMs: 5 * 60 * 1000,
    },
  },

  // Command execution handlers
  handlers: lifiHandlers,

  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    // Create protocol fiber with automatic identity injection
    const fiber = createProtocolFiber(
      'lifi',
      'LiFi Bridge',
      'Cross-chain bridge aggregator powered by LiFi'
    )

    // Register commands
    addCommandToFiber(fiber, healthCommand as any)
    addCommandToFiber(fiber, quoteCommand as any)
    addCommandToFiber(fiber, routesCommand as any)
    addCommandToFiber(fiber, bridgeCommand as any)
    addCommandToFiber(fiber, executeCommand as any)
    addCommandToFiber(fiber, prepareStepCommand as any)
    addCommandToFiber(fiber, chainsCommand as any)
    addCommandToFiber(fiber, statusCommand as any)

    // Initialize protocol state
    if (!context.protocolState) {
      context.protocolState = new Map()
    }
    context.protocolState.set('lifi', {})

    return fiber
  },
}

// Export plugin for registration
export default lifiPlugin
