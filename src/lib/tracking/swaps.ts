/**
 * Swap and Bridge Transaction Tracking Service
 *
 * This service handles recording swap and bridge transactions to the database,
 * updating protocol volume statistics, and tracking user activity.
 */

import { prisma } from '@/lib/prisma'
import type {
  SwapTransactionData,
  ProtocolVolumeUpdate,
  UserActivityUpdate,
} from './types'

/**
 * Track a swap or bridge transaction
 * Records the transaction and updates aggregate statistics
 */
export async function trackSwapTransaction(data: SwapTransactionData): Promise<void> {
  try {
    // Record the transaction
    await prisma.swapTransaction.create({
      data: {
        txHash: data.txHash,
        chainId: data.chainId,
        blockNumber: data.blockNumber,
        status: 'pending',
        protocol: data.protocol,
        command: data.command,
        txType: data.txType,
        walletAddress: data.walletAddress.toLowerCase(), // Normalize address
        tokenIn: data.tokenIn,
        tokenOut: data.tokenOut,
        amountIn: data.amountIn,
        amountOut: data.amountOut,
        gasUsed: data.gasUsed,
        gasPrice: data.gasPrice,
        route: data.route || undefined,
      },
    })

    // Update aggregate statistics
    await Promise.all([
      updateProtocolVolume({
        date: new Date(),
        protocol: data.protocol,
        chainId: data.chainId,
        walletAddress: data.walletAddress,
        amountIn: data.amountIn,
        amountOut: data.amountOut,
        success: true, // Assuming submission success
      }),
      updateUserActivity({
        walletAddress: data.walletAddress,
        protocol: data.protocol,
        chainId: data.chainId,
        amountIn: data.amountIn,
        txType: data.txType,
      }),
    ])
  } catch (error) {
    // Log error but don't throw - tracking should not break the user flow
    console.error('Failed to track swap transaction:', error)
  }
}

/**
 * Update protocol volume statistics
 * Creates or updates daily aggregate for the protocol
 */
export async function updateProtocolVolume(data: ProtocolVolumeUpdate): Promise<void> {
  try {
    // Get start of day for aggregation
    const date = new Date(data.date)
    date.setHours(0, 0, 0, 0)

    // Try to find existing record
    const existing = await prisma.protocolVolume.findUnique({
      where: {
        date_protocol_chainId: {
          date,
          protocol: data.protocol,
          chainId: data.chainId,
        },
      },
    })

    if (existing) {
      // Update existing record
      const currentVolumeIn = BigInt(existing.totalVolumeIn)
      const currentVolumeOut = BigInt(existing.totalVolumeOut)
      const newVolumeIn = currentVolumeIn + BigInt(data.amountIn)
      const newVolumeOut = currentVolumeOut + BigInt(data.amountOut)

      await prisma.protocolVolume.update({
        where: {
          date_protocol_chainId: {
            date,
            protocol: data.protocol,
            chainId: data.chainId,
          },
        },
        data: {
          totalTransactions: { increment: 1 },
          successfulTxs: data.success ? { increment: 1 } : undefined,
          failedTxs: !data.success ? { increment: 1 } : undefined,
          totalVolumeIn: newVolumeIn.toString(),
          totalVolumeOut: newVolumeOut.toString(),
          updatedAt: new Date(),
        },
      })
    } else {
      // Create new record
      await prisma.protocolVolume.create({
        data: {
          date,
          protocol: data.protocol,
          chainId: data.chainId,
          totalTransactions: 1,
          successfulTxs: data.success ? 1 : 0,
          failedTxs: !data.success ? 1 : 0,
          uniqueUsers: 1,
          totalVolumeIn: data.amountIn,
          totalVolumeOut: data.amountOut,
        },
      })
    }

    // Note: uniqueUsers count is approximate and will be updated via a separate aggregation job
    // For now, we set it to 1 on creation. A batch job can recalculate this periodically.
  } catch (error) {
    console.error('Failed to update protocol volume:', error)
  }
}

/**
 * Update user activity statistics
 * Creates or updates user-specific activity summary
 */
export async function updateUserActivity(data: UserActivityUpdate): Promise<void> {
  try {
    const normalizedAddress = data.walletAddress.toLowerCase()
    const now = new Date()

    // Try to find existing record
    const existing = await prisma.userSwapActivity.findUnique({
      where: {
        walletAddress_protocol_chainId: {
          walletAddress: normalizedAddress,
          protocol: data.protocol,
          chainId: data.chainId,
        },
      },
    })

    if (existing) {
      // Update existing record
      const currentVolume = BigInt(existing.totalVolumeIn)
      const newVolume = currentVolume + BigInt(data.amountIn)

      await prisma.userSwapActivity.update({
        where: {
          walletAddress_protocol_chainId: {
            walletAddress: normalizedAddress,
            protocol: data.protocol,
            chainId: data.chainId,
          },
        },
        data: {
          totalSwaps: data.txType === 'swap' ? { increment: 1 } : undefined,
          totalBridges: data.txType === 'bridge' ? { increment: 1 } : undefined,
          lastTxAt: now,
          totalVolumeIn: newVolume.toString(),
          updatedAt: now,
        },
      })
    } else {
      // Create new record
      await prisma.userSwapActivity.create({
        data: {
          walletAddress: normalizedAddress,
          protocol: data.protocol,
          chainId: data.chainId,
          totalSwaps: data.txType === 'swap' ? 1 : 0,
          totalBridges: data.txType === 'bridge' ? 1 : 0,
          lastTxAt: now,
          firstTxAt: now,
          totalVolumeIn: data.amountIn,
        },
      })
    }
  } catch (error) {
    console.error('Failed to update user activity:', error)
  }
}

/**
 * Get user transaction history
 * Retrieves paginated list of transactions for a wallet
 */
export async function getUserTransactionHistory(
  walletAddress: string,
  options?: {
    protocol?: string
    chainId?: number
    txType?: 'swap' | 'bridge'
    limit?: number
    offset?: number
  }
) {
  const normalizedAddress = walletAddress.toLowerCase()

  return prisma.swapTransaction.findMany({
    where: {
      walletAddress: normalizedAddress,
      protocol: options?.protocol,
      chainId: options?.chainId,
      txType: options?.txType,
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: options?.limit || 50,
    skip: options?.offset || 0,
  })
}

/**
 * Get protocol volume statistics
 * Retrieves aggregated volume data for protocols
 */
export async function getProtocolVolumeStats(options?: {
  protocol?: string
  chainId?: number
  startDate?: Date
  endDate?: Date
}) {
  return prisma.protocolVolume.findMany({
    where: {
      protocol: options?.protocol,
      chainId: options?.chainId,
      date: {
        gte: options?.startDate,
        lte: options?.endDate,
      },
    },
    orderBy: {
      date: 'desc',
    },
  })
}

/**
 * Get global statistics
 * Returns overall platform metrics
 */
export async function getGlobalStats() {
  const [totalTransactions, totalUsers, recentActivity] = await Promise.all([
    // Total transaction count
    prisma.swapTransaction.count(),

    // Unique users count
    prisma.swapTransaction.findMany({
      distinct: ['walletAddress'],
      select: { walletAddress: true },
    }),

    // Recent transactions (last 24 hours)
    prisma.swapTransaction.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])

  return {
    totalTransactions,
    totalUsers: totalUsers.length,
    recentActivity,
  }
}
