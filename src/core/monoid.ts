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
  return {
    id: `${f.id}_then_${g.id}`,
    scope: 'G_core', // Composed commands live in global scope
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
 * Verify monoid laws for a command
 *
 * 1. Left identity: identity ∘ f = f
 * 2. Right identity: f ∘ identity = f
 * 3. Associativity: (f ∘ g) ∘ h = f ∘ (g ∘ h)
 */
export async function verifyMonoidLaws<T>(
  command: Command<T, T>,
  testInput: T,
  context: ExecutionContext
): Promise<{
  leftIdentity: boolean
  rightIdentity: boolean
  associativity: boolean
}> {
  const monoid = createMonoid()

  // Test left identity: identity ∘ f = f
  const leftComposed = monoid.compose(identityCommand, command)
  const leftResult = await leftComposed.run(testInput, context)
  const directResult = await command.run(testInput, context)
  const leftIdentity = JSON.stringify(leftResult) === JSON.stringify(directResult)

  // Test right identity: f ∘ identity = f
  const rightComposed = monoid.compose(command, identityCommand)
  const rightResult = await rightComposed.run(testInput, context)
  const rightIdentity = JSON.stringify(rightResult) === JSON.stringify(directResult)

  // Test associativity: (f ∘ g) ∘ h = f ∘ (g ∘ h)
  // Using identity as g and h for simplicity
  const leftAssoc = monoid.compose(monoid.compose(command, identityCommand), identityCommand)
  const rightAssoc = monoid.compose(command, monoid.compose(identityCommand, identityCommand))
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
