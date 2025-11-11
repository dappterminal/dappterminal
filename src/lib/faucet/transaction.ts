/**
 * Faucet Transaction Service
 *
 * Coordinates database operations with wallet transactions for the faucet.
 * Handles the full lifecycle of a faucet request.
 */

import { prisma } from '@/lib/prisma'
import { type Address, type Hash, isAddress, createPublicClient, http } from 'viem'
import { sepolia, holesky, optimismSepolia } from 'viem/chains'
import { sendFaucetTransaction, checkFaucetBalance } from './wallet'
import { getFaucetNetworkConfig } from './config'

// Chain mapping for public clients
const CHAIN_MAP = {
  11155111: sepolia,
  17000: holesky,
  11155420: optimismSepolia,
} as const

export interface FaucetTransactionRequest {
  address: string
  network: string
  ipAddress?: string
}

export interface FaucetTransactionResult {
  requestId: string
  txHash?: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  error?: string
}

/**
 * Create a new faucet request and send tokens
 */
export async function processFaucetRequest(
  request: FaucetTransactionRequest
): Promise<FaucetTransactionResult> {
  const { address, network, ipAddress } = request

  // Validate address format
  if (!isAddress(address)) {
    throw new Error('Invalid Ethereum address format')
  }

  // Get network configuration
  const networkConfig = getFaucetNetworkConfig(network)
  if (!networkConfig || !networkConfig.enabled) {
    throw new Error(`Network ${network} is not supported or is disabled`)
  }

  // Check faucet balance before creating request
  const { balance, isLow } = await checkFaucetBalance(network)
  const requiredAmount = BigInt(networkConfig.amount)

  if (balance < requiredAmount) {
    throw new Error(
      `Faucet wallet has insufficient balance for ${network}. ` +
      `Please contact the administrator.`
    )
  }

  // Create database record
  const faucetRequest = await prisma.faucetRequest.create({
    data: {
      address: address.toLowerCase(),
      ipAddress: ipAddress || null,
      network,
      chainId: networkConfig.chainId,
      amount: networkConfig.amount,
      status: 'pending',
    },
  })

  // Log request creation
  await prisma.faucetAuditLog.create({
    data: {
      eventType: 'request_created',
      severity: 'info',
      requestId: faucetRequest.id,
      address: address.toLowerCase(),
      network,
      message: `Faucet request created for ${address} on ${network}`,
      metadata: {
        amount: networkConfig.amountDisplay,
        ipAddress: ipAddress || 'unknown',
      },
    },
  })

  try {
    // Update status to processing
    await prisma.faucetRequest.update({
      where: { id: faucetRequest.id },
      data: {
        status: 'processing',
        processedAt: new Date(),
      },
    })

    // Send transaction
    const txResult = await sendFaucetTransaction(
      address as Address,
      network,
      requiredAmount
    )

    // Update record with transaction hash
    await prisma.faucetRequest.update({
      where: { id: faucetRequest.id },
      data: {
        txHash: txResult.hash,
        status: 'completed',
        completedAt: new Date(),
      },
    })

    // Log successful transaction
    await prisma.faucetAuditLog.create({
      data: {
        eventType: 'transaction_sent',
        severity: 'info',
        requestId: faucetRequest.id,
        address: address.toLowerCase(),
        network,
        message: `Transaction sent successfully: ${txResult.hash}`,
        metadata: {
          txHash: txResult.hash,
          amount: networkConfig.amountDisplay,
          from: txResult.from,
          to: txResult.to,
        },
      },
    })

    return {
      requestId: faucetRequest.id,
      txHash: txResult.hash,
      status: 'completed',
    }
  } catch (error: any) {
    // Update request with error
    await prisma.faucetRequest.update({
      where: { id: faucetRequest.id },
      data: {
        status: 'failed',
        errorMessage: error.message || 'Unknown error occurred',
        completedAt: new Date(),
      },
    })

    // Log error
    await prisma.faucetAuditLog.create({
      data: {
        eventType: 'error',
        severity: 'error',
        requestId: faucetRequest.id,
        address: address.toLowerCase(),
        network,
        message: `Failed to send transaction: ${error.message}`,
        metadata: {
          error: error.message,
          stack: error.stack,
        },
      },
    })

    return {
      requestId: faucetRequest.id,
      status: 'failed',
      error: error.message || 'Failed to send transaction',
    }
  }
}

/**
 * Get status of a faucet request by ID
 */
export async function getFaucetRequestStatus(requestId: string) {
  const request = await prisma.faucetRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    return null
  }

  // If completed, verify transaction on-chain (optional enhancement)
  // For now, return database status
  return {
    id: request.id,
    address: request.address,
    network: request.network,
    chainId: request.chainId,
    amount: request.amount,
    txHash: request.txHash,
    status: request.status,
    errorMessage: request.errorMessage,
    createdAt: request.createdAt,
    processedAt: request.processedAt,
    completedAt: request.completedAt,
  }
}

/**
 * Get faucet request history for an address
 */
export async function getFaucetRequestHistory(
  address: string,
  options?: {
    network?: string
    limit?: number
    offset?: number
  }
) {
  const where = {
    address: address.toLowerCase(),
    ...(options?.network && { network: options.network }),
  }

  const [requests, total] = await Promise.all([
    prisma.faucetRequest.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 10,
      skip: options?.offset || 0,
    }),
    prisma.faucetRequest.count({ where }),
  ])

  return {
    requests,
    total,
    limit: options?.limit || 10,
    offset: options?.offset || 0,
  }
}

/**
 * Verify transaction on-chain
 */
export async function verifyTransactionOnChain(
  txHash: Hash,
  chainId: number
): Promise<{ confirmed: boolean; blockNumber?: bigint; status?: string }> {
  const chain = CHAIN_MAP[chainId as keyof typeof CHAIN_MAP]

  if (!chain) {
    throw new Error(`Unsupported chain ID: ${chainId}`)
  }

  const networkConfig = Object.values(
    await import('./config').then(m => m.FAUCET_NETWORKS)
  ).find(config => config.chainId === chainId)

  if (!networkConfig) {
    throw new Error(`No configuration found for chain ID: ${chainId}`)
  }

  const publicClient = createPublicClient({
    chain,
    transport: http(networkConfig.rpcUrl),
  })

  try {
    const receipt = await publicClient.getTransactionReceipt({ hash: txHash })

    return {
      confirmed: true,
      blockNumber: receipt.blockNumber,
      status: receipt.status,
    }
  } catch (error) {
    // Transaction not found or not confirmed yet
    return {
      confirmed: false,
    }
  }
}

/**
 * Get pending faucet requests
 */
export async function getPendingRequests(limit: number = 100) {
  return prisma.faucetRequest.findMany({
    where: {
      status: {
        in: ['pending', 'processing'],
      },
    },
    orderBy: { createdAt: 'asc' },
    take: limit,
  })
}

/**
 * Retry a failed faucet request
 */
export async function retryFailedRequest(requestId: string): Promise<FaucetTransactionResult> {
  const request = await prisma.faucetRequest.findUnique({
    where: { id: requestId },
  })

  if (!request) {
    throw new Error('Request not found')
  }

  if (request.status !== 'failed') {
    throw new Error('Only failed requests can be retried')
  }

  // Create new request with same parameters
  return processFaucetRequest({
    address: request.address,
    network: request.network,
    ipAddress: request.ipAddress || undefined,
  })
}

/**
 * Get faucet statistics
 */
export async function getFaucetStatistics() {
  const [
    totalRequests,
    completedRequests,
    failedRequests,
    pendingRequests,
    last24Hours,
  ] = await Promise.all([
    prisma.faucetRequest.count(),
    prisma.faucetRequest.count({ where: { status: 'completed' } }),
    prisma.faucetRequest.count({ where: { status: 'failed' } }),
    prisma.faucetRequest.count({ where: { status: { in: ['pending', 'processing'] } } }),
    prisma.faucetRequest.count({
      where: {
        createdAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000),
        },
      },
    }),
  ])

  return {
    totalRequests,
    completedRequests,
    failedRequests,
    pendingRequests,
    last24Hours,
    successRate: totalRequests > 0 ? (completedRequests / totalRequests) * 100 : 0,
  }
}
