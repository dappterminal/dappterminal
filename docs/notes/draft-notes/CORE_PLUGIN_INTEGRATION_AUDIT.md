# Core vs Plugin Integration Audit

Date: 2026-02-04

## Roles Used
- Architect → Reviewer/QA

## Scope
- Core functionality that currently blends with plugin concerns
- Swap window, charts, node provider window
- Alignment with fibered monoid architecture (G_core, G_alias, G_p)

---

## Audit Summary (Core vs Plugin)

### Swap Window
**Current state**
- Implemented as a core UI component with hardcoded protocol list and routing in the UI.
- File: `src/components/swap/swap-window.tsx`

**Why this conflicts with architecture**
- Protocol identity belongs in plugins (G_p), not core.
- Core should not hardcode protocol inventories.

**Recommendation**
- Keep the swap window shell/chrome in core.
- Source protocol list + quote/tx logic from plugin capabilities.
- Use the same dispatch path as CLI (G_alias → G_p).

---

### Charts
**Current state**
- Core owns chart window management and chart components.
- `chart` command is G_core but directly calls protocol-specific logic (coinpaprika/1inch).
- Files: `src/components/app-layout.tsx`, `src/components/charts/*`, `src/core/commands.ts`

**Why this conflicts with architecture**
- G_core should remain protocol-agnostic.
- Data providers should be plugin-owned, not invoked directly by core.

**Recommendation**
- Core keeps chart window orchestration and generic chart command.
- Plugins provide data providers (e.g., `coinpaprika:chart`, `1inch:chart`).
- Non-protocol charts (performance/network/portfolio) remain G_core.

---

### Node Provider Window
**Current state**
- Implemented as a UI-only window with no persistence or runtime wiring.
- File: `src/components/app-layout.tsx`

**Why this conflicts with architecture**
- Global RPC settings should be core state, exposed via ExecutionContext/PluginConfig.
- Plugins currently cannot consume UI-provided RPC settings.

**Recommendation**
- Treat node provider configuration as core settings.
- Persist RPC registry (per-chain) and inject into ExecutionContext or PluginConfig.
- Plugins use core-provided RPC settings when initializing transports.

---

## Plugins Acting Like Core Features (Integration Issues)

### CoinPaprika & Faucet (fixed)
**Current state**
- Commands are registered as G_core and also loaded via plugin fiber, which breaks scope invariants.
- Reference: `docs/notes/PLUGIN_SYSTEM_AUDIT.md`

**Recommendation**
Choose one:
1) Promote to core-only utilities and remove plugin registration, or
2) Keep as plugins with G_p scope (e.g., `coinpaprika:price`, `faucet:request`) and optional G_alias/G_core wrappers.

---

## Recommended Integration Model

### Core should own
- Window manager / chrome / layout
- G_core commands for app-level features
- G_alias routing (swap/bridge)
- Global RPC registry (wired into ExecutionContext/PluginConfig)

### Plugins should own
- Protocol command implementations (G_p)
- Protocol-specific data providers (charts, prices)
- Swap/bridge handlers
- Optional UI capability exports if needed

---

## Reviewer/QA Risks
- Swap window diverges from CLI behavior because protocols are hardcoded.
- Core chart command violates protocol-agnostic rule by calling plugin logic directly.
- Node provider window has no persistence or connection to plugin transports.

---

## Suggested Next Steps
1) Add a plugin capability registry (swap/chart/rpc).
2) Refactor chart command into core window management + plugin data providers.
3) Implement core RPC registry and plumb into ExecutionContext/PluginConfig.
