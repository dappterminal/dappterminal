/**
 * Test protocol-local alias resolution
 *
 * Verifies that aliases defined within a protocol command
 * are resolved correctly when that protocol is active
 */

import { CommandRegistry } from '../command-registry'
import { createProtocolFiber, addCommandToFiber, createExecutionContext } from '../monoid'
import type { Command, CommandResult, ExecutionContext } from '../types'

describe('Protocol-local alias resolution', () => {
  let registry: CommandRegistry
  let context: ExecutionContext

  beforeEach(() => {
    registry = new CommandRegistry()
    context = createExecutionContext()
  })

  it('should resolve protocol-local aliases when active protocol is set', async () => {
    // Setup: Create a protocol with aliased command
    const fiber = createProtocolFiber('uniswap-v4', 'Uniswap v4')

    const swapCommand: Command = {
      id: 'swap',
      scope: 'G_p',
      protocol: 'uniswap-v4',
      description: 'Swap tokens',
      aliases: ['s', 'exchange'],
      async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
        return { success: true, value: 'swapped' }
      }
    }

    addCommandToFiber(fiber, swapCommand)
    registry.registerProtocolFiber(fiber)

    // Set active protocol
    context.activeProtocol = 'uniswap-v4'

    // Test: Resolve 's' with active protocol
    const resolved = registry.ρ({
      input: 's',
      executionContext: context,
      preferences: { defaults: {}, priority: [] }
    })

    expect(resolved).toBeDefined()
    expect(resolved?.command.id).toBe('swap')
    expect(resolved?.protocol).toBe('uniswap-v4')
    expect(resolved?.resolutionMethod).toBe('protocol-scoped')
  })

  it('should resolve full protocol-local alias "exchange"', async () => {
    // Setup: Create a protocol with aliased command
    const fiber = createProtocolFiber('uniswap-v4', 'Uniswap v4')

    const swapCommand: Command = {
      id: 'swap',
      scope: 'G_p',
      protocol: 'uniswap-v4',
      description: 'Swap tokens',
      aliases: ['s', 'exchange'],
      async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
        return { success: true, value: 'swapped' }
      }
    }

    addCommandToFiber(fiber, swapCommand)
    registry.registerProtocolFiber(fiber)

    // Set active protocol
    context.activeProtocol = 'uniswap-v4'

    // Test: Resolve 'exchange' with active protocol
    const resolved = registry.ρ({
      input: 'exchange',
      executionContext: context,
      preferences: { defaults: {}, priority: [] }
    })

    expect(resolved).toBeDefined()
    expect(resolved?.command.id).toBe('swap')
    expect(resolved?.protocol).toBe('uniswap-v4')
  })

  it('should NOT resolve protocol-local aliases without active protocol', async () => {
    // Setup: Create a protocol with aliased command
    const fiber = createProtocolFiber('uniswap-v4', 'Uniswap v4')

    const swapCommand: Command = {
      id: 'swap',
      scope: 'G_p',
      protocol: 'uniswap-v4',
      description: 'Swap tokens',
      aliases: ['s'],
      async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
        return { success: true, value: 'swapped' }
      }
    }

    addCommandToFiber(fiber, swapCommand)
    registry.registerProtocolFiber(fiber)

    // NO active protocol set
    context.activeProtocol = undefined

    // Test: Try to resolve 's' without active protocol
    const resolved = registry.ρ({
      input: 's',
      executionContext: context,
      preferences: { defaults: {}, priority: [] }
    })

    // Should NOT resolve (no active protocol context)
    expect(resolved).toBeUndefined()
  })

  it('should resolve namespaced aliases regardless of active protocol', async () => {
    // Setup: Create a protocol with aliased command
    const fiber = createProtocolFiber('uniswap-v4', 'Uniswap v4')

    const swapCommand: Command = {
      id: 'swap',
      scope: 'G_p',
      protocol: 'uniswap-v4',
      description: 'Swap tokens',
      aliases: ['s'],
      async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
        return { success: true, value: 'swapped' }
      }
    }

    addCommandToFiber(fiber, swapCommand)
    registry.registerProtocolFiber(fiber)

    // NO active protocol set
    context.activeProtocol = undefined

    // Test: Resolve with explicit namespace
    const resolved = registry.ρ({
      input: 'uniswap-v4:s',
      executionContext: context,
      preferences: { defaults: {}, priority: [] }
    })

    // Should resolve even without active protocol (explicit namespace)
    expect(resolved).toBeDefined()
    expect(resolved?.command.id).toBe('swap')
    expect(resolved?.protocol).toBe('uniswap-v4')
  })

  it('should prioritize global aliases over protocol-local aliases', async () => {
    // Setup: Create a core command with alias 'h'
    const helpCommand: Command = {
      id: 'help',
      scope: 'G_core',
      description: 'Show help',
      aliases: ['h'],
      async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
        return { success: true, value: 'help text' }
      }
    }
    registry.registerCoreCommand(helpCommand)

    // Setup: Create a protocol command also with alias 'h'
    const fiber = createProtocolFiber('uniswap-v4', 'Uniswap v4')
    const historyCommand: Command = {
      id: 'history',
      scope: 'G_p',
      protocol: 'uniswap-v4',
      description: 'Show history',
      aliases: ['h'],
      async run(_args: unknown, _context: ExecutionContext): Promise<CommandResult> {
        return { success: true, value: 'history' }
      }
    }
    addCommandToFiber(fiber, historyCommand)
    registry.registerProtocolFiber(fiber)

    // Set active protocol
    context.activeProtocol = 'uniswap-v4'

    // Test: Resolve 'h' - should prioritize global (G_core) alias
    const resolved = registry.ρ({
      input: 'h',
      executionContext: context,
      preferences: { defaults: {}, priority: [] }
    })

    expect(resolved).toBeDefined()
    expect(resolved?.command.id).toBe('help') // Global alias wins
    expect(resolved?.protocol).toBeUndefined()
  })
})
