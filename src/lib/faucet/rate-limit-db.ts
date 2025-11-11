/**
 * Database-backed Rate Limiting for Faucet
 *
 * Implements multi-layer rate limiting:
 * 1. Per-address cooldown (24 hours per network)
 * 2. Per-IP hourly limit (prevent rapid requests from same IP)
 * 3. Per-IP daily limit (prevent Sybil attacks)
 */

import { prisma } from '@/lib/prisma'
import { RATE_LIMIT_CONFIG } from './config'

export interface RateLimitResult {
  allowed: boolean
  reason?: string
  resetTime?: Date
  remainingRequests?: number
}

/**
 * Check if an address can request tokens for a specific network
 */
export async function checkAddressRateLimit(
  address: string,
  network: string
): Promise<RateLimitResult> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - RATE_LIMIT_CONFIG.addressCooldown * 1000)

  try {
    // Find the most recent request from this address for this network
    const recentRequest = await prisma.faucetRequest.findFirst({
      where: {
        address: address.toLowerCase(),
        network,
        createdAt: {
          gte: windowStart,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (recentRequest) {
      const resetTime = new Date(
        recentRequest.createdAt.getTime() + RATE_LIMIT_CONFIG.addressCooldown * 1000
      )

      return {
        allowed: false,
        reason: `Address has already requested ${network} tokens recently. Please wait.`,
        resetTime,
      }
    }

    return { allowed: true }
  } catch (error) {
    console.error('Error checking address rate limit:', error)
    // Fail open in case of database errors (but log them)
    return { allowed: true }
  }
}

/**
 * Check IP-based hourly rate limit
 */
export async function checkIpHourlyRateLimit(ipAddress: string): Promise<RateLimitResult> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - RATE_LIMIT_CONFIG.ipHourlyWindow * 1000)

  try {
    // Count requests from this IP in the last hour
    const requestCount = await prisma.faucetRequest.count({
      where: {
        ipAddress,
        createdAt: {
          gte: windowStart,
        },
      },
    })

    if (requestCount >= RATE_LIMIT_CONFIG.ipHourlyLimit) {
      // Find the oldest request in the window to calculate reset time
      const oldestRequest = await prisma.faucetRequest.findFirst({
        where: {
          ipAddress,
          createdAt: {
            gte: windowStart,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      const resetTime = oldestRequest
        ? new Date(oldestRequest.createdAt.getTime() + RATE_LIMIT_CONFIG.ipHourlyWindow * 1000)
        : new Date(now.getTime() + RATE_LIMIT_CONFIG.ipHourlyWindow * 1000)

      return {
        allowed: false,
        reason: `Too many requests from your IP address. Hourly limit: ${RATE_LIMIT_CONFIG.ipHourlyLimit} requests.`,
        resetTime,
        remainingRequests: 0,
      }
    }

    return {
      allowed: true,
      remainingRequests: RATE_LIMIT_CONFIG.ipHourlyLimit - requestCount,
    }
  } catch (error) {
    console.error('Error checking IP hourly rate limit:', error)
    return { allowed: true }
  }
}

/**
 * Check IP-based daily rate limit
 */
export async function checkIpDailyRateLimit(ipAddress: string): Promise<RateLimitResult> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - RATE_LIMIT_CONFIG.ipDailyWindow * 1000)

  try {
    // Count requests from this IP in the last 24 hours
    const requestCount = await prisma.faucetRequest.count({
      where: {
        ipAddress,
        createdAt: {
          gte: windowStart,
        },
      },
    })

    if (requestCount >= RATE_LIMIT_CONFIG.ipDailyLimit) {
      // Find the oldest request in the window to calculate reset time
      const oldestRequest = await prisma.faucetRequest.findFirst({
        where: {
          ipAddress,
          createdAt: {
            gte: windowStart,
          },
        },
        orderBy: {
          createdAt: 'asc',
        },
      })

      const resetTime = oldestRequest
        ? new Date(oldestRequest.createdAt.getTime() + RATE_LIMIT_CONFIG.ipDailyWindow * 1000)
        : new Date(now.getTime() + RATE_LIMIT_CONFIG.ipDailyWindow * 1000)

      return {
        allowed: false,
        reason: `Too many requests from your IP address today. Daily limit: ${RATE_LIMIT_CONFIG.ipDailyLimit} requests.`,
        resetTime,
        remainingRequests: 0,
      }
    }

    return {
      allowed: true,
      remainingRequests: RATE_LIMIT_CONFIG.ipDailyLimit - requestCount,
    }
  } catch (error) {
    console.error('Error checking IP daily rate limit:', error)
    return { allowed: true }
  }
}

/**
 * Comprehensive rate limit check (all layers)
 */
export async function checkFaucetRateLimit(
  address: string,
  ipAddress: string,
  network: string
): Promise<RateLimitResult> {
  // Check address cooldown
  const addressCheck = await checkAddressRateLimit(address, network)
  if (!addressCheck.allowed) {
    return addressCheck
  }

  // Check IP hourly limit
  const ipHourlyCheck = await checkIpHourlyRateLimit(ipAddress)
  if (!ipHourlyCheck.allowed) {
    return ipHourlyCheck
  }

  // Check IP daily limit
  const ipDailyCheck = await checkIpDailyRateLimit(ipAddress)
  if (!ipDailyCheck.allowed) {
    return ipDailyCheck
  }

  // All checks passed
  return {
    allowed: true,
    remainingRequests: Math.min(
      ipHourlyCheck.remainingRequests || 0,
      ipDailyCheck.remainingRequests || 0
    ),
  }
}

/**
 * Clean up expired rate limit records
 * Should be called periodically (e.g., via cron job)
 */
export async function cleanupExpiredRateLimits(): Promise<number> {
  const now = new Date()
  const expiryThreshold = new Date(
    now.getTime() - Math.max(RATE_LIMIT_CONFIG.addressCooldown, RATE_LIMIT_CONFIG.ipDailyWindow) * 1000
  )

  try {
    const result = await prisma.rateLimitRecord.deleteMany({
      where: {
        windowEnd: {
          lt: expiryThreshold,
        },
      },
    })

    return result.count
  } catch (error) {
    console.error('Error cleaning up expired rate limits:', error)
    return 0
  }
}

/**
 * Get rate limit status for an address
 */
export async function getAddressRateLimitStatus(
  address: string,
  network: string
): Promise<{
  canRequest: boolean
  lastRequestTime?: Date
  nextAvailableTime?: Date
}> {
  const now = new Date()
  const windowStart = new Date(now.getTime() - RATE_LIMIT_CONFIG.addressCooldown * 1000)

  try {
    const recentRequest = await prisma.faucetRequest.findFirst({
      where: {
        address: address.toLowerCase(),
        network,
        createdAt: {
          gte: windowStart,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!recentRequest) {
      return { canRequest: true }
    }

    const nextAvailableTime = new Date(
      recentRequest.createdAt.getTime() + RATE_LIMIT_CONFIG.addressCooldown * 1000
    )

    return {
      canRequest: false,
      lastRequestTime: recentRequest.createdAt,
      nextAvailableTime,
    }
  } catch (error) {
    console.error('Error getting address rate limit status:', error)
    return { canRequest: true }
  }
}

/**
 * Get IP rate limit status
 */
export async function getIpRateLimitStatus(ipAddress: string): Promise<{
  hourlyRemaining: number
  dailyRemaining: number
  hourlyResetTime?: Date
  dailyResetTime?: Date
}> {
  const hourlyCheck = await checkIpHourlyRateLimit(ipAddress)
  const dailyCheck = await checkIpDailyRateLimit(ipAddress)

  return {
    hourlyRemaining: hourlyCheck.remainingRequests || 0,
    dailyRemaining: dailyCheck.remainingRequests || 0,
    hourlyResetTime: hourlyCheck.resetTime,
    dailyResetTime: dailyCheck.resetTime,
  }
}
