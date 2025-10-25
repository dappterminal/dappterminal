# Production Audit Report

## Critical
- [Security] `src/app/api/1inch/eth_rpc/route.ts:18`, `src/app/api/lifi/routes/route.ts:18`, `src/app/api/1inch/gas/route.ts:21` forward API-keyed traffic without auth or throttling; any browser can drain quotas or incur cost. Gate by auth, rate-limit, and move privileged calls behind server-to-server trust.
- [Architecture/Security] `src/components/cli.tsx:1` loads plugins client-side while plugins depend on secret config (e.g. `src/plugins/1inch/index.ts:37`). Shipping real keys would expose them to the browser; relocate command resolution/plugin execution to server services or signed RPC.

## Medium
- [Implementation] Multiple `setTabs(tabs => ...)` mutations use stale closures (e.g. `src/components/cli.tsx:487,520,562,629`), dropping concurrent updates. Switch to functional state setters everywhere.
- [Security] `src/app/api/1inch/eth_rpc/route.ts:95` allows arbitrary RPC methods (archive reads, sendRawTransaction) on shared key. Enforce explicit method allowlists and per-user quotas.
- [Implementation] Plugin loading is fire-and-forget in `src/components/cli.tsx:372`; commands issued before load finish resolve as "not found". Await loader init and surface readiness state in UI.
- [Implementation] Token helpers (`src/plugins/1inch/tokens.ts:6`, `src/lib/lifi.ts:26`) hard-code chain maps; unsupported chains throw generic errors. Extend data sources or load from spec to honour multi-chain claim.
- [UX] Charts/terminal layout (`src/components/app-layout.tsx:34`) degrades on mobile despite `isMobile` detection; add responsive layout (stacked panels, larger tap targets, focus management).
- [Spec] Core swap flow still a stub (`src/plugins/1inch/commands.ts:132` yields “Swap execution not yet implemented”). Close the loop with signing + submission or clearly flag feature as disabled.
- [Security] Verbose logging in production paths (`src/app/api/1inch/charts/candle/route.ts:28`, `src/app/api/1inch/eth_rpc/route.ts:69`) can leak wallet/token context; trim or guard logs in prod.

## Low
- [Implementation] `src/components/app-layout.tsx:47` keeps unused `isMobile` state; remove or repurpose.
- [UX] CLI lacks keyboard shortcuts documentation and accessible labels (sidebar tooltips only on hover). Provide visible labels + keyboard hints.
- [Architecture] Global singletons (`src/core/command-registry.ts:159`, `src/plugins/plugin-loader.ts:233`) make SSR testing difficult. Consider dependency injection for deterministic tests.

## Testing Guidance
- [E2E] Add Playwright/Cypress flows: launch terminal, register wallet mock, execute `help`, `use 1inch`, `price eth`, and assert rendered history/output; cover error cases (invalid protocol, missing wallet).
- [Commands] Use Vitest/Jest with `msw` or fetch mocks to unit test each command’s `run()` (happy path, API failure, invalid input) without UI.
- [Plugins] Build contract tests that load each plugin into an isolated registry via dependency injection, assert fiber invariants, and snapshot handler side-effects. Mock external SDKs (e.g., wagmi, wormhole SDK) to validate handler orchestration.

## Additional Notes
- Document production deployment requirements (API keys, rate limits, wallets) in `README.md`.
- Automate regression checks (lint, type-check, unit, e2e) in CI before promotion.
