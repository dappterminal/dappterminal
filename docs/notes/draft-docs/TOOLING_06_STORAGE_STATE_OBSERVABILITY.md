# Storage, State, and Observability

**Last Updated:** 2026-01-02

State is split between in-memory execution context and protocol-specific persistence. Observability is handled through structured responses, history, and audit logs.

---

## 1) ExecutionContext (In-Memory)

The runtime state for a single terminal tab.

**Key fields:**
- `activeProtocol`: the current fiber $M_p$.
- `protocolState`: per-protocol cache (quotes, routes, tx plans).
- `history`: command execution log for UX and debugging.
- `wallet`: address, chain ID, and connection status.

**Example shapes:**

```text
protocolState:
  wormhole:
    lastQuote: { bestRoute, quotes, transferRequest }
    selectedRouteType: AutomaticCCTPRoute
  stargate:
    lastQuote: { stargateSteps, fullQuote }
  lifi:
    selectedRoute: { id, steps, fees }
    execution: { stepHashes, updatedAt }
```

---

## 2) Persistent Storage (Faucet)

The faucet uses Prisma-backed models for durability and abuse protection.

**Core models:**
- `FaucetRequest`: request lifecycle (pending → completed/failed).
- `RateLimitRecord`: per-address and per-IP windows.
- `FaucetConfig`: per-network configuration.
- `FaucetAuditLog`: structured event history.

**Primary surfaces:**
- `prisma/schema.prisma`
- `src/lib/faucet/rate-limit-db.ts`
- `src/lib/faucet/transaction.ts`

---

## 3) Observability Surfaces

- Command history in `ExecutionContext.history`.
- Standard API envelope: `{ success, data | error }`.
- Faucet audit logs for request lifecycle events.

---

## 4) Consistency Guidelines

- Cache only serializable data inside `protocolState`.
- Invalidate cached quotes when wallet chain changes.
- Persist user-facing identifiers (tx hash, request id) for follow-up commands.
- Normalize errors for CLI display.
