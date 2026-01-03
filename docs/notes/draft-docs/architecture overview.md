# dappTerminal System Map Overview

**Version:** 0.1.1  
**Last Updated:** 2025-10-23  

This page is a one-screen map of how dappTerminal fits together, with the math-heavy model intentionally omitted. The next page will cover the formal command model.

## System Map (One Page)

```
User CLI/Terminal UI
        │
        ▼
Command Registry + Execution Context
(command runtime)
        │
        ├─ Core Commands
        ├─ Protocol Commands
        └─ Aliases (planned)
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

## What Happens When You Run a Command

1. **Terminal UI captures input** and passes it into the command registry.
2. **The registry resolves the command** using explicit namespaces (`wormhole:quote`), the active protocol (`use 1inch`), or fuzzy matching.
3. **The execution context** provides wallet state, per-protocol cache, and command history.
4. **Protocol plugins** call API routes and SDK/HTTP clients to fetch quotes or build transactions.
5. **Results are rendered** in the terminal, with history and analytics updated.

## Core Runtime (No Math Version)

- **Terminal UI** (`src/components/cli.tsx`, `src/app/page.tsx`) handles input, history, multi-tab state, and wallet connection.
- **Command registry** (`src/core/command-registry.ts`) resolves core commands, protocol commands, and aliases; it also powers fuzzy search.
- **Execution context** (`src/core/types.ts`) tracks the active protocol, per-protocol state, wallet status, and history.
- **Core commands** include `help`, `use`, `exit`, `history`, `wallet`, `whoami`, `balance`, `price`, and `chart` (see `src/core/commands.ts`).

## Protocol Plugin Layer

- Each protocol lives in `src/plugins/[protocol]/` with `index.ts`, `commands.ts`, and `types.ts`.
- The plugin loader (`src/plugins/plugin-loader.ts`) initializes plugins and registers their commands.
- The template in `src/plugins/_template/README.md` documents the standard plugin layout and bootstrapping flow.

## API Layer (Next.js App Router)

- API routes live under `src/app/api/[protocol]/[action]/route.ts`.
- Standard response format: `{ success: true, data }` or `{ success: false, error }`.
- Security hardening includes API-key auth, rate limiting, and an RPC method allowlist (see `AUDIT_IMPLEMENTATION_SUMMARY.md` and `SECURITY_FIXES.md`).

## Shared Libraries

Protocol-specific helpers keep logic reusable across API routes and commands:

- **Wormhole** (`src/lib/wormhole.ts`, `src/lib/wormhole-sdk.ts`)
- **Stargate** (`src/lib/stargate.ts`)
- **LiFi** (`src/lib/lifi.ts`)
- **Uniswap v4** (`src/plugins/uniswap-v4/lib/`)
- **Faucet services** (`src/lib/faucet/`)
- **Coin data** (`src/lib/coingecko-client.ts`, `src/plugins/coinpaprika/api/client.ts`)

## Protocol Snapshots (Current + Planned)

- **1inch (DEX aggregator)**: swap/quote/chain/token support, gas endpoint, charts, and price data; RPC proxy is read-only and allowlisted.
- **LiFi (bridge aggregator)**: quote → step transaction → execute → status via a dedicated proxy app; commands wrap the proxy endpoints.
- **Wormhole (bridge)**: multi-route discovery, quote caching, and bridge execution with client-side signing.
- **Stargate (bridge)**: quote returns approve + bridge steps; CLI executes transactions in order; stablecoin focus.
- **Faucet (testnet distribution)**: request/status/history with database-backed rate limiting and audit logging.
- **CoinPaprika (market data)**: `cprice`, `coinsearch`, and `cchart` for 56k+ assets and OHLCV charts.
- **Uniswap v4 (WIP)**: swap command builds Universal Router calldata; signing happens client-side.
- **Aave v3 (planned)**: markets/reserves/rates/position/health plus supply/borrow flows using contract helpers and GraphQL.

## Analytics, Charts, and Tracking

- **Swap/bridge tracking** writes transaction and volume data to Prisma models and exposes `/api/analytics/*` endpoints.
- **Charts** support built-in analytics panels and CoinPaprika OHLCV via `cchart` or `chart --protocol coinpaprika`.
- **Price routing** supports `price --protocol` with automatic fallback from 1inch to CoinPaprika.

## Data & Persistence

- **In-memory state** lives inside the execution context per terminal tab.
- **Persistent state** uses PostgreSQL via Prisma for the faucet and analytics tracking systems.
- Deployment details and migration steps live in `prisma/README.md`, `FAUCET_SETUP.md`, and `FAUCET_SUMMARY.md`.

## Security and Operational Notes

- **Audit fixes applied**: API auth + rate limits, RPC allowlist, production log redaction, and safer state updates.
- **Known follow-ups**: analytics endpoint protection and distributed rate limiting are documented for continued hardening.
- **Plugin execution** remains client-side today; moving command execution server-side is a documented future milestone.

## Doc Index (For Deep Dives)

- `ARCHITECTURE.md` — full system architecture reference
- `TOOLING.md` — contributor-focused tooling map
- `README.md` — project overview, setup, and usage
- `FIBERED-MONOID-SPEC.md` — formal command model (covered next page)
- `src/app/api/README.md` — API route conventions
- `src/plugins/README.md` — plugin development guide
- `src/plugins/_template/README.md` — plugin template walkthrough
- `src/plugins/wormhole/ARCHITECTURE.md` — Wormhole integration details
- `src/plugins/stargate/ARCHITECTURE.md` — Stargate integration details
- `src/plugins/lifi/ARCHITECTURE.md` — LiFi integration details
- `src/plugins/faucet/ARCHITECTURE.md` — Faucet integration details
- `src/plugins/uniswap-v4/architecture.md` — Uniswap v4 plugin plan
- `src/plugins/aave-v3/ARCHITECTURE.md` — Aave v3 plugin plan
- `COINPAPRIKA_IMPLEMENTATION.md` — CoinPaprika integration details
- `CHART_INTEGRATION.md` — OHLCV chart support
- `PRICE_COMMAND_UPDATE.md` — price routing changes
- `SWAP_TRACKING_IMPLEMENTATION.md` — analytics and tracking system
- `FAUCET_SETUP.md` — faucet setup guide
- `FAUCET_SUMMARY.md` — faucet implementation summary
- `prisma/README.md` — database deployment guide
- `production-audit-report.md` — audit findings
- `AUDIT_IMPLEMENTATION_SUMMARY.md` — applied fixes
- `SECURITY_FIXES.md` — security hardening notes
- `CHANGELOG.md` — version history and planned work
