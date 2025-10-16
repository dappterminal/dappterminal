/**
 * Core algebraic types for the fibered monoid architecture
 *
 * This defines the type system for DeFi protocol commands organized as a fibered monoid,
 * where each protocol forms a submonoid (fiber) of the global command monoid.
 */

/**
 * Command scope discriminator
 * - G_core: Core global commands (fundamental operations)
 * - G_alias: Aliased commands in global scope (protocol-agnostic, bound at runtime)
 * - G_p: Protocol-specific commands (living in a protocol fiber M_P)
 */
export type CommandScope = 'G_core' | 'G_alias' | 'G_p'

/**
 * Protocol identifier
 * Examples: 'uniswap-v4', 'wormhole', 'lifi', 'stargate'
 */
export type ProtocolId = string

/**
 * Wallet connection state
 */
export interface WalletState {
  /** Connected wallet address */
  address?: `0x${string}`

  /** Connected chain ID */
  chainId?: number

  /** Whether wallet is connected */
  isConnected: boolean

  /** Whether wallet is connecting */
  isConnecting: boolean

  /** Whether wallet is disconnecting */
  isDisconnecting: boolean
}

/**
 * Execution context passed through command execution
 */
export interface ExecutionContext {
  /** Currently active protocol (if any) */
  activeProtocol?: ProtocolId

  /** User preferences for protocol selection */
  protocolPreferences: Record<string, ProtocolId>

  /** Wallet connection state */
  wallet: WalletState

  /** Global state shared across all commands */
  globalState: Record<string, unknown>

  /** Protocol-specific state (keyed by protocol ID) */
  protocolState: Map<ProtocolId, Record<string, unknown>>

  /** Command execution history */
  history: CommandExecution[]
}

/**
 * Command execution record
 */
export interface CommandExecution {
  commandId: string
  protocol?: ProtocolId
  args: unknown
  result: unknown
  timestamp: Date
  success: boolean
  error?: Error
}

/**
 * Command arguments with protocol binding
 */
export interface CommandArgs {
  /** Raw arguments passed to the command */
  args: unknown

  /** Flags passed to the command */
  flags: Record<string, unknown>

  /** Explicitly specified protocol (from --protocol flag) */
  protocol?: ProtocolId
}

/**
 * Command result (using Result type for error handling)
 */
export type CommandResult<T = unknown> =
  | { success: true; value: T }
  | { success: false; error: Error }

/**
 * Base command interface
 * All commands in the monoid must implement this interface
 */
export interface Command<TArgs = unknown, TResult = unknown> {
  /** Unique command identifier */
  id: string

  /** Command scope (G_core, G_alias, or G_p) */
  scope: CommandScope

  /** Protocol this command belongs to (required for G_p, undefined for G_core/G_alias) */
  protocol?: ProtocolId

  /** Human-readable description */
  description?: string

  /** Command aliases */
  aliases?: string[]

  /** Execute the command */
  run: (args: TArgs, context: ExecutionContext) => Promise<CommandResult<TResult>>

  /** Compose this command with another (monoid operation) */
  compose?: <U>(other: Command<TResult, U>) => Command<TArgs, U>
}

/**
 * Protocol fiber - a submonoid of protocol-specific commands
 */
export interface ProtocolFiber {
  /** Protocol identifier */
  id: ProtocolId

  /** Human-readable protocol name */
  name: string

  /** Protocol description */
  description?: string

  /** All commands in this protocol fiber (M_P) */
  commands: Map<string, Command>

  /** Protocol-specific initialization */
  initialize?: (context: ExecutionContext) => Promise<void>

  /** Protocol-specific cleanup */
  cleanup?: (context: ExecutionContext) => Promise<void>
}

/**
 * Monoid structure
 * Represents the global command monoid with protocol fibers
 */
export interface Monoid {
  /** Identity element (no-op command) */
  identity: Command

  /** Compose two commands (monoid multiplication) */
  compose: <A, B, C>(
    f: Command<A, B>,
    g: Command<B, C>
  ) => Command<A, C>
}

/**
 * User preferences for protocol selection
 */
export interface ProtocolPreferences {
  /** Default protocol for each command type */
  defaults: Record<string, ProtocolId>

  /** Priority order for protocol resolution */
  priority: ProtocolId[]
}

/**
 * Command resolution context
 * Used by the resolution operators (ρ, ρ_f)
 */
export interface ResolutionContext {
  /** Input string to resolve */
  input: string

  /** Explicit protocol specification (from --protocol flag) */
  explicitProtocol?: ProtocolId

  /** User preferences */
  preferences: ProtocolPreferences

  /** Current execution context */
  executionContext: ExecutionContext
}

/**
 * Command resolution result
 */
export interface ResolvedCommand {
  /** The resolved command */
  command: Command

  /** Protocol it was resolved to (if applicable) */
  protocol?: ProtocolId

  /** How it was resolved (exact match, alias, fuzzy match, etc.) */
  resolutionMethod: 'exact' | 'alias' | 'fuzzy' | 'protocol-scoped'

  /** Confidence score (0-1) for fuzzy matches */
  confidence?: number
}
