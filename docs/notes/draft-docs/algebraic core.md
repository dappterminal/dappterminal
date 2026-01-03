# dappTerminal Algebraic Core

**Version:** 0.1.1  
**Last Updated:** 2025-10-23  
**Source Docs:** `ARCHITECTURE.md`, `FIBERED-MONOID-SPEC.md`  

This page describes the formal command model that powers dappTerminal. It is intentionally focused on the algebraic core and how it maps to implementation and tooling.

## Core Model

### Commands Form a Monoid

The command system is a monoid: there is a set of commands, a composition operation, and an identity command.

- **Set of commands ($M$):** all commands available to the system
- **Composition ($\circ$):** chaining two commands to form a new command
- **Identity ($e$):** a no-op command that returns its input unchanged

**Monoid laws:**
- **Associativity:** $(f \circ g) \circ h = f \circ (g \circ h)$
- **Left identity:** $e \circ f = f$
- **Right identity:** $f \circ e = f$

**Implementation:** `src/core/monoid.ts`

### Command Scopes

Commands are partitioned into three disjoint scopes:

$$
G = G_{core} \cup G_{alias} \cup G_p
$$

- **$G_{core}$:** global commands available everywhere (`help`, `use`, `wallet`, `balance`)
- **$G_{alias}$:** protocol-agnostic aliases (planned, binds at runtime)
- **$G_p$:** protocol-specific commands (`1inch:swap`, `wormhole:bridge`)

**Implementation:** `src/core/commands.ts`, `src/core/command-registry.ts`, `src/plugins/*/commands.ts`

### Protocol Fibers

Each protocol has its own submonoid (fiber):

$$
M_p \subseteq M
$$

Properties of each fiber:
- **Closure:** composing two commands in a protocol stays in that protocol
- **Identity:** each protocol fiber has its own identity element
- **Isolation:** commands from different protocols do not mix implicitly

**Implementation:** `createProtocolFiber` in `src/core/monoid.ts`

### Resolution Operators

Resolution is handled by explicit operators that map input to commands:

- **Projection ($\pi$):** map a command to its protocol (or undefined)
- **Section ($\sigma$):** return the command set (fiber) for a protocol
- **Exact resolver ($\rho$):** deterministic lookup by id or namespace
- **Fuzzy resolver ($\rho_f$):** Levenshtein-based matching for input typos

**Implementation:** `src/core/command-registry.ts`

### ExecutionContext

The `ExecutionContext` is the runtime state the algebra operates on:

- **activeProtocol:** current protocol fiber (or undefined)
- **protocolState:** per-protocol session cache
- **history:** command execution log
- **wallet:** connection and chain state

**Implementation:** `src/core/types.ts`

## Why This Matters for Tooling

- **Plugin registration:** every plugin command must use `scope: 'G_p'` and a protocol id, or it will not be fiber-safe.
- **Safe composition:** command composition preserves protocol boundaries unless you explicitly namespace-cross.
- **Central routing:** the command registry is the router for all tooling surfaces (CLI, API integrations, UI features).

## Implementation Notes (Mapping to Code)

- **Composition + identity:** `composeCommands`, `identityCommand` in `src/core/monoid.ts`
- **Scope partitions:** enforced by `CommandScope` typing and registry invariants
- **Fiber isolation:** validated when plugins register their fibers
- **Resolution flow:** `CommandRegistry.ρ` dispatches in order: core → aliases → protocol

## Quick Reference

$$
\begin{aligned}
M &= \text{set of all commands} \\
\circ &= \text{command composition} \\
e &= \text{identity command} \\
G_{core} &= \text{global commands} \\
G_{alias} &= \text{protocol-agnostic aliases (planned)} \\
G_p &= \text{protocol-specific commands} \\
M_p &= \text{protocol fiber (submonoid)} \\
\pi, \sigma, \rho, \rho_f &= \text{resolution operators}
\end{aligned}
$$
