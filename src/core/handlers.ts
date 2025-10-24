/**
 * Command Execution Handlers
 *
 * Provides the infrastructure for plugins to handle command execution
 * with access to CLI operations like history updates and wallet signing.
 */

import type { ExecutionContext } from './types'

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
  signTransaction: (tx: any) => Promise<string>

  /**
   * Sign typed data (EIP-712) using the connected wallet
   * @returns Signature
   */
  signTypedData: (typedData: any) => Promise<string>

  /**
   * Send a transaction using the connected wallet
   * @returns Transaction hash
   */
  sendTransaction: (tx: any) => Promise<string>

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
export type CommandHandler<T = any> = (
  data: T,
  context: ExecutionContext & CLIContext
) => Promise<void>

/**
 * Handler Registry
 *
 * Maps command IDs to their execution handlers
 */
export type HandlerRegistry = Record<string, CommandHandler>
