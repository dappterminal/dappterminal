/**
 * Faucet Handlers
 *
 * Transaction handlers for the faucet plugin
 * (Currently no special handling needed as faucet distributes tokens automatically)
 */

import type { HandlerRegistry } from '@/core'

export const faucetHandlers: HandlerRegistry = {
  // Faucet doesn't require user-side transaction handling
  // Tokens are sent automatically by the backend
}
