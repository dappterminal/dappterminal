/**
 * Faucet Configuration API Endpoint
 *
 * GET /api/faucet/config
 *
 * Get faucet configuration (public endpoint)
 * Returns available networks, amounts, and rate limits
 */

import { NextResponse } from 'next/server'
import { FAUCET_NETWORKS, RATE_LIMIT_CONFIG } from '@/lib/faucet/config'
import { getChainConfig } from '@/lib/chains'

export async function GET() {
  try {
    // Build network configurations
    const networks = Object.entries(FAUCET_NETWORKS)
      .filter(([_, config]) => config.enabled)
      .map(([networkKey, config]) => {
        const chainConfig = getChainConfig(config.chainId)

        return {
          network: config.network,
          chainId: config.chainId,
          displayName: config.displayName,
          symbol: config.symbol,
          amount: config.amountDisplay,
          enabled: config.enabled,
          explorerUrl: chainConfig?.blockExplorerUrls[0],
        }
      })

    // Return public configuration
    return NextResponse.json({
      success: true,
      data: {
        networks,
        rateLimit: {
          perAddress: {
            limit: 1,
            window: '24 hours',
            windowSeconds: RATE_LIMIT_CONFIG.addressCooldown,
          },
          perIpHourly: {
            limit: RATE_LIMIT_CONFIG.ipHourlyLimit,
            window: '1 hour',
            windowSeconds: RATE_LIMIT_CONFIG.ipHourlyWindow,
          },
          perIpDaily: {
            limit: RATE_LIMIT_CONFIG.ipDailyLimit,
            window: '24 hours',
            windowSeconds: RATE_LIMIT_CONFIG.ipDailyWindow,
          },
        },
        apiEndpoints: {
          request: {
            url: '/api/faucet/request',
            method: 'POST',
            description: 'Request testnet tokens',
            requiredFields: ['address', 'network'],
          },
          status: {
            url: '/api/faucet/status',
            method: 'GET',
            description: 'Check request status',
            queryParams: ['requestId', 'txHash', 'address'],
          },
          history: {
            url: '/api/faucet/history',
            method: 'GET',
            description: 'Get request history for an address',
            queryParams: ['address', 'network?', 'limit?', 'offset?'],
          },
        },
      },
    })
  } catch (error: any) {
    console.error('Faucet config error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error.message || 'An unexpected error occurred',
      },
      { status: 500 }
    )
  }
}
