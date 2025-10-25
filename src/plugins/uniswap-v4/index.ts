/**
 * Uniswap V4 Plugin
 *
 * Decentralized exchange integration for single-hop swaps on Uniswap V4
 */

import type { Plugin } from '../types'
import type { ExecutionContext, ProtocolFiber } from '@/core/types'
import { createProtocolFiber, addCommandToFiber } from '@/core/monoid'
import { swapCommand } from './commands'
import { uniswapV4Handlers } from './handlers'

export const uniswapV4Plugin: Plugin = {
  metadata: {
    id: 'uniswap-v4',
    name: 'Uniswap V4',
    version: '1.0.0',
    description: 'Single-hop swaps on Uniswap V4 DEX',
    tags: ['dex', 'swap', 'uniswap', 'v4'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      // Default slippage tolerance (50 bps = 0.5%)
      defaultSlippageBps: 50,
      // Default deadline (20 minutes)
      defaultDeadlineSeconds: 1200,
      // Supported chains
      supportedChains: [1, 8453, 42161, 10], // Ethereum, Base, Arbitrum, Optimism
    },
  },

  // Command execution handlers
  handlers: uniswapV4Handlers,

  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    // Create protocol fiber with automatic identity injection
    const fiber = createProtocolFiber(
      'uniswap-v4',
      'Uniswap V4',
      'Single-hop swaps on Uniswap V4 DEX'
    )

    // Register commands
    addCommandToFiber(fiber, swapCommand)

    // Initialize protocol state
    if (!context.protocolState) {
      context.protocolState = new Map()
    }
    context.protocolState.set('uniswap-v4', {})

    return fiber
  },
}

// Export plugin for registration
export default uniswapV4Plugin
