/**
 * Command Execution Handlers
 *
 * Provides the infrastructure for plugins to handle command execution
 * with access to CLI operations like history updates and wallet signing.
 */

import type { ExecutionContext } from './types'

/**
 * Transaction Request
 *
 * Represents a transaction to be sent to the blockchain.
 * Compatible with wagmi's sendTransaction parameters.
 */
export interface TransactionRequest {
  to: `0x${string}`
  data?: `0x${string}`
  value?: bigint
  gas?: bigint
  gasLimit?: bigint
  gasPrice?: bigint
  maxFeePerGas?: bigint
  maxPriorityFeePerGas?: bigint
  nonce?: number
  // chainId is handled by wagmi config, not passed in transaction
}

/**
 * EIP-712 Typed Data Payload
 *
 * Represents structured data for EIP-712 signing.
 * Used for off-chain signatures like limit orders.
 */
export interface TypedDataPayload {
  domain: {
    name: string
    version: string
    chainId: number
    verifyingContract: `0x${string}`
  }
  types: Record<string, Array<{ name: string; type: string }>>
  primaryType: string
  message: Record<string, unknown>
}

/**
 * CLI Context
 *
 * Provides CLI-specific operations that handlers can use
 * to interact with the terminal UI and wallet operations.
 */
export interface CLIContext {
  /**
   * Update the command history output
   * Replaces the current command's output with new lines
   */
  updateHistory: (lines: string[]) => void

  /**
   * Add clickable links to the current command's output
   */
  addHistoryLinks: (links: { text: string; url: string }[]) => void

  /**
   * Sign a transaction using the connected wallet
   * @returns Transaction hash
   */
  signTransaction: (tx: TransactionRequest) => Promise<string>

  /**
   * Sign typed data (EIP-712) using the connected wallet
   * @returns Signature
   */
  signTypedData: (typedData: TypedDataPayload) => Promise<string>

  /**
   * Send a transaction using the connected wallet
   * @returns Transaction hash
   */
  sendTransaction: (tx: TransactionRequest) => Promise<string>

  /**
   * Active terminal tab ID
   */
  activeTabId: string

  /**
   * Connected wallet address (if any)
   */
  walletAddress?: string

  /**
   * Current chain ID (if wallet connected)
   */
  chainId?: number
}

/**
 * Command Handler
 *
 * A function that executes protocol-specific logic for a command.
 * Receives the command result data and full execution context.
 *
 * @template T - The type of data returned by the command
 */
export type CommandHandler<T = unknown> = (
  data: T,
  context: ExecutionContext & CLIContext
) => Promise<void>

/**
 * Handler Registry
 *
 * Maps command IDs to their execution handlers
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type HandlerRegistry = Record<string, CommandHandler<any>>
