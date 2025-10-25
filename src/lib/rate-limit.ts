/**
 * Rate Limiting Utilities
 *
 * Simple in-memory rate limiting for API routes.
 * For production at scale, consider using Upstash Redis or similar.
 */

interface RateLimitEntry {
  count: number
  resetAt: number
}

class RateLimiter {
  private store = new Map<string, RateLimitEntry>()
  private cleanupInterval: NodeJS.Timeout

  constructor() {
    // Clean up expired entries every minute
    this.cleanupInterval = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store.entries()) {
        if (entry.resetAt < now) {
          this.store.delete(key)
        }
      }
    }, 60000)
  }

  /**
   * Check if a request should be rate limited
   * @param identifier - Unique identifier for the client (IP, user ID, etc.)
   * @param limit - Maximum number of requests allowed
   * @param windowMs - Time window in milliseconds
   * @returns Object with success status and remaining requests
   */
  async check(
    identifier: string,
    limit: number,
    windowMs: number
  ): Promise<{
    success: boolean
    remaining: number
    reset: number
  }> {
    const now = Date.now()
    const entry = this.store.get(identifier)

    // No entry or expired window - create new
    if (!entry || entry.resetAt < now) {
      this.store.set(identifier, {
        count: 1,
        resetAt: now + windowMs,
      })
      return {
        success: true,
        remaining: limit - 1,
        reset: now + windowMs,
      }
    }

    // Within window - check limit
    if (entry.count >= limit) {
      return {
        success: false,
        remaining: 0,
        reset: entry.resetAt,
      }
    }

    // Increment count
    entry.count++
    return {
      success: true,
      remaining: limit - entry.count,
      reset: entry.resetAt,
    }
  }

  /**
   * Reset rate limit for an identifier
   */
  reset(identifier: string): void {
    this.store.delete(identifier)
  }

  /**
   * Cleanup (call on server shutdown)
   */
  destroy(): void {
    clearInterval(this.cleanupInterval)
    this.store.clear()
  }
}

// Singleton instance
const globalRateLimiter = new RateLimiter()

/**
 * Rate limit configuration presets
 */
export const RateLimitPresets = {
  // Strict limits for expensive operations (RPC calls, API proxying)
  STRICT: {
    limit: 10,
    windowMs: 60000, // 10 requests per minute
  },
  // Moderate limits for standard API calls
  MODERATE: {
    limit: 30,
    windowMs: 60000, // 30 requests per minute
  },
  // Relaxed limits for lightweight operations
  RELAXED: {
    limit: 100,
    windowMs: 60000, // 100 requests per minute
  },
} as const

/**
 * Apply rate limiting to a request
 * @param identifier - Unique identifier for the client
 * @param preset - Rate limit preset or custom config
 */
export async function rateLimit(
  identifier: string,
  preset: keyof typeof RateLimitPresets | { limit: number; windowMs: number } = 'MODERATE'
): Promise<{
  success: boolean
  remaining: number
  reset: number
}> {
  const config = typeof preset === 'string' ? RateLimitPresets[preset] : preset
  return globalRateLimiter.check(identifier, config.limit, config.windowMs)
}

/**
 * Get client identifier from request
 * Uses multiple fallbacks: custom header, forwarded IP, or remote address
 */
export function getClientIdentifier(request: Request): string {
  // Check for API key in header (for authenticated requests)
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) {
    return `key:${apiKey}`
  }

  // Fall back to IP address
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIp = request.headers.get('x-real-ip')

  const ip = forwardedFor?.split(',')[0].trim() || realIp || 'unknown'
  return `ip:${ip}`
}

/**
 * Helper to reset rate limit (for testing or admin purposes)
 */
export function resetRateLimit(identifier: string): void {
  globalRateLimiter.reset(identifier)
}

/**
 * Cleanup on server shutdown
 */
export function destroyRateLimiter(): void {
  globalRateLimiter.destroy()
}
