/**
 * Command registry with algebraic operators
 *
 * Implements the fibered monoid operators:
 * - π (projection): Maps commands to protocol namespaces
 * - σ (section): Loads protocol-specific command sets
 * - ρ (exact resolver): Deterministically resolves commands
 * - ρ_f (fuzzy resolver): Fuzzy command matching for CLI
 */

import type {
  Command,
  CommandScope,
  ProtocolFiber,
  ProtocolId,
  ResolvedCommand,
  ResolutionContext,
} from './types'

/**
 * Global command registry
 *
 * Manages all commands across three scopes:
 * - G_core: Core global commands
 * - G_alias: Aliased commands (protocol-agnostic)
 * - G_p: Protocol-specific commands (in fibers M_P)
 */
export class CommandRegistry {
  /** Core global commands */
  private coreCommands: Map<string, Command> = new Map()

  /** Aliased commands (protocol-agnostic, bound at runtime) */
  private aliasedCommands: Map<string, Command> = new Map()

  /** Protocol fibers (M_P for each protocol P) */
  private protocolFibers: Map<ProtocolId, ProtocolFiber> = new Map()

  /** Command aliases (alternate names) */
  private aliases: Map<string, string> = new Map()

  /**
   * Register a core command (G_core)
   */
  registerCoreCommand(command: Command): void {
    if (command.scope !== 'G_core') {
      throw new Error(`Command ${command.id} must have scope G_core`)
    }

    this.coreCommands.set(command.id, command)

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.id)
      }
    }
  }

  /**
   * Register an aliased command (G_alias)
   * These are protocol-agnostic and bound to a protocol at runtime
   */
  registerAliasedCommand(command: Command): void {
    if (command.scope !== 'G_alias') {
      throw new Error(`Command ${command.id} must have scope G_alias`)
    }

    this.aliasedCommands.set(command.id, command)

    // Register aliases
    if (command.aliases) {
      for (const alias of command.aliases) {
        this.aliases.set(alias, command.id)
      }
    }
  }

  /**
   * Register a protocol fiber (M_P)
   */
  registerProtocolFiber(fiber: ProtocolFiber): void {
    this.protocolFibers.set(fiber.id, fiber)

    // Register all commands in the fiber
    for (const command of fiber.commands.values()) {
      // Register aliases for protocol commands
      if (command.aliases) {
        for (const alias of command.aliases) {
          // Namespaced alias: protocol:alias
          this.aliases.set(`${fiber.id}:${alias}`, command.id)
        }
      }
    }
  }

  /**
   * π (Projection): Maps a command to its protocol namespace
   *
   * π: M → Protocols
   * For a command m ∈ M, returns the protocol P such that m ∈ M_P
   */
  π(command: Command): ProtocolId | undefined {
    if (command.scope !== 'G_p') {
      return undefined // Core and aliased commands don't belong to a specific protocol
    }

    return command.protocol
  }

  /**
   * σ (Section): Loads protocol-specific command set
   *
   * σ: Protocols → M
   * For a protocol P, returns the fiber M_P = π^(-1)(P)
   *
   * Mathematically: σ(P) represents "entering" protocol P
   */
  σ(protocol: ProtocolId): ProtocolFiber | undefined {
    return this.protocolFibers.get(protocol)
  }

  /**
   * ρ (Exact Resolver): Deterministically resolves a command
   *
   * Resolution order:
   * 1. Check G_core (core global commands)
   * 2. Check G_alias (aliased commands, bind protocol at runtime)
   * 3. Check protocol-scoped commands (G_p)
   *
   * Fiber isolation: When activeProtocol is set, only commands from
   * that fiber + global commands are accessible. Cross-fiber access
   * is blocked to maintain mathematical submonoid structure.
   */
  ρ(context: ResolutionContext): ResolvedCommand | undefined {
    const input = context.input.trim()

    // Check if input is a protocol name - if so, treat it as 'use <protocol>'
    if (this.protocolFibers.has(input)) {
      const useCommand = this.coreCommands.get('use')
      if (useCommand) {
        return {
          command: useCommand,
          resolutionMethod: 'exact',
          // Pass the protocol name as the argument
          protocolNameAsCommand: input,
        }
      }
    }

    // Check if this is a global alias
    let resolvedId = this.aliases.get(input) || input

    // Also check for protocol-local alias if active protocol is set
    // This allows 's' to resolve to 'swap' when inside uniswap-v4 context
    if (!this.aliases.has(input) && context.executionContext.activeProtocol) {
      const protocolAlias = `${context.executionContext.activeProtocol}:${input}`
      const protocolResolvedId = this.aliases.get(protocolAlias)
      if (protocolResolvedId) {
        resolvedId = protocolResolvedId
      }
    }

    // 1. Check G_core
    const coreCommand = this.coreCommands.get(resolvedId)
    if (coreCommand) {
      return {
        command: coreCommand,
        resolutionMethod: 'exact',
      }
    }

    // 2. Check G_alias
    const aliasedCommand = this.aliasedCommands.get(resolvedId)
    if (aliasedCommand) {
      // Bind protocol at runtime
      const protocol = this.resolveProtocol(resolvedId, context)
      return {
        command: aliasedCommand,
        protocol,
        resolutionMethod: 'alias',
      }
    }

    // 3. Check protocol-scoped commands (G_p)

    // FIBER ISOLATION: When inside a fiber, block cross-fiber access
    // Check for namespace syntax (protocol:command)
    const namespacedMatch = input.match(/^([^:]+):(.+)$/)
    if (namespacedMatch) {
      const [, protocol, commandId] = namespacedMatch

      // If we're in a fiber and trying to access a different fiber, block it
      if (context.executionContext.activeProtocol &&
          protocol !== context.executionContext.activeProtocol) {
        // Cross-fiber access blocked
        return undefined
      }

      const fiber = this.σ(protocol)
      const command = fiber?.commands.get(commandId)
      if (command) {
        return {
          command,
          protocol,
          resolutionMethod: 'protocol-scoped',
        }
      }
    }

    // First try explicit protocol from flag (only if not in a fiber)
    if (context.explicitProtocol && !context.executionContext.activeProtocol) {
      const fiber = this.σ(context.explicitProtocol)
      const command = fiber?.commands.get(resolvedId)
      if (command) {
        return {
          command,
          protocol: context.explicitProtocol,
          resolutionMethod: 'protocol-scoped',
        }
      }
    }

    // Try active protocol from context
    if (context.executionContext.activeProtocol) {
      const fiber = this.σ(context.executionContext.activeProtocol)
      const command = fiber?.commands.get(resolvedId)
      if (command) {
        return {
          command,
          protocol: context.executionContext.activeProtocol,
          resolutionMethod: 'protocol-scoped',
        }
      }
    }

    return undefined
  }

  /**
   * ρ_f (Fuzzy Resolver): Fuzzy command matching
   *
   * Uses string similarity to find closest matching command
   * Returns all matches above a confidence threshold
   *
   * Fiber isolation: When activeProtocol is set, only suggests commands
   * from that fiber + global commands. Cross-fiber suggestions are blocked.
   */
  ρ_f(
    context: ResolutionContext,
    threshold: number = 0.6
  ): ResolvedCommand[] {
    const input = context.input.trim().toLowerCase()
    const matches: ResolvedCommand[] = []

    // Helper to calculate string similarity (Levenshtein-based)
    const similarity = (a: string, b: string): number => {
      const longer = a.length > b.length ? a : b
      const shorter = a.length > b.length ? b : a

      if (longer.length === 0) return 1.0

      const editDistance = this.levenshteinDistance(longer, shorter)
      return (longer.length - editDistance) / longer.length
    }

    // Check all command sources
    const allCommands: Array<{ id: string; command: Command; protocol?: ProtocolId }> = []

    // Add core commands (always available)
    for (const [id, command] of this.coreCommands) {
      allCommands.push({ id, command })
    }

    // Add aliased commands (if not in a fiber)
    if (!context.executionContext.activeProtocol) {
      for (const [id, command] of this.aliasedCommands) {
        const protocol = this.resolveProtocol(id, context)
        allCommands.push({ id, command, protocol })
      }
    }

    // Add protocol commands - respecting fiber isolation
    if (context.executionContext.activeProtocol) {
      // Inside a fiber: only show current fiber's commands
      const activeFiber = this.σ(context.executionContext.activeProtocol)
      if (activeFiber) {
        for (const [id, command] of activeFiber.commands) {
          // Skip identity command from suggestions
          if (id !== 'identity') {
            allCommands.push({ id, command, protocol: context.executionContext.activeProtocol })
          }
        }
      }
    } else {
      // In M_G: show all protocol commands
      for (const [protocolId, fiber] of this.protocolFibers) {
        for (const [id, command] of fiber.commands) {
          // Skip identity commands from suggestions
          if (id !== 'identity') {
            allCommands.push({ id, command, protocol: protocolId })
          }
        }
      }
    }

    // Calculate similarity for each command
    for (const { id, command, protocol } of allCommands) {
      const confidence = similarity(input, id.toLowerCase())

      if (confidence >= threshold) {
        matches.push({
          command,
          protocol,
          resolutionMethod: 'fuzzy',
          confidence,
        })
      }

      // Also check aliases
      if (command.aliases) {
        for (const alias of command.aliases) {
          const aliasConfidence = similarity(input, alias.toLowerCase())
          if (aliasConfidence >= threshold) {
            matches.push({
              command,
              protocol,
              resolutionMethod: 'fuzzy',
              confidence: aliasConfidence,
            })
          }
        }
      }
    }

    // Sort by confidence (highest first)
    return matches.sort((a, b) => (b.confidence || 0) - (a.confidence || 0))
  }

  /**
   * Resolve protocol for a command at runtime
   *
   * Priority:
   * 1. Explicit protocol from --protocol flag
   * 2. User preferences for this command
   * 3. Active protocol in context
   * 4. First protocol in preference priority list
   */
  private resolveProtocol(
    commandId: string,
    context: ResolutionContext
  ): ProtocolId | undefined {
    // 1. Explicit flag
    if (context.explicitProtocol) {
      return context.explicitProtocol
    }

    // 2. User preference for this specific command
    const preferredProtocol = context.preferences.defaults[commandId]
    if (preferredProtocol) {
      return preferredProtocol
    }

    // 3. Active protocol
    if (context.executionContext.activeProtocol) {
      return context.executionContext.activeProtocol
    }

    // 4. First in priority list
    if (context.preferences.priority.length > 0) {
      return context.preferences.priority[0]
    }

    return undefined
  }

  /**
   * Calculate Levenshtein distance between two strings
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = []

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i]
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1]
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          )
        }
      }
    }

    return matrix[b.length][a.length]
  }

  /**
   * Get all registered protocols
   */
  getProtocols(): ProtocolId[] {
    return Array.from(this.protocolFibers.keys())
  }

  /**
   * Get all commands (across all scopes)
   */
  getAllCommands(): Command[] {
    const commands: Command[] = []

    // Core commands
    commands.push(...this.coreCommands.values())

    // Aliased commands
    commands.push(...this.aliasedCommands.values())

    // Protocol commands
    for (const fiber of this.protocolFibers.values()) {
      commands.push(...fiber.commands.values())
    }

    return commands
  }

  /**
   * Get commands by scope
   */
  getCommandsByScope(scope: CommandScope): Command[] {
    switch (scope) {
      case 'G_core':
        return Array.from(this.coreCommands.values())
      case 'G_alias':
        return Array.from(this.aliasedCommands.values())
      case 'G_p': {
        const commands: Command[] = []
        for (const fiber of this.protocolFibers.values()) {
          commands.push(...fiber.commands.values())
        }
        return commands
      }
    }
  }
}

/**
 * Global singleton registry instance
 */
export const registry = new CommandRegistry()
