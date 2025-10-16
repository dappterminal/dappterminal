/**
 * Base monoid implementation for DeFi commands
 *
 * Implements the algebraic structure where:
 * - Commands form a monoid under composition
 * - Each protocol forms a submonoid (fiber) M_P
 * - The global monoid M = G_core ∪ G_alias ∪ (⋃ M_P)
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
 * Identity command (no-op)
 * This is the identity element of the monoid
 */
export const identityCommand: Command = {
  id: 'identity',
  scope: 'G_core',
  description: 'Identity operation (no-op)',
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
 * A protocol fiber M_P is a submonoid of the global monoid M
 * satisfying the fibered structure over the base set of protocols
 */
export function createProtocolFiber(
  id: ProtocolId,
  name: string,
  description?: string
): ProtocolFiber {
  return {
    id,
    name,
    description,
    commands: new Map(),
  }
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
 * Verify monoid laws for commands
 *
 * 1. Left identity: identity ∘ f = f
 * 2. Right identity: f ∘ identity = f
 * 3. Associativity: (f ∘ g) ∘ h = f ∘ (g ∘ h)
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
    globalState: {},
    protocolState: new Map(),
    history: [],
  }
}

/**
 * Update execution context after command execution
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

  return {
    ...context,
    history: [...context.history, execution],
  }
}
