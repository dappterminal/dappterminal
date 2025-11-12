/**
 * Uniswap V4 Permit2 Utilities
 *
 * Functions for handling Permit2 signature-based token approvals
 */

import { Address, PublicClient, WalletClient, Hex } from 'viem'
import { getPermit2Address, PERMIT2_ABI } from './contracts'
import { Permit2BatchData, Permit2Signature, Token } from '../types'

/**
 * Maximum allowance value for Permit2 (max uint160)
 */
export const MAX_PERMIT2_ALLOWANCE = BigInt('0xffffffffffffffffffffffffffffffffffffffff')

/**
 * Default expiration (30 days from now)
 */
export const DEFAULT_PERMIT2_EXPIRATION = () =>
  Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60

/**
 * Check Permit2 allowance for a token
 */
export async function getPermit2Allowance(
  owner: Address,
  token: Address,
  spender: Address,
  chainId: number,
  client: PublicClient
): Promise<{
  amount: bigint
  expiration: number
  nonce: number
}> {
  const permit2Address = getPermit2Address(chainId)

  const [amount, expiration, nonce] = (await client.readContract({
    address: permit2Address,
    abi: PERMIT2_ABI,
    functionName: 'allowance',
    args: [owner, token, spender],
  })) as [bigint, number, number]

  return {
    amount,
    expiration,
    nonce,
  }
}

/**
 * Check if Permit2 allowance is sufficient
 */
export async function hasPermit2Allowance(
  owner: Address,
  token: Address,
  spender: Address,
  requiredAmount: bigint,
  chainId: number,
  client: PublicClient
): Promise<boolean> {
  const { amount, expiration } = await getPermit2Allowance(
    owner,
    token,
    spender,
    chainId,
    client
  )

  const now = Math.floor(Date.now() / 1000)
  return amount >= requiredAmount && expiration > now
}

/**
 * Build Permit2 approve transaction data
 */
export function buildPermit2ApproveData(
  token: Address,
  spender: Address,
  amount?: bigint,
  expiration?: number
): {
  address: Address
  abi: typeof PERMIT2_ABI
  functionName: 'approve'
  args: [Address, Address, bigint, number]
} {
  return {
    address: getPermit2Address(1), // Address is same across all chains
    abi: PERMIT2_ABI,
    functionName: 'approve',
    args: [
      token,
      spender,
      amount ?? MAX_PERMIT2_ALLOWANCE,
      expiration ?? DEFAULT_PERMIT2_EXPIRATION(),
    ],
  }
}

/**
 * Create Permit2 batch approval data for multiple tokens
 */
export function createPermit2BatchData(
  tokens: Token[],
  amounts: bigint[],
  spender: Address,
  nonces: number[],
  expiration?: number
): Permit2BatchData {
  if (tokens.length !== amounts.length || tokens.length !== nonces.length) {
    throw new Error('Token, amount, and nonce arrays must have the same length')
  }

  const exp = expiration ?? DEFAULT_PERMIT2_EXPIRATION()
  const sigDeadline = exp + 60 * 60 // 1 hour after expiration

  return {
    details: tokens.map((token, i) => ({
      token: token.address,
      amount: amounts[i].toString(),
      expiration: exp.toString(),
      nonce: nonces[i].toString(),
    })),
    spender,
    sigDeadline: sigDeadline.toString(),
  }
}

/**
 * Get Permit2 domain separator for signatures
 */
export function getPermit2Domain(chainId: number) {
  return {
    name: 'Permit2',
    chainId: chainId,
    verifyingContract: getPermit2Address(chainId),
  }
}

/**
 * Permit2 PermitBatch type definition for EIP-712
 */
export const PERMIT_BATCH_TYPES = {
  PermitBatch: [
    { name: 'details', type: 'PermitDetails[]' },
    { name: 'spender', type: 'address' },
    { name: 'sigDeadline', type: 'uint256' },
  ],
  PermitDetails: [
    { name: 'token', type: 'address' },
    { name: 'amount', type: 'uint160' },
    { name: 'expiration', type: 'uint48' },
    { name: 'nonce', type: 'uint48' },
  ],
}

/**
 * Sign Permit2 batch approval
 */
export async function signPermit2Batch(
  owner: Address,
  batchData: Permit2BatchData,
  chainId: number,
  walletClient: WalletClient
): Promise<Hex> {
  const domain = getPermit2Domain(chainId)

  const signature = await walletClient.signTypedData({
    account: owner,
    domain,
    types: PERMIT_BATCH_TYPES,
    primaryType: 'PermitBatch',
    message: batchData as any,
  })

  return signature
}

/**
 * Create a complete Permit2 signature object
 */
export async function createPermit2Signature(
  owner: Address,
  tokens: Token[],
  amounts: bigint[],
  spender: Address,
  chainId: number,
  client: PublicClient,
  walletClient: WalletClient
): Promise<Permit2Signature> {
  // Get nonces for each token
  const nonces = await Promise.all(
    tokens.map(async (token) => {
      const { nonce } = await getPermit2Allowance(owner, token.address, spender, chainId, client)
      return nonce
    })
  )

  // Create batch data
  const permitBatch = createPermit2BatchData(tokens, amounts, spender, nonces)

  // Sign the batch
  const signature = await signPermit2Batch(owner, permitBatch, chainId, walletClient)

  return {
    owner,
    permitBatch,
    signature,
  }
}

/**
 * Check if token needs Permit2 approval before use
 */
export async function needsPermit2Approval(
  owner: Address,
  token: Address,
  spender: Address,
  amount: bigint,
  chainId: number,
  client: PublicClient
): Promise<boolean> {
  const hasAllowance = await hasPermit2Allowance(owner, token, spender, amount, chainId, client)
  return !hasAllowance
}

/**
 * Get required Permit2 approvals for multiple tokens
 */
export async function getRequiredPermit2Approvals(
  owner: Address,
  tokens: Token[],
  amounts: bigint[],
  spender: Address,
  chainId: number,
  client: PublicClient
): Promise<{
  tokensNeedingApproval: Token[]
  amountsNeedingApproval: bigint[]
}> {
  const checks = await Promise.all(
    tokens.map(async (token, i) => ({
      token,
      amount: amounts[i],
      needsApproval: await needsPermit2Approval(
        owner,
        token.address,
        spender,
        amounts[i],
        chainId,
        client
      ),
    }))
  )

  const needingApproval = checks.filter((check) => check.needsApproval)

  return {
    tokensNeedingApproval: needingApproval.map((check) => check.token),
    amountsNeedingApproval: needingApproval.map((check) => check.amount),
  }
}
