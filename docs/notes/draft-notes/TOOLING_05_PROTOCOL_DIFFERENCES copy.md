# Protocols 
**Last Updated:** 2026-01-02

All protocol integrations fit the same monoid runtime, but they diverge in how quotes are built, how transactions are prepared, and where state lives.

---

## LiFi (Bridge Aggregator)

**Why it is different:** API key must stay server-side; advanced route planning.

**Architecture:** CLI plugin + separate proxy app (`../lifi-api-nextjs`).

**Flow:**
1. Quote routes via `/api/lifi/routes`.
2. Prepare per-step tx via `/api/lifi/step-transaction`.
3. Execute steps (manual signing or SDK delegated).
4. Track status via LiFi status endpoint.

**State:** cached route + per-step execution metadata.

**Docs:** `src/plugins/lifi/ARCHITECTURE.md`.

---

## Wormhole (Bridge)

**Why it is different:** SDK-backed route discovery with multiple route types.

**Architecture:** API routes build serialized transfer context; CLI signs.

**Flow:**
1. Quote via `/api/wormhole/quote` (best route + route list).
2. Build tx list via `/api/wormhole/bridge`.
3. CLI signs and sends ordered txs.

**State:** selected route + serialized transfer request.

**Docs:** `src/plugins/wormhole/ARCHITECTURE.md`.

---

## Stargate (Bridge)

**Why it is different:** stablecoin-only flow with API-driven steps and slippage calc.

**Architecture:** server-side quote from Stargate API; CLI executes steps.

**Flow:**
1. Quote via `/api/stargate/quote`.
2. Receive approval + bridge tx steps.
3. CLI signs and submits in order.

**State:** cached quote with `stargateSteps`.

**Docs:** `src/plugins/stargate/ARCHITECTURE.md`.

---

## Faucet (Testnet Distribution)

**Why it is different:** internal stateful service with rate limiting and audit logs.

**Architecture:** database-backed request tracking + wallet service.

**Flow:**
1. Request via `/api/faucet/request`.
2. Server signs and broadcasts.
3. Status and history via `/api/faucet/status` and `/api/faucet/history`.

**State:** persisted in Prisma models.

**Docs:** `FAUCET_SUMMARY.md`, `src/plugins/faucet/ARCHITECTURE.md`.

---

## Aave v3 (Planned)

**Why it is different:** lending lifecycle requires richer state and risk checks.

**Architecture:** contract helpers + GraphQL/REST data sources.

**Flow (planned):**
1. Read market + reserve data.
2. Plan txs (supply, borrow, repay, withdraw).
3. Validate health factor before execution.

**State:** cached reserves and user positions.

**Docs:** `src/plugins/aave-v3/ARCHITECTURE.md`.
