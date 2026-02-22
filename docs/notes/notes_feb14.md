# Notes - Feb 14, 2026

## Purpose
This note consolidates the CLI hardening audit and the system design direction for evolving the app into a shared runtime that can power both terminal and visual UI surfaces.

## Core Position
The current product direction is valid: CLI-first, GUI later.

The correction is architectural:
- The CLI should be a client of the runtime, not the runtime itself.
- The business logic source of truth should be a headless execution core.

Unix analogy:
- Kernel: execution/runtime engine (headless, typed, testable).
- Shell: terminal adapter (text parsing + rendering).
- Desktop: visual adapter (swap windows, provider UI, charts, etc.).

## Why CLI Hardening Must Come Before Pipeline DSL
Shipping full sequential command DSL now would amplify current execution-path weaknesses.

### Current blockers
1. No handler return channel for chained step outputs.
- Handler contract returns `Promise<void>`, so post-handler structured chaining data is not available.

2. Handler path bypasses consistent context/history update.
- Early returns in handler flow skip unified context update semantics.

3. Global execution lock is not a scheduler.
- Single `isExecuting` lock with drop-on-busy behavior is unsafe for deterministic multi-step execution.

4. Parser path is too primitive for DSL grammar.
- Current split-based parsing is insufficient for `&&`, `=> $var`, `$var.field`, quoting/escaping.

5. Pipeline variable store lifecycle is undefined.
- No clean, execution-scoped variable environment currently enforced.

## Immediate Strengthening Plan (Phase 0)
Before full DSL, implement execution-core hardening:

1. Add `HandlerResult` contract.
- Include structured `pipelineOutput`.
- Allow controlled context patching where needed.

2. Guarantee context update for all execution paths.
- Ensure both normal and handler-based commands pass through unified context/history update.

3. Replace global command lock with per-tab FIFO queue.
- Deterministic sequencing.
- No silent command drops.

4. Extract command parse/resolve/execute from `cli.tsx`.
- Move into a testable service/module (`ExecutionEngine` boundary).

5. Add runtime event model.
- Emit typed events (`quote_ready`, `tx_requested`, `tx_sent`, `tx_confirmed`, `error`).
- CLI and GUI render the same events differently.

## Target Architecture
### ExecutionEngine (headless)
Responsibilities:
- Resolve command + protocol binding.
- Execute command and handler lifecycle.
- Maintain execution context/history.
- Emit structured events.
- Own queue/scheduling semantics.

### Interface Adapters
1. CLI Adapter
- Text parser and prompt interaction.
- Subscribes to events and renders terminal output.

2. Desktop/UI Adapter
- Typed input forms and visual flow controls.
- Subscribes to the same events for graphical presentation.

Outcome:
- No duplicated business logic between terminal and GUI.
- Visual components become first-class clients of the same runtime.

## Sequential DSL Rollout (after hardening)
Phase A:
- `cmd1 && cmd2` only.

Phase B:
- Variable capture/interpolation: `=> $var`, `$var.field`.

Phase C:
- `--dry-run` and `--confirm` workflow support.

## Design Guardrails
1. UI must never bypass execution engine for protocol operations.
2. Text parsing remains CLI-specific; runtime API remains typed.
3. Plugin handlers should return structured outputs, not UI-specific side effects.
4. Logging should be gated/structured (`debugLog`), not ad-hoc runtime noise.

## Critique of GUI-from-terminal Concern
It is not inherently wrong to grow GUI from terminal capabilities.
It becomes problematic only if:
- Terminal string parsing becomes the business API.
- GUI calls protocol APIs directly and diverges from CLI path.
- Runtime state mutation rules differ across interfaces.

With a shared kernel model, this concern is resolved.

## Recommended Decision
Do not ship full sequential DSL yet.

Prioritize Phase 0 hardening and extraction of a headless execution core.
Then ship DSL incrementally on top of the hardened engine.

