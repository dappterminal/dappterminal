# Open Questions / Future Additions

**Last Updated:** 2026-01-02

This page tracks forward-looking items that affect tooling architecture and developer ergonomics.

---

## 1) $G_{alias}$ Roll-Out

- Define alias selection rules when multiple protocols implement the same action.
- Decide on default protocol ordering (user preference vs chain context).
- Document conflict resolution and fallback behavior.

---

## 2) Unified Status Tracking

- Shared polling utilities across bridges (LiFi, Wormhole, Stargate).
- Standard status model for PENDING / DONE / FAILED.
- Common explorer link formatting utilities.

---

## 3) Protocol Metrics and Telemetry

- Standardize quote/execute timing metrics.
- Capture error classes and upstream failure rates.
- Define storage and retention for analytics events.

---

## 4) Testing Harnesses

- Mock servers for protocol APIs and bridges.
- Deterministic fixtures for command outputs.
- Integration tests for multi-step tx flows.

---

## 5) Shared Transaction Executor

- A single executor that can process ordered tx lists.
- Hooks for user confirmations, retries, and receipts.
- Reusable across plugins to reduce duplication.

---

## 6) Protocol State Schema

- A minimal typed schema for `protocolState` entries.
- Common fields: `lastQuote`, `lastUpdated`, `execution`.
- Enables inspection and CLI debugging commands.
