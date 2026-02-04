/**
 * Base monoid implementation for DeFi commands
 *
 * Implements the algebraic structure where:
 * - Commands form a monoid M under composition
 * - Each protocol forms a proper submonoid (fiber) M_P
 * - The global monoid M = G_core ∪ G_alias ∪ (⋃ M_P)
 *
 * Submonoid Structure:
 * - Each fiber M_P contains its own identity element e_P
 * - Identity elements are protocol-specific to preserve protocol state
 * - Composition within a fiber stays in that fiber: f, g ∈ M_P ⇒ f ∘ g ∈ M_P
 * - This ensures each M_P is a mathematically rigorous submonoid
 *
 * Why Protocol-Specific Identity:
 * - Protocols share primitives (swap, lend) but with different implementations
 * - Identity should preserve protocol-specific context and state
 * - Maintains protocol "session" during composition chains
 * - Ensures type safety: 1inch:TokenA → 1inch:TokenA uses 1inch's identity
 */

import type {
  Command,
  CommandResult,
  ExecutionContext,
  Monoid,
  ProtocolFiber,
  ProtocolId,
} from './types'

/**
 * Global identity command (no-op)
 *
 * This is the identity element for the global scope G_core.
 * It serves as the identity for core commands that are not protocol-specific.
 *
 * Note: Each protocol fiber M_P has its own identity element (e_P) that:
 * - Has scope G_p and protocol-specific tag
 * - Preserves protocol-specific state and context
 * - Ensures submonoid closure within the fiber
 *
 * This global identity is for cross-protocol operations and core commands.
 * When composing within a protocol, use that protocol's identity instead.
 */
export const identityCommand: Command = {
  id: 'identity',
  scope: 'G_core',
  description: 'Identity operation (no-op) for global scope',
  run: async <T>(args: T): Promise<CommandResult<T>> => {
    return { success: true, value: args }
  },
}

/**
 * Compose two commands into a single command
 * This is the monoid multiplication operation
 *
 * Mathematically: (f ∘ g)(x) = g(f(x))
 * The output of f becomes the input to g
 */
export function composeCommands<A, B, C>(
  f: Command<A, B>,
  g: Command<B, C>
): Command<A, C> {
  // Preserve scope/protocol to maintain submonoid closure
  // If both commands are in the same fiber M_P, their composition must also be in M_P
  let scope: import('./types').CommandScope = 'G_core'
  let protocol: ProtocolId | undefined

  if (f.scope === 'G_p' && g.scope === 'G_p' && f.protocol === g.protocol) {
    // Both in same protocol fiber → composition stays in fiber (maintains closure)
    scope = 'G_p'
    protocol = f.protocol
  } else if (f.scope === 'G_alias' && g.scope === 'G_alias') {
    // Both are aliases → composition is alias
    scope = 'G_alias'
  }
  // Otherwise default to G_core (cross-fiber or mixed-scope composition)

  return {
    id: `${f.id}_then_${g.id}`,
    scope,
    ...(protocol && { protocol }),
    description: `${f.description || f.id} then ${g.description || g.id}`,

    run: async (args: A, context: ExecutionContext): Promise<CommandResult<C>> => {
      // Execute first command
      const resultF = await f.run(args, context)

      if (!resultF.success) {
        return resultF as CommandResult<C>
      }

      // Execute second command with result of first
      const resultG = await g.run(resultF.value as B, context)

      return resultG
    },

    // Composition is associative: (f ∘ g) ∘ h = f ∘ (g ∘ h)
    compose: <D>(h: Command<C, D>) => composeCommands(composeCommands(f, g), h),
  }
}

/**
 * Create the global command monoid
 */
export function createMonoid(): Monoid {
  return {
    identity: identityCommand,
    compose: composeCommands,
  }
}

/**
 * Create a protocol fiber (submonoid)
 *
 * A protocol fiber M_P is a proper submonoid of the global monoid M.
 *
 * Submonoid Properties:
 * - Contains protocol-specific commands (scope G_p, protocol = P)
 * - Closed under composition: f, g ∈ M_P ⇒ f ∘ g ∈ M_P
 * - Contains identity element: e_P ∈ M_P (protocol-specific identity)
 * - Forms the preimage π^(-1)(P) where π is the projection operator
 *
 * Each fiber gets its own identity command that:
 * - Has scope G_p and protocol = P
 * - Preserves protocol-specific state in ExecutionContext
 * - Maintains the protocol's "session" during composition
 * - Ensures closure: composing with identity stays in the fiber
 *
 * This makes each M_P a true mathematical submonoid.
 */
export function createProtocolFiber(
  id: ProtocolId,
  name: string,
  description?: string
): ProtocolFiber {
  const fiber: ProtocolFiber = {
    id,
    name,
    description,
    commands: new Map(),
  }

  // Add protocol-specific identity to the fiber
  // This ensures M_P is a proper submonoid with its own identity element
  const protocolIdentity: Command = {
    id: 'identity',
    scope: 'G_p',
    protocol: id,
    description: `Identity operation for ${name}`,
    run: async <T>(args: T, context: ExecutionContext): Promise<CommandResult<T>> => {
      // Identity preserves protocol-specific state
      // This is important for maintaining protocol context during composition
      return { success: true, value: args }
    },
  }

  fiber.commands.set('identity', protocolIdentity)

  return fiber
}

/**
 * Add a command to a protocol fiber
 *
 * Ensures the command has the correct protocol scope (G_p)
 */
export function addCommandToFiber(
  fiber: ProtocolFiber,
  command: Command
): void {
  if (command.scope !== 'G_p') {
    throw new Error(
      `Cannot add command with scope ${command.scope} to protocol fiber. Expected G_p.`
    )
  }

  if (command.protocol !== fiber.id) {
    throw new Error(
      `Command protocol (${command.protocol}) does not match fiber protocol (${fiber.id})`
    )
  }

  fiber.commands.set(command.id, command)
}

/**
 * Verify fiber closure property
 *
 * Tests that composing two commands from the same fiber M_P
 * produces a command that is also in M_P (preserves protocol).
 *
 * @param fiber - The protocol fiber to test
 * @param f - First command (must be in fiber)
 * @param g - Second command (must be in fiber)
 * @returns Object indicating closure property
 */
export function verifyFiberClosure<A, B, C>(
  fiber: ProtocolFiber,
  f: Command<A, B>,
  g: Command<B, C>
): {
  valid: boolean
  reason?: string
  composedCommand?: Command<A, C>
} {
  // Verify both commands are in the fiber
  if (f.scope !== 'G_p' || f.protocol !== fiber.id) {
    return {
      valid: false,
      reason: `Command ${f.id} is not in fiber ${fiber.id}`,
    }
  }

  if (g.scope !== 'G_p' || g.protocol !== fiber.id) {
    return {
      valid: false,
      reason: `Command ${g.id} is not in fiber ${fiber.id}`,
    }
  }

  // Compose the commands
  const composed = composeCommands(f, g)

  // Verify the composition is in the same fiber
  if (composed.scope !== 'G_p') {
    return {
      valid: false,
      reason: `Composed command has scope ${composed.scope}, expected G_p`,
      composedCommand: composed,
    }
  }

  if (composed.protocol !== fiber.id) {
    return {
      valid: false,
      reason: `Composed command has protocol ${composed.protocol}, expected ${fiber.id}`,
      composedCommand: composed,
    }
  }

  // Closure property holds!
  return {
    valid: true,
    composedCommand: composed,
  }
}

/**
 * Verify that identity composes correctly with fiber commands
 *
 * Tests the ambient identity property: identity ∘ f = f and f ∘ identity = f
 * even when f is in a protocol fiber M_P.
 *
 * @param f - Command from a protocol fiber
 * @param testInput - Test input for execution
 * @param context - Execution context
 * @returns Object indicating if ambient identity property holds
 */
export async function verifyAmbientIdentity<T>(
  f: Command<T, T>,
  testInput: T,
  context: ExecutionContext
): Promise<{
  leftIdentity: boolean
  rightIdentity: boolean
  details?: string
}> {
  // Test left identity: identity ∘ f = f
  const leftComposed = composeCommands(identityCommand as Command<T, T>, f)
  const leftResult = await leftComposed.run(testInput, context)
  const directResult = await f.run(testInput, context)
  const leftIdentity = JSON.stringify(leftResult) === JSON.stringify(directResult)

  // Test right identity: f ∘ identity = f
  const rightComposed = composeCommands(f, identityCommand as Command<T, T>)
  const rightResult = await rightComposed.run(testInput, context)
  const rightIdentity = JSON.stringify(rightResult) === JSON.stringify(directResult)

  const details =
    !leftIdentity || !rightIdentity
      ? `Left: ${leftIdentity}, Right: ${rightIdentity}`
      : undefined

  return {
    leftIdentity,
    rightIdentity,
    details,
  }
}

/**
 * Verify monoid laws for commands
 *
 * 1. Left identity: identity ∘ f = f
 * 2. Right identity: f ∘ identity = f
 * 3. Associativity: (f ∘ g) ∘ h = f ∘ (g ∘ h)
 *
 * Note: This tests with the global identity (G_core scope). For protocol-specific
 * commands, each fiber M_P has its own identity element with scope G_p that should
 * be used for intra-fiber composition. The global identity is for cross-protocol
 * operations and will result in compositions defaulting to G_core scope.
 *
 * To test protocol-specific identity, retrieve it from the fiber:
 * `const protocolIdentity = fiber.commands.get('identity')`
 *
 * @param f - First command to test
 * @param testInput - Test input for command execution
 * @param context - Execution context
 * @param g - Optional second command for associativity test (defaults to identity)
 * @param h - Optional third command for associativity test (defaults to identity)
 * @returns Object indicating which monoid laws hold
 */
export async function verifyMonoidLaws<T>(
  f: Command<T, T>,
  testInput: T,
  context: ExecutionContext,
  g?: Command<T, T>,
  h?: Command<T, T>
): Promise<{
  leftIdentity: boolean
  rightIdentity: boolean
  associativity: boolean
}> {
  const monoid = createMonoid()

  // Test left identity: identity ∘ f = f
  const leftComposed = monoid.compose(identityCommand as Command<T, T>, f)
  const leftResult = await leftComposed.run(testInput, context)
  const directResult = await f.run(testInput, context)
  const leftIdentity = JSON.stringify(leftResult) === JSON.stringify(directResult)

  // Test right identity: f ∘ identity = f
  const rightComposed = monoid.compose(f, identityCommand as Command<T, T>)
  const rightResult = await rightComposed.run(testInput, context)
  const rightIdentity = JSON.stringify(rightResult) === JSON.stringify(directResult)

  // Test associativity: (f ∘ g) ∘ h = f ∘ (g ∘ h)
  // If g and h are not provided, use identity (trivial but safe default)
  // For rigorous testing, callers should provide independent g and h samples
  const gCommand = g || (identityCommand as Command<T, T>)
  const hCommand = h || (identityCommand as Command<T, T>)

  const leftAssoc = monoid.compose(monoid.compose(f, gCommand), hCommand)
  const rightAssoc = monoid.compose(f, monoid.compose(gCommand, hCommand))
  const leftAssocResult = await leftAssoc.run(testInput, context)
  const rightAssocResult = await rightAssoc.run(testInput, context)
  const associativity = JSON.stringify(leftAssocResult) === JSON.stringify(rightAssocResult)

  return {
    leftIdentity,
    rightIdentity,
    associativity,
  }
}

/**
 * Create an execution context with default values
 */
export function createExecutionContext(): ExecutionContext {
  return {
    protocolPreferences: {},
    wallet: {
      isConnected: false,
      isConnecting: false,
      isDisconnecting: false,
    },
    rpcRegistry: undefined,
    globalState: {},
    protocolState: new Map(),
    history: [],
  }
}

/**
 * Update execution context after command execution
 *
 * NOTE: Commands may mutate the context object (e.g., 'use' sets activeProtocol).
 * We must create a NEW object reference so React detects the state change.
 */
export function updateExecutionContext(
  context: ExecutionContext,
  command: Command,
  args: unknown,
  result: CommandResult,
  protocol?: ProtocolId
): ExecutionContext {
  const execution = {
    commandId: command.id,
    protocol,
    args,
    result: result.success ? result.value : result.error,
    timestamp: new Date(),
    success: result.success,
    error: result.success ? undefined : result.error,
  }

  // Create a NEW context object with all fields including any mutations
  // This ensures React detects the state change (different object reference)
  // IMPORTANT: Deep copy wallet to ensure wallet state is preserved
  return {
    activeProtocol: context.activeProtocol, // Explicitly copy (may have been mutated)
    protocolPreferences: context.protocolPreferences,
    wallet: { ...context.wallet }, // Deep copy to preserve wallet state
    rpcRegistry: context.rpcRegistry,
    globalState: context.globalState,
    protocolState: context.protocolState,
    history: [...context.history, execution],
  }
}
