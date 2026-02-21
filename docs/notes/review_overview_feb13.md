# Review Overview (Feb 13)

Date reviewed: 2026-02-14  
Roles used (per `AGENTS.md`): Architect -> Reviewer/QA

## Scope
- App-level architecture and runtime flow (`src/components/cli.tsx`, `src/components/app-layout.tsx`, API routes)
- CLI/core algebraic architecture (`src/core/*`)
- Modular plugin architecture and loader (`src/plugins/*`, `src/plugins/plugin-loader.ts`)
- Plugin-by-plugin behavior and handler integration
- Functionality outside the core architecture (analytics/tracking, auth/rate-limit, charts, notes/docs consistency)

## Executive Summary
The core idea (fibered monoid + protocol fibers + resolver operators) is implemented coherently, but runtime behavior still diverges from the architecture contract in several important places. The highest-risk gaps are alias dispatch/handler mismatches, incomplete LiFi execution wiring, and tab/plugin lifecycle coupling through global singletons. Documentation is also partially stale versus code reality.

## Findings (Ordered by Severity)

### Critical
1. Alias resolution can execute one protocol but dispatch handler for another (or no handler)
- `CommandRegistry.ρ` returns `resolved.protocol` for `G_alias` based on preference/active context (`src/core/command-registry.ts:173`-`src/core/command-registry.ts:182`), not on the protocol that the alias command ultimately executes.
- Alias commands then perform their own fallback protocol search and may run a different protocol command (`src/core/commands.ts:766`-`src/core/commands.ts:795`, `src/core/commands.ts:839`-`src/core/commands.ts:868`).
- CLI handler dispatch depends on `resolved.protocol` + `resolved.command.id` (`src/components/cli.tsx:1025`-`src/components/cli.tsx:1029`).
- Result: wrong handler can be selected, or no handler runs for a request payload that requires one.

2. `lifi:execute` produces execution payload but has no handler bound
- `executeCommand` returns `lifiTransferRequest` payload (`src/plugins/lifi/commands.ts:474`-`src/plugins/lifi/commands.ts:529`).
- LiFi handler registry only maps `bridge` (`src/plugins/lifi/handlers.ts:229`-`src/plugins/lifi/handlers.ts:230`).
- CLI dispatch looks up handlers by command id (`src/components/cli.tsx:1028`).
- Result: `execute` command cannot run LiFi transaction flow even when quote/route state exists.

### High
3. Plugin lifecycle is global while execution contexts are per-tab
- Tabs create independent `ExecutionContext` objects (`src/components/cli.tsx:665`, `src/components/cli.tsx:701`), but plugin loader is global singleton (`src/plugins/plugin-loader.ts:233`) and fibers are registered into global registry.
- New tabs repeatedly call `loadPlugin(...)` into the same loader (`src/components/cli.tsx:669`-`src/components/cli.tsx:674`, `src/components/cli.tsx:705`-`src/components/cli.tsx:710`).
- Result: tab isolation is partial; lifecycle semantics are ambiguous (per-tab state + global plugin/fiber registry).

4. Handler path bypasses `ExecutionContext.history` updates
- Non-handler path updates context via `updateExecutionContext(...)` (`src/components/cli.tsx:1134`-`src/components/cli.tsx:1151`).
- Handler path returns early before this update (`src/components/cli.tsx:1030`-`src/components/cli.tsx:1143`).
- Result: `ExecutionContext.history` and terminal-rendered history can diverge.

5. Namespaced alias (`protocol:s`) is effectively shadowed by global alias resolution in app runtime
- Alias map lookup runs before namespace parsing (`src/core/command-registry.ts:152`, `src/core/command-registry.ts:189`).
- `registerCoreCommands()` adds global `s -> swap` alias (`src/core/commands.ts:741`-`src/core/commands.ts:746`), which can intercept namespaced alias intent.
- Result: behavior differs from the intended explicit namespace semantics and from current alias tests.

### Medium
6. Unload is incomplete: fibers remain in command registry after plugin unload
- Loader explicitly deletes plugin entry but does not deregister fiber commands (`src/plugins/plugin-loader.ts:129`-`src/plugins/plugin-loader.ts:134`).
- Result: “unloaded” plugins can still leave resolvable commands behind.

7. Hybrid core/plugin model for CoinPaprika/Faucet is inconsistent
- Core imports commands directly from plugin folders (`src/core/commands.ts:9`-`src/core/commands.ts:10`).
- CoinPaprika/Faucet commands are `G_core`, and their plugin fibers contain no commands (`src/plugins/coinpaprika/index.ts:43`, `src/plugins/faucet/index.ts:41`).
- Result: these features are not truly plugin-modular; they are effectively core utilities stored under `plugins/`.

8. Test/typecheck pipeline is not wired for existing tests
- `pnpm exec tsc --noEmit` fails due to missing test runner globals/types and test typing issues (`src/core/__tests__/alias-resolution.test.ts`, `src/core/monoid.test.ts`).
- Result: static typecheck cannot be used as a stable CI gate in current repo state.

### Low
9. Excessive debug logging in critical runtime paths
- Frequent `console.log` in CLI/tab lifecycle and command flow (`src/components/cli.tsx:422`, `src/components/cli.tsx:428`, `src/components/cli.tsx:661`, `src/components/cli.tsx:1142`), plus plugin command/handler logging.
- Result: noisy logs, harder debugging, potential leakage of runtime context.

10. Documentation drift across notes/readme
- `docs/notes/help.md` points to `docs/notes/draft-docs/` but repository uses `docs/notes/draft-notes/` (`docs/notes/help.md:15`).
- README architecture examples reference files that no longer match exact structure/naming in places (for example CLI component naming and plugin behavior claims).
- Result: onboarding friction and wrong assumptions during future development.

## Plugin-by-Plugin Snapshot
- `1inch`: Structured command + handler pairing for `swap`/`limitorder`; operational, but still tightly coupled to client-side execution patterns.
- `uniswap-v4`: Deep handler flow for approvals/swaps/liquidity; large surface area and high complexity, with many debug logs.
- `stargate`: Bridge flow implemented with multi-step transaction execution and tracking; handler coverage focused on `bridge` only.
- `wormhole`: `bridge` path implemented via SDK in handler; `quote`/`routes` commands are still placeholder TODO outputs (`src/plugins/wormhole/commands.ts:34`, `src/plugins/wormhole/commands.ts:63`).
- `lifi`: Quote/routes/bridge logic is substantial, but `execute` command path is incomplete due to handler mapping gap.
- `aave-v3`: Supply/withdraw handler architecture is coherent and transaction-oriented; appears better aligned with plugin model.
- `coinpaprika` and `faucet`: Function as core commands, not as true protocol-fiber command modules.

## Functionality Outside Core Architecture
- Analytics/tracking pipeline (`track-client` -> `/api/analytics/track` -> Prisma service) is cleanly separated and resilient (fire-and-forget from client).
- Auth/rate-limit utilities exist and are used on sensitive 1inch routes; LiFi routes endpoint is rate-limited but intentionally unauthenticated (`src/app/api/lifi/routes/route.ts:16`).
- Charts and some data-provider behavior are still mixed into core command logic (`chart` command), blending provider concerns with core command surface.

## Validation Run
- `pnpm lint`: passes with warnings (42 warnings, 0 errors).
- `pnpm exec tsc --noEmit`: fails (test environment/types and test typing errors).

## Recommended Next Steps
1. Normalize alias execution contract: resolver should return the *actual* selected protocol (or alias commands should return protocol metadata consumed by dispatch).
2. Fix LiFi command-handler wiring (`execute` should map to a handler or be merged into `bridge` semantics).
3. Decide and enforce one lifecycle boundary: either per-tab loader+registry or global loader with explicitly shared semantics.
4. Ensure handler path updates `ExecutionContext.history` consistently.
5. Resolve core-vs-plugin boundary for CoinPaprika/Faucet and chart provider logic.
6. Add/align test runner config (`vitest`/`jest`) and isolate test tsconfig so typecheck is a reliable CI gate.
