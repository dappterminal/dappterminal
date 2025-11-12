/**
 * Faucet Commands
 *
 * Commands for requesting testnet tokens from the faucet
 */

import type { Command, CommandResult, ExecutionContext } from '@/core'
import type {
  FaucetRequestArgs,
  FaucetStatusArgs,
  FaucetHistoryArgs,
  FaucetRequestResult,
  FaucetStatusResult,
  FaucetHistoryResult,
} from './types'

/**
 * Request testnet tokens
 * Usage: faucet <network> [address]
 * If address is not provided, uses connected wallet address
 */
export const requestCommand: Command<FaucetRequestArgs, FaucetRequestResult> = {
  id: 'request',
  scope: 'G_core',
  description: 'Request testnet tokens from the faucet. Usage: faucet <network> [address]',
  aliases: ['faucet'],

  async run(args: FaucetRequestArgs | unknown, context: ExecutionContext): Promise<CommandResult<FaucetRequestResult>> {
    try {
      // Parse string arguments
      let network: string | undefined
      let address: string | undefined

      if (typeof args === 'string') {
        const argTokens = args.trim().split(/\s+/).filter(Boolean)
        network = argTokens[0]
        address = argTokens[1]
      } else {
        network = (args as FaucetRequestArgs)?.network
        address = (args as FaucetRequestArgs)?.address
      }

      // Validate network is provided
      if (!network) {
        return {
          success: false,
          error: new Error(
            'Network is required. Usage: faucet <network> [address]\n' +
            'Available networks: sepolia, holesky, optimism-sepolia\n' +
            'Example: faucet sepolia (uses connected wallet)\n' +
            'Example: faucet sepolia 0x123... (uses specific address)'
          ),
        }
      }

      // Use connected wallet address if not specified
      const targetAddress = address || context.wallet?.address

      if (!targetAddress) {
        return {
          success: false,
          error: new Error(
            'No wallet connected and no address specified.\n' +
            'Either connect a wallet with: connect <address>\n' +
            'Or provide an address: faucet <network> <address>'
          ),
        }
      }

      // Call faucet API
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      }

      // Add API key if available
      const apiKey = process.env.NEXT_PUBLIC_CLIENT_API_KEY
      if (apiKey) {
        headers['x-api-key'] = apiKey
      }

      const response = await fetch('/api/faucet/request', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          network,
          address: targetAddress,
        }),
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: new Error(result.error || 'Failed to request tokens'),
        }
      }

      return {
        success: true,
        value: result.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: new Error(`Failed to request tokens: ${error.message}`),
      }
    }
  },
}

/**
 * Check faucet request status
 * Usage: faucet:status <requestId|txHash>
 */
export const statusCommand: Command<FaucetStatusArgs, FaucetStatusResult> = {
  id: 'faucet:status',
  scope: 'G_core',
  description: 'Check the status of a faucet request',

  async run(args: FaucetStatusArgs | unknown, context: ExecutionContext): Promise<CommandResult<FaucetStatusResult>> {
    try {
      // Parse string arguments
      let requestId: string | undefined
      let txHash: string | undefined

      if (typeof args === 'string') {
        const argTokens = args.trim().split(/\s+/).filter(Boolean)
        const identifier = argTokens[0]
        // Determine if it's a request ID or tx hash (tx hashes start with 0x)
        if (identifier?.startsWith('0x')) {
          txHash = identifier
        } else {
          requestId = identifier
        }
      } else {
        requestId = (args as FaucetStatusArgs)?.requestId
        txHash = (args as FaucetStatusArgs)?.txHash
      }

      if (!requestId && !txHash) {
        return {
          success: false,
          error: new Error(
            'Request ID or transaction hash is required.\n' +
            'Usage: faucet:status <requestId|txHash>'
          ),
        }
      }

      // Build query params
      const params = new URLSearchParams()
      if (requestId) params.append('requestId', requestId)
      if (txHash) params.append('txHash', txHash)

      // Call faucet API
      const headers: Record<string, string> = {}
      const apiKey = process.env.NEXT_PUBLIC_CLIENT_API_KEY
      if (apiKey) {
        headers['x-api-key'] = apiKey
      }

      const response = await fetch(`/api/faucet/status?${params.toString()}`, {
        method: 'GET',
        headers,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: new Error(result.error || 'Failed to fetch status'),
        }
      }

      return {
        success: true,
        value: result.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: new Error(`Failed to fetch status: ${error.message}`),
      }
    }
  },
}

/**
 * Get faucet request history
 * Usage: faucet:history [address] [network]
 */
export const historyCommand: Command<FaucetHistoryArgs, FaucetHistoryResult> = {
  id: 'faucet:history',
  scope: 'G_core',
  description: 'View faucet request history for an address',

  async run(args: FaucetHistoryArgs | unknown, context: ExecutionContext): Promise<CommandResult<FaucetHistoryResult>> {
    try {
      // Parse string arguments
      let address: string | undefined
      let network: string | undefined
      let limit: number | undefined

      if (typeof args === 'string') {
        const argTokens = args.trim().split(/\s+/).filter(Boolean)
        address = argTokens[0]
        network = argTokens[1]
        if (argTokens[2]) {
          limit = parseInt(argTokens[2], 10)
        }
      } else {
        address = (args as FaucetHistoryArgs)?.address
        network = (args as FaucetHistoryArgs)?.network
        limit = (args as FaucetHistoryArgs)?.limit
      }

      // Use connected wallet address if not specified
      const targetAddress = address || context.wallet?.address

      if (!targetAddress) {
        return {
          success: false,
          error: new Error(
            'No address specified and no wallet connected.\n' +
            'Either connect a wallet or provide an address: faucet:history <address>'
          ),
        }
      }

      // Build query params
      const params = new URLSearchParams({ address: targetAddress })
      if (network) params.append('network', network)
      if (limit) params.append('limit', limit.toString())

      // Call faucet API
      const headers: Record<string, string> = {}
      const apiKey = process.env.NEXT_PUBLIC_CLIENT_API_KEY
      if (apiKey) {
        headers['x-api-key'] = apiKey
      }

      const response = await fetch(`/api/faucet/history?${params.toString()}`, {
        method: 'GET',
        headers,
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        return {
          success: false,
          error: new Error(result.error || 'Failed to fetch history'),
        }
      }

      return {
        success: true,
        value: result.data,
      }
    } catch (error: any) {
      return {
        success: false,
        error: new Error(`Failed to fetch history: ${error.message}`),
      }
    }
  },
}
