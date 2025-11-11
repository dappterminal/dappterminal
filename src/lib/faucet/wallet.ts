/**
 * Faucet Wallet Service
 *
 * Manages the backend wallet that distributes testnet tokens.
 * Uses viem for transaction creation and signing.
 */

import { createWalletClient, http, type Address, type Hash, formatEther } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { sepolia, holesky, optimismSepolia } from 'viem/chains'
import { getFaucetWalletPrivateKey, getFaucetNetworkConfig, type FaucetNetworkConfig } from './config'

// Chain mapping
const CHAIN_MAP = {
  11155111: sepolia,
  17000: holesky,
  11155420: optimismSepolia,
} as const

/**
 * Get the faucet wallet account
 */
export function getFaucetAccount() {
  const privateKey = getFaucetWalletPrivateKey()

  if (!privateKey) {
    throw new Error('Faucet wallet private key not configured')
  }

  try {
    return privateKeyToAccount(privateKey as `0x${string}`)
  } catch (error) {
    throw new Error(`Invalid faucet wallet private key: ${error}`)
  }
}

/**
 * Get wallet client for a specific network
 */
export function getFaucetWalletClient(networkConfig: FaucetNetworkConfig) {
  const account = getFaucetAccount()
  const chain = CHAIN_MAP[networkConfig.chainId as keyof typeof CHAIN_MAP]

  if (!chain) {
    throw new Error(`Unsupported chain ID: ${networkConfig.chainId}`)
  }

  return createWalletClient({
    account,
    chain,
    transport: http(networkConfig.rpcUrl),
  })
}

/**
 * Get the faucet wallet address
 */
export function getFaucetWalletAddress(): Address {
  const account = getFaucetAccount()
  return account.address
}

/**
 * Check faucet wallet balance for a network
 */
export async function checkFaucetBalance(
  network: string
): Promise<{ balance: bigint; balanceFormatted: string; isLow: boolean }> {
  const networkConfig = getFaucetNetworkConfig(network)

  if (!networkConfig) {
    throw new Error(`Unknown network: ${network}`)
  }

  const client = getFaucetWalletClient(networkConfig)
  const balance = await client.getBalance({ address: client.account.address })
  const balanceFormatted = formatEther(balance)

  // Check if balance is below minimum threshold
  const minBalance = networkConfig.minBalance ? BigInt(networkConfig.minBalance) : BigInt(0)
  const isLow = balance < minBalance

  return {
    balance,
    balanceFormatted,
    isLow,
  }
}

/**
 * Send tokens from faucet to recipient
 */
export async function sendFaucetTransaction(
  recipientAddress: Address,
  network: string,
  amount: bigint
): Promise<{ hash: Hash; from: Address; to: Address; value: bigint }> {
  const networkConfig = getFaucetNetworkConfig(network)

  if (!networkConfig) {
    throw new Error(`Unknown network: ${network}`)
  }

  // Validate recipient address
  if (!recipientAddress || recipientAddress.length !== 42) {
    throw new Error('Invalid recipient address')
  }

  // Check faucet balance
  const { balance, isLow } = await checkFaucetBalance(network)

  if (isLow) {
    console.warn(`⚠️  Faucet balance is low on ${network}: ${formatEther(balance)} ${networkConfig.symbol}`)
  }

  if (balance < amount) {
    throw new Error(
      `Insufficient faucet balance. Required: ${formatEther(amount)} ${networkConfig.symbol}, ` +
      `Available: ${formatEther(balance)} ${networkConfig.symbol}`
    )
  }

  // Create wallet client
  const client = getFaucetWalletClient(networkConfig)

  try {
    // Send transaction
    const hash = await client.sendTransaction({
      to: recipientAddress,
      value: amount,
      chain: client.chain,
    })

    return {
      hash,
      from: client.account.address,
      to: recipientAddress,
      value: amount,
    }
  } catch (error: any) {
    // Handle common errors
    if (error.message?.includes('insufficient funds')) {
      throw new Error('Faucet wallet has insufficient funds')
    }
    if (error.message?.includes('nonce too low')) {
      throw new Error('Transaction nonce error. Please try again.')
    }
    if (error.message?.includes('gas')) {
      throw new Error('Gas estimation failed. Network may be congested.')
    }

    // Rethrow with more context
    throw new Error(`Failed to send transaction: ${error.message || error}`)
  }
}

/**
 * Estimate gas for a faucet transaction
 */
export async function estimateFaucetGas(
  recipientAddress: Address,
  network: string,
  amount: bigint
): Promise<{ gasEstimate: bigint; gasCost: bigint }> {
  const networkConfig = getFaucetNetworkConfig(network)

  if (!networkConfig) {
    throw new Error(`Unknown network: ${network}`)
  }

  const client = getFaucetWalletClient(networkConfig)

  try {
    const gasEstimate = await client.estimateGas({
      to: recipientAddress,
      value: amount,
      account: client.account,
    })

    // Get current gas price
    const gasPrice = await client.getGasPrice()
    const gasCost = gasEstimate * gasPrice

    return {
      gasEstimate,
      gasCost,
    }
  } catch (error: any) {
    throw new Error(`Failed to estimate gas: ${error.message || error}`)
  }
}

/**
 * Get faucet wallet info for all networks
 */
export async function getFaucetWalletInfo(): Promise<{
  address: Address
  balances: Record<string, { balance: string; isLow: boolean }>
}> {
  const address = getFaucetWalletAddress()
  const balances: Record<string, { balance: string; isLow: boolean }> = {}

  const networks = ['sepolia', 'holesky', 'optimism-sepolia']

  for (const network of networks) {
    try {
      const { balanceFormatted, isLow } = await checkFaucetBalance(network)
      balances[network] = {
        balance: balanceFormatted,
        isLow,
      }
    } catch (error) {
      console.error(`Error checking balance for ${network}:`, error)
      balances[network] = {
        balance: 'Error',
        isLow: true,
      }
    }
  }

  return {
    address,
    balances,
  }
}

/**
 * Validate wallet configuration
 */
export function validateFaucetWallet(): { valid: boolean; error?: string } {
  try {
    const account = getFaucetAccount()
    return {
      valid: true,
    }
  } catch (error: any) {
    return {
      valid: false,
      error: error.message || 'Invalid wallet configuration',
    }
  }
}
