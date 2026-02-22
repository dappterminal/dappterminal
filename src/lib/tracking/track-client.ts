/**
 * Client-safe swap transaction tracking.
 *
 * Plugin handlers run in the browser and cannot use Prisma directly.
 * This module sends the tracking data to the server-side API route
 * which handles the actual DB insert.
 */

import type { SwapTransactionData } from './types'

/**
 * Track a swap/bridge transaction via the server API.
 * Fire-and-forget — errors are logged but never thrown so tracking
 * never breaks the user's swap flow.
 */
export function trackSwap(data: SwapTransactionData): void {
  // Serialise BigInt → string so JSON.stringify doesn't throw
  const body = {
    ...data,
    blockNumber: data.blockNumber != null ? String(data.blockNumber) : undefined,
  }

  fetch('/api/analytics/track', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }).catch(err => {
    console.error('[trackSwap] Failed to send tracking data:', err)
  })
}
