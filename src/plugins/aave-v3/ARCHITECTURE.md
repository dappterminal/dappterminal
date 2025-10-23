# Aave v3 Plugin Architecture

**Last Updated:** 2025-10-17  
**Status:** 🛠️ In planning

This document serves as the implementation guide for the `aave-v3` protocol plugin in The DeFi Terminal. It captures the architectural decisions, available SDK methods, command surface, and integration flow for both a Next.js-first buildout and a command-first rollout.

---

## 1. Objectives & Scope

- Deliver an `M_aave-v3` protocol fiber that exposes core Aave v3 lending lifecycle commands (supply, withdraw, borrow, repay, collateral management, rewards) within the terminal.
- Support rapid prototyping via either:
  - **Next.js-first:** scaffold a standalone Next.js demo that exercises the same data-access + transaction helpers the plugin will consume.
  - **Command-first:** wire commands directly into the CLI using prebuilt contract helpers and graph endpoints.
- Reuse official tooling from the Aave developer docs to reduce custom contract work:
  - [`@aave/contract-helpers`](https://aave.com/docs/developers/aave-v3/getting-started/typescript#setup) for read/write actions.
  - [`@aave/math-utils`](https://aave.com/docs/developers/aave-v3/getting-started/typescript#user-and-market-data) for health-factor, APR, and incentive calculations.
  - GraphQL endpoints from the [React](https://aave.com/docs/developers/aave-v3/getting-started/react) / [GraphQL](https://aave.com/docs/developers/aave-v3/getting-started/graphql) guides for cached market data.
  - REST-like market data feeds documented under [Markets → Data](https://aave.com/docs/developers/aave-v3/markets/data).

---

## 2. Twin Implementation Tracks

| Track | When to choose | Deliverables | Hand-off to plugin |
|-------|----------------|--------------|--------------------|
| **Next.js-first** | When we need UI to explore SDK responses, prototype wallet flows, or share with protocol partners. | `/apps/aave-demo` (or similar) Next.js app consuming the helpers directly, wallet wiring via wagmi, API routes under `/app/api/aave/`. | Extract hooks/services into `src/lib/aave/` for reuse in CLI commands. |
| **Command-first** | When CLI parity is the priority and wallet interactions can be mocked or delegated. | Command set under `src/plugins/aave-v3/commands.ts`, API handlers under `src/app/api/aave-v3/`. | Optionally backfill React hooks later for UI modules. |

Both tracks converge on the same shared service layer (Section 5). The Next.js app is an optional proving ground; all reusable logic ultimately lives under `src/lib/aave/`.

---

## 3. Fiber Definition (`M_aave-v3`)

| Field        | Value                                   |
|--------------|-----------------------------------------|
| Protocol ID  | `aave-v3`                               |
| Name         | `Aave v3 Lending`                       |
| Tags         | `['lending', 'borrow', 'collateral']`   |
| Identity     | Injected via `createProtocolFiber('aave-v3', 'Aave v3 Lending')` |
| Isolation    | Only Aave commands exposed while fiber is active; global aliases resolve inside the fiber. |

### Planned Command Surface

| Command ID | Purpose | Underlying helper (out-of-the-box) | Notes |
|------------|---------|-------------------------------------|-------|
| `markets`  | List supported pool markets (Ethereum, Polygon, Optimism, etc.) | `AaveV3{Chain}.POOL_ADDRESSES_PROVIDER` + GraphQL `markets` query | Establish target market + chain metadata. |
| `reserves` | Show reserve snapshots (liquidity, supply/borrow APRs) | `UiPoolDataProvider.getReservesHumanized` | Accept `--market` flag, caches humanized data. |
| `rates`    | Display variable/stable borrow rates & reward APRs | `UiIncentiveDataProvider.getReservesIncentivesDataHumanized` | Can share cached pool data from `reserves`. |
| `position` | Display user balances across supplied/borrowed assets | `Pool.getUserAccountData`, `UiPoolDataProvider.getUserReservesHumanized` | Requires wallet address (context default). |
| `health`   | Compute health factor / liquidation thresholds | `calculateHealthFactorFromBalances` (math-utils) | Derived from `position` payload. |
| `supply`   | Supply collateral to pool | `Pool.supply` | Handles permit flow when available. |
| `withdraw` | Withdraw supplied collateral | `Pool.withdraw` | Auto-calculates max withdrawable via `position`. |
| `borrow`   | Open a borrow position | `Pool.borrow` | Supports variable/stable mode selection. |
| `repay`    | Repay borrow position | `Pool.repay` | Supports `--useAToken` toggles. |
| `set-collateral` | Toggle reserve usage as collateral | `Pool.setUserUseReserveAsCollateral` | Exposes `--enable` / `--disable`. |
| `set-emode` | Update efficiency mode | `Pool.setUserEMode` | Surfaces available eMode categories. |
| `switch-rate` | Switch between stable/variable borrow rate | `Pool.swapBorrowRateMode` | Accepts `--asset` flag. |
| `claim-rewards` | Claim liquidity mining incentives | `IncentivesController.claimRewards` via helpers | Use `@aave/contract-helpers` incentives wrappers. |

All commands are registered via `addCommandToFiber(fiber, command)` in `src/plugins/aave-v3/index.ts`.

---

## 4. Command Execution Flow

1. **User Input → Command Resolver:** Command registry maps `aave-v3:*` invocations to the fiber.
2. **Context Bootstrap:** `initialize()` loads `createProtocolFiber`, hydrates config (default chain = Ethereum mainnet), and injects shared services (`lib/aave`).
3. **Data Fetching:** Read-only commands call shared query helpers (GraphQL or RPC) via `ExecutionContext.httpClient`.
4. **Transaction Planning:** Mutating commands:
   - Fetch prerequisite data (LTV, HF) before computing actions.
   - Use contract-helper methods to build populated transaction data.
   - Return serializable transaction plan; signing occurs client-side via wallet adapter.
5. **State Cache:** Results stored in `context.protocolState` (per-address) to reduce redundant queries (`reserves`, `position`, `health` share caches).

---

## 5. Shared Service Layer (`src/lib/aave/`)

Create a dedicated module that both the Next.js app and the CLI commands consume:

- **Configuration:**
  - Market registry (`AaveV3Ethereum`, `AaveV3Polygon`, etc. from `@bgd-labs/aave-address-book`).
  - Preferred RPC endpoints per chain.
- **Providers:**
  - `getPoolProvider(chainId)` → returns `{ pool, wethGateway, incentivesController }`.
  - `getUiDataProvider(chainId)` → instantiates `UiPoolDataProvider` and `UiIncentiveDataProvider`.
- **Queries:**
  - `fetchReserves(chainId)` → wraps `getReservesHumanized`.
  - `fetchUserReserves(chainId, address)` → wraps `getUserReservesHumanized`.
  - `fetchMarketMetadata()` → aggregates GraphQL `markets` + REST `oracle-prices`.
  - `fetchUserSummary(address)` → returns combined `totalCollateralBase`, `totalDebtBase`, `availableBorrowsBase`, health factor.
- **Transactions:**
  - `buildSupplyTx(params)` → uses `pool.supply` and returns `{ to, data, value }`.
  - `buildWithdrawTx(params)` → uses `pool.withdraw`.
  - `buildBorrowTx(params)` → uses `pool.borrow`.
  - `buildRepayTx(params)` → uses `pool.repay`.
  - `buildToggleCollateralTx(params)` → uses `pool.setUserUseReserveAsCollateral`.
  - `buildEModeTx(params)` → uses `pool.setUserEMode`.
  - `buildSwitchRateTx(params)` → uses `pool.swapBorrowRateMode`.
  - `buildClaimRewardsTx(params)` → uses incentives helper.
- **Math Helpers:**
  - Health factor computations via `calculateHealthFactorFromBalances`.
  - APY calculations via `calculateTotalVariableDebt` etc.
- **Caching:** In-memory (per execution context) TTL caches for reserve and incentive snapshots (5–15s window).

---

## 6. External Data Sources

### 6.1 TypeScript Contract Helpers

- `import { Pool } from '@aave/contract-helpers'`
- `import { UiPoolDataProvider, UiIncentiveDataProvider, IncentiveDataProvider } from '@aave/contract-helpers'`
- `import { AaveV3Ethereum, AaveV3Polygon, AaveV3Optimism, AaveV3Avalanche } from '@bgd-labs/aave-address-book'`
- Connection uses RPC URLs sourced from environment (`AAVE_RPC_URL_*`) and a Viem provider adapter.

### 6.2 GraphQL

From the [GraphQL Getting Started](https://aave.com/docs/developers/aave-v3/getting-started/graphql):

- Endpoint pattern: `https://gateway.aave.com/graphql` with `x-api-key`.
- Common queries:
  - `markets` → list markets, base currency data, eMode configs.
  - `reserves` → reserve-level statistics per market.
  - `userReserves` → user balances by market.
  - `positions` (Markets → Positions guide) → aggregated user positions across chains.
- Use server-side API routes to proxy requests and inject API key (kept server-side).

### 6.3 REST Data Feeds

From [Markets → Data](https://aave.com/docs/developers/aave-v3/markets/data):

- `/markets-data/markets` → high-level stats (TVL, total borrows).
- `/markets-data/reserves` → APY, utilization, borrow cap/supply cap info.
- `/markets-data/positions` → per-account exposures (used for `position` command fallback if RPC heavy).
- `/markets-data/oracle-prices` → asset reference prices (useful for health factor conversions).

These endpoints can backfill GraphQL or RPC outages and provide quick read-only responses.

---

## 7. API Layer (Next.js App Router)

Create scoped routes under `src/app/api/aave-v3/` mirroring command needs:

| Route | Method | Purpose | Implementation notes |
|-------|--------|---------|----------------------|
| `/markets` | GET | Proxy GraphQL `markets` query; respond with cached markets list. | Requires API key; store in `process.env.AAVE_API_KEY`. |
| `/reserves` | GET | Return `fetchReserves` output (chain + market query params). | Cache for 5s to avoid rate limits. |
| `/user` | POST | Fetch user summary + reserves for a wallet address. | Accepts `{ chainId, address }`. |
| `/supply` | POST | Build supply tx payload. | Returns unsigned txs, expects client sign. |
| `/withdraw` | POST | Build withdraw tx payload. | Validate against max withdrawable. |
| `/borrow` | POST | Build borrow tx payload. | Validate HF post-borrow using math-utils. |
| `/repay` | POST | Build repay tx payload. | Optionally detect permit flows. |
| `/claim-rewards` | POST | Build reward claim tx. | Wrap incentives helper. |

API routes simply adapt the shared service layer output to HTTP responses. CLI commands can call these endpoints or invoke the helpers directly when running server-side.

---

## 8. Command Implementation Notes

- **Argument Parsing:** Reuse shared parsers for token symbols and markets (`resolveReserveSymbol`, `resolveMarket`).
- **Wallet Context:** The terminal maintains an active wallet; commands default to `context.wallet.address`. Provide `--address` override.
- **Dry-Run Mode:** Mutating commands should support `--dry-run` to only display planned transactions without executing.
- **Batch Execution:** Return an ordered array of `{ to, data, value, description }` for the terminal executor, matching existing Wormhole/Stargate patterns.
- **Error Surfaces:** Normalize common Aave revert reasons (e.g., `COLLATERAL_BALANCE_IS_ZERO`, `HEALTH_FACTOR_LOWER_THAN_LIQUIDATION_THRESHOLD`) for better CLI messaging.
- **Testing Hooks:** Expose deterministic mocks for unit tests using Hardhat fork or static fixtures (Aave docs provide sandbox addresses).

---

## 9. Next.js Demo Blueprint (Optional)

If opting for the Next.js-first approach:

1. `pnpm dlx create-next-app@latest apps/aave-demo --ts --app --tailwind`.
2. Install dependencies: `pnpm add @aave/contract-helpers @aave/math-utils @bgd-labs/aave-address-book viem wagmi`.
3. Set up RainbowKit/wagmi provider in `apps/aave-demo/src/app/layout.tsx`.
4. Create API routes mirroring Section 7 for server-side requests.
5. Build pages/components:
   - `MarketsPage`: table of markets/reserves, selects active market.
   - `PositionCard`: displays user metrics + health factor gauge.
   - `ActionModals`: supply/borrow forms calling API routes, returning populated txs.
6. Extract shared hooks/services into `src/lib/aave/` as they stabilize, then import into CLI plugin.

This demo serves as a playground for QA and stakeholder feedback before commands go live.

---

## 10. Roadmap & Milestones

1. **Scaffold Service Layer** (shared providers + queries).  
2. **Implement Read Commands**: `markets`, `reserves`, `rates`, `position`, `health`.  
3. **Expose Mutating Commands**: `supply`, `withdraw`, `borrow`, `repay`, `set-collateral`, `set-emode`.  
4. **Add Rewards Flow**: `claim-rewards`, rate-switching.  
5. **Hardening**: add integration tests against Aave testnet (Polygon Mumbai / Sepolia), ensure health factor guardrails.  
6. **Docs & Examples**: update `plugins/README.md`, add usage snippets to root `ARCHITECTURE.md`.

---

## 11. Dependencies & Environment

- **Packages:** `@aave/contract-helpers`, `@aave/math-utils`, `@bgd-labs/aave-address-book`, `viem`, `wagmi`, `graphql-request`.
- **Env Vars:**
  - `AAVE_API_KEY` → GraphQL gateway.
  - `AAVE_RPC_URL_ETHEREUM`, `AAVE_RPC_URL_POLYGON`, etc. → RPC providers per chain.
  - `AAVE_SUBGRAPH_URL_*` (optional fallback to The Graph).
- **Testing:** Use Hardhat fork or Tenderly for e2e transaction validation; unit tests mock providers via `viem` adapters.

---

## 12. Open Questions

- Should write commands execute transactions directly or always return unsigned payloads for wallet confirmation?
- Preferred cache layer for market data (Redis vs. in-memory) once multi-instance deployment happens?
- How do we expose leverage / flashloan advanced flows (see [Markets → Advanced](https://aave.com/docs/developers/aave-v3/markets/advanced))? Candidate follow-up commands: `flash-borrow`, `liquidation-call`, `e-mode-simulate`.

---

## 13. Reference Links

- [Aave v3 React Getting Started](https://aave.com/docs/developers/aave-v3/getting-started/react)
- [Aave v3 TypeScript Helpers](https://aave.com/docs/developers/aave-v3/getting-started/typescript)
- [Aave v3 GraphQL Guide](https://aave.com/docs/developers/aave-v3/getting-started/graphql)
- [Markets → Positions](https://aave.com/docs/developers/aave-v3/markets/positions)
- [Markets → Advanced](https://aave.com/docs/developers/aave-v3/markets/advanced)
- [Markets → Data](https://aave.com/docs/developers/aave-v3/markets/data)

These resources provide the canonical method signatures and data schemas referenced throughout this document.
