# Tooling Layers and Responsibilities

**Last Updated:** 2026-01-02

This page expands the tooling stack beyond the one-pager. Each layer has a clear boundary so command composition in $M$ stays clean while protocol work stays inside $M_p$ fibers.

---

## Layer Map (Quick View)

```
User Input
  ▼
CLI / Terminal UI
  ▼
Core Runtime (Monoid + Registry)
  ▼
Plugin Layer (Protocol Fibers)
  ▼
API Layer (Server Routes)
  ▼
Shared Libs + External Services
```

---

## 1) CLI / Terminal UI

**Primary responsibility:** user interaction, parsing, and rendering.

- Captures raw input, splits command + args, and routes to the command registry.
- Owns the tab model; each tab has its own `ExecutionContext`.
- Connects wallet state to the runtime (address, chain ID, connection status).
- Presents transaction drafts and confirmations before signing.

**Primary surfaces:**
- `src/components/cli.tsx`
- `src/app/page.tsx`
- `src/app/layout.tsx`

---

## 2) Core Runtime (Monoid + Registry)

**Primary responsibility:** algebraic guarantees and command dispatch.

- Composition and identity defined in $(M, \circ, e)$.
- Commands partitioned into $G_{core}$, $G_{alias}$ (planned), and $G_p$.
- Resolution operators $\pi$, $\sigma$, $\rho$, $\rho_f$ enforce fiber routing.
- Execution context provides protocol-scoped state and history for UX.

**Primary surfaces:**
- `src/core/monoid.ts`
- `src/core/command-registry.ts`
- `src/core/types.ts`

---

## 3) Plugin Layer (Protocol Fibers)

**Primary responsibility:** protocol-specific command surfaces.

- Each plugin exposes commands in $G_p$ with `scope: 'G_p'` and a protocol id.
- Plugins register through the loader and create fibers via `createProtocolFiber`.
- Commands shape inputs, call API routes or SDKs, and update protocol state.

**Primary surfaces:**
- `src/plugins/plugin-loader.ts`
- `src/plugins/*/index.ts`
- `src/plugins/*/commands.ts`

---

## 4) API Layer (Next.js App Router)

**Primary responsibility:** server-side proxy and security boundary.

- Hosts `/api/[protocol]/[action]` routes.
- Keeps API keys server-side and normalizes response envelopes.
- Returns unsigned transaction payloads for client-side signing.

**Primary surfaces:**
- `src/app/api/README.md`
- `src/app/api/*/route.ts`

---

## 5) Shared Libraries

**Primary responsibility:** reusable helpers to avoid drift.

- Chain maps, token registries, quote builders, and formatters.
- Shared by API routes and plugins for consistent behavior.

**Primary surfaces:**
- `src/lib/chains.ts`
- `src/lib/*` (protocol-specific helpers)

---

## 6) External Services

**Primary responsibility:** protocol-side execution.

- DEX/bridge APIs, SDKs, explorers, and databases.
- Typically accessed via API routes to keep secrets server-side.

---

## Notes on Boundaries

- The CLI should not embed protocol secrets.
- Plugins should not bypass the registry; always resolve via $\rho$.
- API routes return data, never sign transactions.
- Shared libs are the only place where cross-layer utility logic lives.
