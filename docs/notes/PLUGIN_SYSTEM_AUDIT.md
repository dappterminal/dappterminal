# Plugin System & Core Architecture Audit

Date: 2026-02-01

## Scope
- Core command monoid/registry/CLI dispatch and plugin loader lifecycle
- Plugin implementations, handler dispatch, and template usage

## Continuity (Core ↔ Plugins)
- **Core → Plugins:** `CommandRegistry` resolves commands across `G_core`, `G_alias`, `G_p`, then `pluginLoader` provides fibers and handlers (`src/core/command-registry.ts`, `src/plugins/plugin-loader.ts`, `src/components/cli.tsx`).
- **Plugins → Core:** Plugins create fibers via `createProtocolFiber`, register commands via `addCommandToFiber`, and optionally provide handlers invoked by the CLI (`src/core/monoid.ts`, `src/plugins/*/index.ts`, `src/components/cli.tsx`).
- **State continuity:** Per-protocol state is stored in `ExecutionContext.protocolState` and used directly by plugin commands (`src/core/types.ts`, `src/plugins/uniswap-v4/commands.ts`, `src/plugins/lifi/commands.ts`).

## Redundancy / Inconsistencies
- **Dual registration of commands:** `coinpaprika` and `faucet` commands are registered as `G_core` commands and also attempted as plugin fiber commands. Those commands have `scope: 'G_core'` but are passed to `addCommandToFiber`, which will throw if the plugins are ever loaded (`src/plugins/coinpaprika/commands.ts`, `src/plugins/coinpaprika/index.ts`, `src/plugins/faucet/commands.ts`, `src/plugins/faucet/index.ts`, `src/core/monoid.ts`).
- **Repeated argument parsing and flag handling:** Many commands re-implement token/flag parsing (e.g., `swap`, `quote`, `chart`, `bridge`) instead of shared helpers, increasing drift risk and inconsistencies (`src/core/commands.ts`, `src/plugins/uniswap-v4/commands.ts`, `src/plugins/lifi/commands.ts`).
- **Per-tab plugin load duplication:** Plugins are loaded for each tab into a **global** `pluginLoader` without guarding for already-loaded plugins; initialization is repeated and can overwrite the same registry entries (`src/components/cli.tsx`, `src/plugins/plugin-loader.ts`).
- **Config redundancy:** `PluginConfig` exists but is not injected into `initialize()` or command execution; most defaults are unused beyond validation (`src/plugins/types.ts`, `src/plugins/*/index.ts`).

## Maintainability Improvements (Recommended)
- **Introduce a shared plugin scaffold/generator:** Wrap `src/plugins/_template` with a script (e.g., `pnpm create:plugin <id>`) that clones, renames, updates metadata, and creates API route stubs. This avoids manual edits and guarantees structure parity.
- **Create shared command utilities:** Centralize token/flag parsing, wallet guards, and per-protocol state helpers (`getProtocolState/setProtocolState`) to reduce duplication and mismatched parsing logic.
- **Single source of truth for plugin list:** Move the plugin list into a manifest (e.g., `src/plugins/manifest.ts`) and load from it per-tab to prevent drift and reduce repeated imports.
- **Optional typed handler payloads:** Define shared payload schemas per command to avoid runtime shape mismatch between command results and handlers.

## Edge Cases & Scalability Risks
- **Protocol mismatch for alias handlers:** The alias command (`swap`/`bridge`/`price`) chooses a protocol internally, but the resolver’s `resolved.protocol` can differ, causing handler lookup to target the wrong plugin (`src/core/command-registry.ts`, `src/core/commands.ts`, `src/components/cli.tsx`).
- **Fiber isolation is bypassed by aliases:** Even when a protocol is active, alias commands can fall back to other protocols, which conflicts with the “no cross-fiber access” contract (`src/core/command-registry.ts`, `src/core/commands.ts`).
- **Handler execution bypasses `ExecutionContext` history updates:** In the handler dispatch path, `updateExecutionContext` is skipped, so command history stored in `ExecutionContext.history` diverges from terminal history (`src/components/cli.tsx`, `src/core/monoid.ts`).
- **Plugin unload is partial:** `unloadPlugin` removes the plugin entry but leaves the fiber in the registry, so commands remain resolvable after “unload” (`src/plugins/plugin-loader.ts`).

## Critical Risk Assessment

| Issue | Rating | Rationale | References |
| --- | --- | --- | --- |
| Alias command protocol mismatch vs handler selection | **High** | Can dispatch handler from protocol A while command execution used protocol B; risks incorrect signing flows or wrong chain assumptions. | `src/core/command-registry.ts`, `src/core/commands.ts`, `src/components/cli.tsx` |
| Fiber isolation bypass via alias fallback | **Medium** | Active protocol context can still execute commands from other protocols, undermining the architectural contract and user expectations. | `src/core/command-registry.ts`, `src/core/commands.ts` |
| Handler path skips `ExecutionContext` history updates | **Medium** | Internal history (used by core commands like `history`) becomes incomplete for handler-based commands. | `src/components/cli.tsx`, `src/core/commands.ts`, `src/core/monoid.ts` |
| Plugin unload does not deregister commands | **Low** | Unload gives a false sense of removal; command registry still resolves commands. | `src/plugins/plugin-loader.ts`, `src/core/command-registry.ts` |
| `G_core` commands registered as plugin fiber commands | **Low** | Loading `coinpaprika`/`faucet` plugins would throw at runtime because scopes are wrong. | `src/plugins/coinpaprika/index.ts`, `src/plugins/faucet/index.ts`, `src/core/monoid.ts` |

## Suggested Scaffold/Template Enhancements
- **Template tokenization:** Add placeholders for `id`, `name`, and command list, auto-replaced by a script.
- **API route generator:** Optional creation of `src/app/api/<protocol-id>` endpoints from a minimal spec (quote/swap/status).
- **Defaults wiring:** Allow `PluginConfig` to be injected into `initialize()` and command utilities so defaults are actually used.

## Summary
The core model is consistent and well-separated (registry + fibers + handlers), but the current CLI dispatch and alias resolution introduce continuity breaks: protocol mismatch for handlers, fiber isolation bypass, and missing history updates. Plugin scaffolding exists but is manual; a generator and shared command utilities would reduce redundancy and improve long-term maintainability.
