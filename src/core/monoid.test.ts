/**
 * Tests for monoid implementation
 *
 * Verifies:
 * - Monoid laws (identity, associativity)
 * - Fiber closure property
 * - Ambient identity pattern
 * - Composition preserves protocol
 */

import { describe, it, expect } from '@jest/globals'
import {
  identityCommand,
  composeCommands,
  createProtocolFiber,
  addCommandToFiber,
  verifyMonoidLaws,
  verifyFiberClosure,
  verifyAmbientIdentity,
  createExecutionContext,
} from './monoid'
import type { Command } from './types'

describe('Monoid Laws', () => {
  const context = createExecutionContext()

  // Simple test command that doubles a number
  const doubleCommand: Command<number, number> = {
    id: 'double',
    scope: 'G_core',
    description: 'Double a number',
    run: async (args: number) => ({
      success: true,
      value: args * 2,
    }),
  }

  // Simple test command that adds 10
  const add10Command: Command<number, number> = {
    id: 'add10',
    scope: 'G_core',
    description: 'Add 10',
    run: async (args: number) => ({
      success: true,
      value: args + 10,
    }),
  }

  it('should satisfy left identity law', async () => {
    const result = await verifyMonoidLaws(doubleCommand, 5, context)
    expect(result.leftIdentity).toBe(true)
  })

  it('should satisfy right identity law', async () => {
    const result = await verifyMonoidLaws(doubleCommand, 5, context)
    expect(result.rightIdentity).toBe(true)
  })

  it('should satisfy associativity law', async () => {
    const result = await verifyMonoidLaws(doubleCommand, 5, context, add10Command, doubleCommand)
    expect(result.associativity).toBe(true)
  })

  it('should compose identity with command correctly', async () => {
    const leftComposed = composeCommands(identityCommand as Command<number, number>, doubleCommand)
    const result = await leftComposed.run(5, context)
    expect(result.value).toBe(10) // double(5) = 10

    const rightComposed = composeCommands(doubleCommand, identityCommand as Command<number, number>)
    const result2 = await rightComposed.run(5, context)
    expect(result2.value).toBe(10) // double(5) = 10
  })

  it('should compose commands associatively', async () => {
    // (double ∘ add10) ∘ double = double ∘ (add10 ∘ double)
    const leftAssoc = composeCommands(
      composeCommands(doubleCommand, add10Command),
      doubleCommand
    )
    const rightAssoc = composeCommands(
      doubleCommand,
      composeCommands(add10Command, doubleCommand)
    )

    const leftResult = await leftAssoc.run(5, context)
    const rightResult = await rightAssoc.run(5, context)

    expect(leftResult.value).toBe(rightResult.value)
  })
})

describe('Fiber Closure Property', () => {
  const fiber = createProtocolFiber('test-protocol', 'Test Protocol')

  // Protocol-specific commands
  const swapCommand: Command<string, string> = {
    id: 'swap',
    scope: 'G_p',
    protocol: 'test-protocol',
    description: 'Swap tokens',
    run: async (args: string) => ({
      success: true,
      value: `swapped-${args}`,
    }),
  }

  const liquidityCommand: Command<string, string> = {
    id: 'addLiquidity',
    scope: 'G_p',
    protocol: 'test-protocol',
    description: 'Add liquidity',
    run: async (args: string) => ({
      success: true,
      value: `liquidity-${args}`,
    }),
  }

  addCommandToFiber(fiber, swapCommand)
  addCommandToFiber(fiber, liquidityCommand)

  it('should maintain closure when composing same-fiber commands', () => {
    const result = verifyFiberClosure(fiber, swapCommand, liquidityCommand)

    expect(result.valid).toBe(true)
    expect(result.composedCommand).toBeDefined()
    expect(result.composedCommand?.scope).toBe('G_p')
    expect(result.composedCommand?.protocol).toBe('test-protocol')
  })

  it('should preserve protocol when composing fiber commands', () => {
    const composed = composeCommands(swapCommand, liquidityCommand)

    expect(composed.scope).toBe('G_p')
    expect(composed.protocol).toBe('test-protocol')
  })

  it('should reject commands not in fiber', () => {
    const outsideCommand: Command<string, string> = {
      id: 'outside',
      scope: 'G_core',
      description: 'Outside command',
      run: async (args: string) => ({ success: true, value: args }),
    }

    const result = verifyFiberClosure(fiber, swapCommand, outsideCommand)

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('not in fiber')
  })

  it('should reject commands from different fiber', () => {
    const otherCommand: Command<string, string> = {
      id: 'other',
      scope: 'G_p',
      protocol: 'other-protocol',
      description: 'Other protocol command',
      run: async (args: string) => ({ success: true, value: args }),
    }

    const result = verifyFiberClosure(fiber, swapCommand, otherCommand)

    expect(result.valid).toBe(false)
    expect(result.reason).toContain('not in fiber')
  })
})

describe('Protocol-Specific Identity', () => {
  const context = createExecutionContext()
  const fiber = createProtocolFiber('identity-test', 'Identity Test Protocol')

  const fiberCommand: Command<number, number> = {
    id: 'multiply',
    scope: 'G_p',
    protocol: 'identity-test',
    description: 'Multiply by 3',
    run: async (args: number) => ({
      success: true,
      value: args * 3,
    }),
  }

  addCommandToFiber(fiber, fiberCommand)

  it('should automatically include protocol-specific identity in fiber', () => {
    const commandIds = Array.from(fiber.commands.keys())
    expect(commandIds).toContain('identity')
  })

  it('protocol identity should have scope G_p and correct protocol', () => {
    const protocolIdentity = fiber.commands.get('identity')
    expect(protocolIdentity).toBeDefined()
    expect(protocolIdentity?.scope).toBe('G_p')
    expect(protocolIdentity?.protocol).toBe('identity-test')
  })

  it('should compose protocol identity with fiber command (left)', async () => {
    const protocolIdentity = fiber.commands.get('identity') as Command<number, number>
    const composed = composeCommands(protocolIdentity, fiberCommand)

    const result = await composed.run(7, context)
    expect(result.value).toBe(21) // multiply by 3

    // Composition stays in fiber
    expect(composed.scope).toBe('G_p')
    expect(composed.protocol).toBe('identity-test')
  })

  it('should compose protocol identity with fiber command (right)', async () => {
    const protocolIdentity = fiber.commands.get('identity') as Command<number, number>
    const composed = composeCommands(fiberCommand, protocolIdentity)

    const result = await composed.run(7, context)
    expect(result.value).toBe(21) // multiply by 3

    // Composition stays in fiber
    expect(composed.scope).toBe('G_p')
    expect(composed.protocol).toBe('identity-test')
  })

  it('global identity has scope G_core', () => {
    expect(identityCommand.scope).toBe('G_core')
    expect(identityCommand.protocol).toBeUndefined()
  })

  it('composing with global identity ejects from fiber (cross-scope)', () => {
    const composed = composeCommands(
      fiberCommand,
      identityCommand as Command<number, number>
    )

    // Cross-scope composition defaults to G_core
    expect(composed.scope).toBe('G_core')
    expect(composed.protocol).toBeUndefined()
  })
})

describe('Cross-Fiber Composition', () => {
  const fiber1 = createProtocolFiber('protocol-1', 'Protocol 1')
  const fiber2 = createProtocolFiber('protocol-2', 'Protocol 2')

  const command1: Command<string, string> = {
    id: 'cmd1',
    scope: 'G_p',
    protocol: 'protocol-1',
    description: 'Command 1',
    run: async (args: string) => ({
      success: true,
      value: `p1-${args}`,
    }),
  }

  const command2: Command<string, string> = {
    id: 'cmd2',
    scope: 'G_p',
    protocol: 'protocol-2',
    description: 'Command 2',
    run: async (args: string) => ({
      success: true,
      value: `p2-${args}`,
    }),
  }

  addCommandToFiber(fiber1, command1)
  addCommandToFiber(fiber2, command2)

  it('should default to G_core scope for cross-fiber composition', () => {
    const composed = composeCommands(command1, command2)

    expect(composed.scope).toBe('G_core')
    expect(composed.protocol).toBeUndefined()
  })

  it('cross-fiber composition should still execute correctly', async () => {
    const composed = composeCommands(command1, command2)
    const context = createExecutionContext()
    const result = await composed.run('test', context)

    expect(result.value).toBe('p2-p1-test')
  })
})
