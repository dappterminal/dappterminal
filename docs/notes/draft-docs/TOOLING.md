 \   # Tooling Overview (Scaffold)

**Last Updated:** 2025-10-23

This document is a scaffolded map of the major tooling surfaces in the DeFi Terminal. It distills the algebraic core, the plugin/tooling layers, and how the protocol-specific integrations differ and connect. It is not exhaustive; it is meant to orient contributors quickly and point to deeper docs.

---

## 1) System Map (One-Pager)

```
User CLI/Terminal UI
        │
        ▼
Command Registry + Execution Context
(fibered monoid runtime)
        │
        ├─ Core Commands (G_core)
        ├─ Plugin Commands (G_p)
        └─ Aliases (G_alias, planned)
        │
        ▼
Protocol Plugins
        │
        ├─ API Routes (Next.js app router)
        ├─ SDK/HTTP Clients (protocol-specific)
        └─ Shared Libs (per-protocol helpers)
        │
        ▼
External Services
(bridges, DEXes, faucets, RPCs, DB)
```

---

## 2) Algebraic Core (Fibered Monoid Runtime)

**Source docs:** `ARCHITECTURE.md`, `FIBERED-MONOID-SPEC.md`

- **Commands form a monoid** with composition and identity.
- **Scopes:** `G_core` (global), `G_alias` (protocol-agnostic, planned), `G_p` (protocol-specific).
- **Fibers (M_p):** each protocol is a submonoid with its own identity; closure is preserved.
- **Resolution operators:** projection, section, exact, and fuzzy resolution handle dispatch.
- **ExecutionContext:** holds active protocol, protocol state, command history, wallet state.

Why it matters for tooling:
- Every plugin must register commands with `scope: 'G_p'` and a protocol id.
- Composition stays within a protocol fiber unless explicitly namespace-crossing.
- The resolution layer is the "router" for all tooling surfaces.

---

## 3) Tooling Layers and Responsibilities

### 3.1 Core CLI/Terminal UI
- Owns user interaction, command parsing, wallet connection.
- Displays command outputs and transaction summaries.
- Manages tabs, each with its own execution context.

### 3.2 Plugin Layer (Protocol Tooling)
- One plugin per protocol; registered via the plugin loader.
- Exposes protocol-specific commands (`protocol:command`).
- Encapsulates API calls, SDK logic, and per-protocol state caching.

### 3.3 API Layer (Next.js App Router)
- Server-side proxy for protocol APIs and keys.
- Normalizes responses (`{ success: true, data }` or `{ success: false, error }`).
- Keeps secrets off the client and enforces validation/rate-limits where needed.

### 3.4 Shared Libraries
- Per-protocol helpers (chain maps, token registries, quote builders).
- Used by both API routes and CLI commands to avoid duplication.

---

## 4) Transaction Lifecycle (Common Pattern)

Most protocol tools follow a common quote → execute → status loop:

1. **Quote/Preview**
   - Fetch pricing, route, or transfer steps.
   - Cache in `ExecutionContext.protocolState`.
2. **Prepare/Execute**
   - Build unsigned transactions (multi-step when needed).
   - Wallet signs and broadcasts.
3. **Status/Track**
   - Poll for completion or finality.
   - Emit explorer links and receipts.

---

## 5) Protocol Tooling Differences

This is where the tooling diverges by protocol, even though it fits the same monoid runtime.

### 5.1 LiFi (Bridge Aggregator)
- **Commands**: bridge <amount> <token0> <token1> <network0> <network1> *(token1 is optional for some token pairs, like USDC or ETH)*

- **Architecture:** CLI plugin + separate proxy app (`../lifi-api-nextjs`).
- **Why different:** API key must stay server-side; advanced route planning.
- **Flow:** route quote → step transaction prep → execute → status.
- **Docs:** `src/plugins/lifi/ARCHITECTURE.md`

### 5.2 Wormhole (Bridge)
- **Commands**: bridge <amount> <token0> <token1> <network0> <network1> *(token1 is optional for some token pairs, like USDC or ETH)*

- **Architecture:** SDK-backed quote + server route building; client signs.
- **Why different:** multi-route discovery with Wormhole SDK; CLI handles signing.
- **Flow:** quote returns best route + serialized context → bridge returns tx list.
- **Docs:** `src/plugins/wormhole/ARCHITECTURE.md`

### 5.3 Stargate (Bridge)- **Commands**: bridge <amount> <token0> <network0> <network1> *(Stargate only allows stablecoin transfers with our current API calls)*
- **Architecture:** server-side quote from Stargate API.
- **Why different:** stablecoin-only flow with slippage calc and two-step txs.
- **Flow:** quote returns approve + bridge steps; CLI executes in order.
- **Docs:** `src/plugins/stargate/ARCHITECTURE.md`

### 5.4 Faucet (Testnet Distribution)
- **Architecture:** database-backed request tracking + rate limiting + wallet service.
- **Why different:** internal stateful service with audit logging and limits.
- **Flow:** request → DB record → on-chain send → status/history.
- **Docs:** `FAUCET_SUMMARY.md`, `src/plugins/faucet/ARCHITECTURE.md`

### 5.5 Aave v3 (Planned)
- **Architecture:** contract helpers + GraphQL/REST data sources.
- **Why different:** lending lifecycle with richer state + risk checks.
- **Docs:** `src/plugins/aave-v3/ARCHITECTURE.md`

---

## 6) Storage, State, and Observability

### ExecutionContext (In-Memory)
- Protocol state cache (quotes, routes, tx plans).
- Command history for UX and debugging.
- Wallet connection and active protocol.

### Faucet Database (Persistent)
- Prisma-backed models for requests, rate limits, audit logs.
- Provides durability and abuse protection.

---

## 7) Developer Workflow (Scaffold)

### Add a Protocol Plugin
1. Copy `src/plugins/_template` into a new directory.
2. Implement `initialize()` and register commands.
3. Add API routes (if needed) under `src/app/api/[protocol]/`.
4. Document architecture in `src/plugins/[protocol]/ARCHITECTURE.md`.

### Add a Command
1. Implement a `Command` object with `scope: 'G_p'`.
2. Register via `addCommandToFiber`.
3. Decide on API vs direct SDK usage.
4. Store/restore any needed protocol state via `ExecutionContext.protocolState`.

### Add an API Route
1. Create `src/app/api/[protocol]/[action]/route.ts`.
2. Validate input and wrap responses in `{ success, data|error }`.
3. Document in `src/app/api/README.md` if it becomes user-facing.

---

## 8) Key Documents (Read This Next)

- `ARCHITECTURE.md` — system architecture and component map
- `FIBERED-MONOID-SPEC.md` — algebraic spec and monoid laws
- `src/plugins/README.md` — plugin authoring workflow
- `src/app/api/README.md` — API routing conventions
- `FAUCET_SUMMARY.md` — faucet system summary and setup
- `src/plugins/*/ARCHITECTURE.md` — protocol-specific tool docs

---

## 9) Open Questions / Future Additions

- **G_alias roll-out:** when alias resolution becomes active, document selection rules.
- **Unified status tracking:** shared polling utilities across bridge protocols.
- **Protocol metrics:** standardize telemetry/logging for quote/execute cycles.
- **Testing harnesses:** document fixtures and mock servers per protocol.
