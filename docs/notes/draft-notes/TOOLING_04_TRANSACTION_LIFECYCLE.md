# Transaction Lifecycle (Common Pattern)

**Last Updated:** 2026-01-02

Most protocol tooling follows a shared quote → execute → status loop that stays within a single fiber $M_p$ unless explicitly namespaced.

---

## 1) Quote / Preview

**Goal:** produce a deterministic plan without signing.

Typical actions:
- Resolve chain IDs and token metadata.
- Fetch pricing, routes, or transfer steps.
- Normalize the response into terminal-friendly summaries.
- Cache results in `ExecutionContext.protocolState`.

**Outputs:**
- Route summary (fees, ETA, slippage).
- Ordered steps with transaction payloads or references.

---

## 2) Prepare / Execute

**Goal:** convert cached quote into unsigned transactions and sign.

Typical actions:
- Build one or more unsigned txs (approval + execution).
- Present each tx to the wallet for user confirmation.
- Broadcast and collect hashes in execution metadata.

**Patterns by protocol:**
- **Bridges:** multi-step with approvals and bridge calls.
- **DEX swaps:** a single swap tx or permit + swap.
- **Faucet:** server signs and broadcasts, client receives tx hash.

---

## 3) Status / Track

**Goal:** ensure completion and expose explorer links.

Typical actions:
- Poll protocol status endpoints or explorers.
- Emit explorer URLs for each hash.
- Update `ExecutionContext.history` with status transitions.

---

## Caching Guidance

- Cache quotes in `protocolState` with timestamps.
- Provide `--refresh` flags to re-quote when prices change.
- If wallet chain ID changes, invalidate cached plans.

---

## Error Handling Checklist

- Handle upstream errors by bubbling `{ success: false, error }`.
- Differentiate between user rejection and tx failure.
- Guard for missing cached quotes before execution.
- Normalize revert reasons to CLI-friendly messages.

---

## Minimal Example (Pseudo)

```text
quote:
  fetch route
  cache in protocolState

execute:
  read cached route
  build tx list
  sign + send
  store tx hashes

status:
  poll protocol status
  output explorer links
```
