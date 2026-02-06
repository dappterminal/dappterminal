# Sequential Command Running (Pipeline DSL)

**Last Updated:** 2026-02-05
**Status:** Design Notes
**Related:** `FIBERED-MONOID-SPEC.md`, `TOOLING_04_TRANSACTION_LIFECYCLE.md`, `TOOLING_09_OPEN_QUESTIONS.md`

This document captures design thinking around sequential command chaining — the ability to compose multiple CLI commands in a single input line, with data flowing between them.

---

## Motivation

Currently each command executes in isolation. A user wanting to swap tokens and then bridge the result must run two separate commands manually, copying output values between them:

```
user@defi> uniswap-v4:swap 10 usdc eth
  → Swapped 10 USDC for 0.0031 ETH
user@defi> lifi:bridge 0.0031 eth optimism arbitrum
  → Bridging 0.0031 ETH from Optimism to Arbitrum...
```

Sequential command running eliminates manual intermediate steps. A pipeline expresses intent as a single composed operation:

```
user@defi> uniswap-v4:swap 10 usdc eth => $swap && lifi:bridge $swap.amountOut eth optimism arbitrum
```

---

## Is This a DSL?

Yes. This is a **command pipeline DSL** — a domain-specific mini-language for composing DeFi operations. The language constructs are:

1. **Command invocation**: `protocol:command args...` (already exists)
2. **Variable binding**: capturing output from a command into a named reference
3. **Sequential chaining**: an operator connecting commands in execution order
4. **Variable interpolation**: using captured values as arguments in later commands

This is a small, focused DSL — not a general-purpose language. It's comparable to Unix shell pipes but with named variable bindings instead of stdin/stdout streams. The scope is intentionally narrow: compose DeFi operations, nothing more.

The algebraic foundation already supports this. `composeCommands` in `src/core/monoid.ts` implements the monoid composition operation $(f \circ g)(x) = g(f(x))$, but it is not yet exposed in the CLI. The pipeline DSL is the user-facing syntax that surfaces this existing algebraic capability.

---

## Existing Infrastructure

The codebase has strong foundations to build on:

| Component | Location | Relevance |
|-----------|----------|-----------|
| `composeCommands(f, g)` | `src/core/monoid.ts:61-103` | Monoid composition — chains output of f as input to g. Preserves fiber closure. |
| `CommandResult<T>` | `src/core/types.ts:114-116` | Standardized `{ success: true, value: T } \| { success: false, error: Error }`. Pipeline aborts on failure. |
| `ExecutionContext.globalState` | `src/core/types.ts:59` | Shared state across commands — natural home for pipeline variables. |
| `updateExecutionContext()` | `src/core/monoid.ts:383-412` | Tracks execution history with results. Pipeline steps feed into this. |
| Fiber isolation | `src/core/command-registry.ts` | Cross-fiber access rules. Pipelines must respect fiber boundaries (or operate from $M_G$). |
| Transaction lifecycle | Documented in `TOOLING_04` | Quote → Execute → Status loop. Pipeline chaining interacts with this lifecycle. |

---

## Syntax Analysis

### Original Proposal

```
uniswap-v4:swap 10 usdc eth WHERE return1 = eth && lifi:bridge return1 eth optimism arbitrum
```

Issues identified:

1. **`WHERE` has wrong semantics.** In SQL, `WHERE` filters results. Here the intent is variable *binding* (capturing output). The keyword misleads about what's happening.

2. **`return1 = eth` is ambiguous.** In the swap command, `eth` is the output *token symbol* (a command argument). But the command's actual return value is a complex object:
   ```ts
   {
     uniswapV4SwapRequest: true,
     params: { ... },
     tokenOutSymbol: "ETH",
     amountInFormatted: "10",
     minAmountOutFormatted: "0.0031",
     slippageBps: 50,
     ...
   }
   ```
   What does `return1` capture? The whole object? A specific field? The token name?

3. **`return1` naming convention.** Auto-numbered names (`return1`, `return2`) don't communicate intent. Named variables (`$swap`, `$bridgeResult`) are self-documenting.

4. **No field access syntax.** If the return value is an object, how do you access `amountOut` vs `tokenSymbol`? Flat interpolation isn't enough for structured data.

### Recommended Syntax

```
uniswap-v4:swap 10 usdc eth => $swap && lifi:bridge $swap.amountOut eth optimism arbitrum
```

**Language constructs:**

| Construct | Syntax | Example | Semantics |
|-----------|--------|---------|-----------|
| Chain operator | `&&` | `cmd1 && cmd2` | Run cmd2 only if cmd1 succeeds (bash convention) |
| Variable capture | `=> $name` | `swap 10 usdc eth => $swap` | Bind command's pipeline output to `$swap` |
| Variable interpolation | `$name` | `bridge $swap.amountOut` | Replace with captured value |
| Field access | `$name.field` | `$swap.amountOut` | Access a specific field on the captured result |
| Implicit result | `$_` | `bridge $_.amountOut` | Always refers to the most recent command's output |

**Why this syntax:**
- `=>` is universally understood as "produces" / "results in" (arrow functions, pattern matching)
- `$var` is the shell convention for variable interpolation
- `$_` is Perl/PowerShell convention for "last result"
- `&&` is bash convention for "continue on success"
- No new concepts to learn — users familiar with any shell will understand immediately

### Interaction With Fiber Isolation

Pipelines that reference multiple protocols (e.g., swap on Uniswap then bridge on LiFi) must execute from the global monoid $M_G$, not from within a fiber. This is consistent with existing fiber isolation rules:

```
# Valid — both commands resolve from M_G
user@defi> uniswap-v4:swap 10 usdc eth => $swap && lifi:bridge $swap.amountOut eth optimism arbitrum

# Valid — both commands in same fiber
user@uniswap-v4> swap 10 usdc eth => $swap && discover $swap.token

# Invalid — cross-fiber pipeline while in a fiber
user@uniswap-v4> swap 10 usdc eth => $swap && lifi:bridge $swap.amountOut eth optimism arbitrum
# → Error: cross-fiber access blocked. Exit to global context first.
```

---

## The Two-Phase Execution Problem

This is the hardest design challenge. Currently, commands have two execution phases:

**Phase 1 — `command.run()` (synchronous-ish):**
- Parse arguments, resolve tokens, fetch quotes
- Returns `CommandResult<T>` with preparation data (quote, tx params, etc.)
- No blockchain state changes yet

**Phase 2 — Handler (async, user-interactive):**
- Signs transactions (wallet popup)
- Submits to blockchain
- Waits for confirmation
- Updates CLI output with tx hashes, explorer links

For meaningful chaining, the bridge command doesn't need the swap *quote* — it needs the swap *result* (actual amount received after tx confirmation). This means the pipeline executor must wait for Phase 2 to complete before advancing to the next step.

### Chaining Timing (Design Decision)

**Decision: Both modes, user chooses.**

- **Default: Post-transaction chaining.** Each pipeline step waits for the previous step's transaction to confirm on-chain, then uses the actual result. Accurate but slower (30s–5min per step depending on chain).

- **Optional: Quote-time chaining (`--estimate` or `--dry-run` flag).** Pipeline runs using quoted/estimated values immediately. Useful for previewing what a pipeline *would* do without executing. Amounts are estimates, not guaranteed.

```
# Post-tx (default) — waits for swap confirmation, uses actual amount
user@defi> uniswap-v4:swap 10 usdc eth => $swap && lifi:bridge $swap.amountOut eth optimism arbitrum

# Dry-run — uses estimated amounts, no transactions
user@defi> uniswap-v4:swap 10 usdc eth => $swap && lifi:bridge $swap.amountOut eth optimism arbitrum --dry-run
```

This connects directly to TOOLING_09's "Shared Transaction Executor" open question — a pipeline executor is essentially an ordered transaction executor with variable binding between steps.

---

## Pipeline Output Schema

Commands currently return heterogeneous `CommandResult<T>` values. For pipelines to work, we need a standardized **pipeline output** that commands can optionally expose — a common shape describing what the command produced for downstream consumption.

```ts
interface PipelineOutput {
  // Token/amount fields (most common for DeFi)
  amount?: string           // Human-readable output amount (e.g., "0.0031")
  amountRaw?: string        // Raw output amount in base units
  token?: string            // Output token symbol (e.g., "ETH")
  tokenAddress?: string     // Output token contract address

  // Transaction fields (populated after Phase 2)
  txHash?: string           // Transaction hash
  chainId?: number          // Chain the result lives on

  // Extensible
  [key: string]: unknown    // Protocol-specific fields
}
```

This is additive — existing commands don't break. They optionally add a `pipelineOutput` field to their result value. Commands without it can still be chained but only expose their raw result object via `$_`.

---

## Pipeline Confirmation (Design Decision)

**Decision: Optional confirmation via `--confirm` flag.**

By default, pipelines execute immediately (the user typed it, they meant it). The `--confirm` flag shows a preview before executing:

```
user@defi> uniswap-v4:swap 10 usdc eth => $swap && lifi:bridge $swap.amountOut eth optimism arbitrum --confirm

Pipeline Preview:
  Step 1: uniswap-v4:swap — Swap 10 USDC → ETH
  Step 2: lifi:bridge — Bridge [result of step 1] ETH, Optimism → Arbitrum

Execute pipeline? [y/n]
```

---

## Architectural Components (Sketch)

These are the conceptual pieces, not an implementation plan:

### 1. Pipeline Parser
Tokenize a pipeline input string into structured steps. Split on `&&`, extract `=> $name` captures, identify `$var.field` interpolation sites in arguments.

### 2. Pipeline Context / Variable Store
A `Map<string, unknown>` holding named captures plus a `$_` implicit binding. Lives for the duration of one pipeline execution, then discards.

### 3. Pipeline Executor
Sequential loop: for each step, interpolate variables into args → resolve command → execute → capture result → update variable store. Abort on failure (since `&&` means "continue only on success").

The executor must bridge Phase 1 and Phase 2 — it needs to know when a command's handler has completed (tx confirmed) before advancing. This likely requires extending the handler system with a completion callback or promise.

### 4. CLI Detection
Detect `&&` in input → route to pipeline executor instead of single command execution. Simple heuristic, no ambiguity with existing command syntax.

---

## Relationship to Existing Algebraic Structure

The pipeline DSL is the **user-facing projection of the monoid composition operation**.

Algebraically, a pipeline `f => $x && g($x)` is the composition $g \circ f$ where the intermediate value is explicitly named. The `composeCommands` function already implements this at the type level:

```ts
// src/core/monoid.ts:61
function composeCommands<A, B, C>(
  f: Command<A, B>,
  g: Command<B, C>
): Command<A, C>
```

The pipeline DSL adds:
- **Parsing**: Turn string syntax into composition calls
- **Named intermediates**: `$var` bindings (the monoid doesn't need these, but users do)
- **Runtime interpolation**: Substitute actual values into argument strings before resolution
- **Cross-fiber composition**: Compose commands from different fibers (only from $M_G$)

This extends the monoid from a developer-facing API to a user-facing language feature, which is the natural next step for the architecture.

---

## Open Questions

1. **What about error recovery?** If step 2 of 4 fails, the user has already executed steps 1. Should there be a rollback concept, or is "abort and report" sufficient? (For DeFi, on-chain actions can't be rolled back, so abort-and-report is likely the only option.)

2. **Pipeline-aware autocomplete?** When typing after `&&`, should the autocomplete system suggest commands and show available `$var` names? This is a UX enhancement, not critical for v1.

3. **Saved pipelines / macros?** Could users save a pipeline as a named shortcut? e.g., `alias swap-and-bridge = "uniswap-v4:swap $1 $2 $3 => $s && lifi:bridge $s.amountOut $3 $4 $5"`. This is a future extension, not in scope for initial work.

4. **How does this interact with `composeCommands` directly?** The existing monoid composition operates on `Command<A, B>` type parameters. The pipeline DSL operates on string arguments. These are two different layers — the DSL could eventually lower to `composeCommands` calls, or it could remain a separate execution path. Worth deciding when implementation begins.

---

## References

- `src/core/monoid.ts` — `composeCommands`, `identityCommand`, fiber creation
- `src/core/types.ts` — `CommandResult`, `ExecutionContext`, `Command` interface
- `src/core/command-registry.ts` — Resolution operators (ρ, σ), fiber isolation
- `src/components/cli.tsx` — Command input parsing, handler dispatch
- `FIBERED-MONOID-SPEC.md` — Formal algebraic specification
- `TOOLING_04_TRANSACTION_LIFECYCLE.md` — Quote → Execute → Status loop
- `TOOLING_09_OPEN_QUESTIONS.md` — Shared Transaction Executor (related)
