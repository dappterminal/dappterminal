# LiFi Plugin Architecture

This document captures how the LiFi protocol integration is assembled across the CLI plugin that lives in `the-defi-terminal` and the dedicated Next.js proxy application at `/dev/lifi-api-nextjs`. It focuses on the quote → execution → bridge completion journey, the HTTP endpoints involved, and how transaction tracking ties back into the terminal UX.

## System Overview

- **Terminal plugin (`src/plugins/lifi/`)**  
  Responsible for exposing LiFi-specific commands (`lifi:quote`, `lifi:execute`, `lifi:status`, etc.) to the command monoid. Each command wraps an HTTP call into the API proxy, shapes the response into terminal-friendly structs, and orchestrates wallet interactions (signing, broadcast, polling).

- **Next.js proxy (`../lifi-api-nextjs`)**  
  Acts as the authenticated bridge to the official LiFi API. Endpoints live under `src/app/api` and forward requests with the integrator API key (`LIFI_API_KEY`). This keeps credentials off the client and normalises response envelopes for plugins.

```
┌────────────┐     1. command        ┌────────────────────┐
│ terminal   │ ────────────────────▶ │ plugin command     │
│ (CLI)      │                       │ (quote/execute/…)  │
└────────────┘                       └─────────┬──────────┘
                  2. HTTP fetch                │
                                               ▼
                                  ┌──────────────────────────┐
                                  │ Next.js proxy API        │
                                  │ (/api/routes, …)         │
                                  └──────────┬───────────────┘
                                             │
                                3. REST call ▼
                                  ┌──────────────────────────┐
                                  │ LiFi public API (li.quest)│
                                  └──────────────────────────┘
```

## Proxy Endpoints

All proxy handlers share the same pattern: guard that `process.env.LIFI_API_KEY` is present, forward the payload, and bubble up the upstream status code.

- `POST /api/routes` → `https://li.quest/v1/advanced/routes` (`../lifi-api-nextjs/src/app/api/routes/route.ts:1`)  
  Returns advanced routing (bridge + swap) plans. The body should match LiFi’s [Advanced Routes schema](https://docs.li.fi/reference/route-v2) including `fromChainId`, `toChainId`, `fromTokenAddress`, `toTokenAddress`, `fromAmount`, `fromAddress`, `toAddress`, and optional constraints.

- `POST /api/step-transaction` → `https://li.quest/v1/advanced/stepTransaction` (`../lifi-api-nextjs/src/app/api/step-transaction/route.ts:1`)  
  Returns the EVM transaction request for a particular route step. Required when executing the route manually (signing via the terminal wallet instead of letting the SDK run the flow automatically).

- `GET /api/test-key` → `https://li.quest/v1/keys/test` (`../lifi-api-nextjs/src/app/api/test-key/route.ts:1`)  
  Lightweight health check validating that the configured API key is active. The plugin should expose a `lifi:health` command that hits this endpoint.

## Command Flow

### 1. Quote (`lifi:quote`)

1. Parse CLI arguments into the LiFi advanced route request: resolve chain IDs and token contract addresses using the shared token registry (`../lifi-api-nextjs/src/app/lib/tokens.ts:1`) or, when needed, the 1inch fallback resolver (`getTokenDecimals` / `resolveTokenInfo`).
2. `fetch('/api/lifi/routes', { method: 'POST', body })`.
3. Map the response to a `LiFiRouteSummary` object that highlights:
   - selected bridge/executor,
   - total gas & fees,
   - expected output amount and slippage,
   - ordered `steps` with their action types (swap, bridge, claim, etc.).
4. Cache the chosen route inside `context.protocolState` so subsequent commands can reuse it without re-fetching unless the user asks for refresh.

### 2. Prepare Execution (`lifi:prepare-step`)

When the CLI needs granular control (e.g. to present each transaction for manual approval), it should:

1. Accept a `routeId` + `stepIndex`.
2. Call `POST /api/step-transaction` with the `routeId` and `step` object returned from the quote stage.
3. Receive the `transactionRequest` payload LiFi expects to be signed: contains `to`, `data`, `value`, `gasLimit`, and `chainId`.
4. Convert the payload into a terminal `TransactionDraft`, present it to the wallet adapter, and await signing.

This mirrors what the Next.js UI does internally via the SDK but grants first-class CLI control.

### 3. Execute (`lifi:execute`)

Two execution strategies are supported:

- **SDK delegated** (simple path):  
  When running inside a browser or an environment with the LiFi SDK configured (`../lifi-api-nextjs/src/app/page.tsx:18`), call `executeRoute(route, options)` and mirror the SDK hooks:
  - `updateRouteHook` to stream progress back into the terminal,
  - `acceptExchangeRateUpdateHook` to pause for user approval when prices change.

- **Manual signing** (CLI-first path):  
  Loop over the route steps and, for each actionable step (`execution.type === 'CALL'`), call `lifi:prepare-step` and prompt the wallet to sign/broadcast. Record the transaction hash and update route state locally. This ensures compatibility with any EOA the terminal controls.

Regardless of the strategy, persist execution metadata (step IDs, transaction hashes, timestamps) so the status command can reconcile progress.

### 4. Track Status (`lifi:status`)

After broadcasting the final transaction, the plugin should poll LiFi’s status endpoint every ~15 seconds until the bridge completes:

```
GET https://li.quest/v1/status
  ?bridge={bridgeName}
  &fromChain={fromChainId}
  &toChain={toChainId}
  &txHash={originTxHash}
```

Expose this through the proxy (e.g. `GET /api/status`) to keep API keys server-side. The response reports `status` (`PENDING`, `DONE`, `FAILED`) plus explorer URLs for both source and destination legs. Once `status === 'DONE'`, the plugin can mark the command chain as successful.

### 5. Transaction Explorer Links

Every route step includes explorer metadata:

- `execution.internalTxLink` (set when the SDK updates the route, see `../lifi-api-nextjs/src/app/page.tsx:102`).  
  Surfaces a prebuilt explorer URL (Etherscan, Basescan, etc.) pointing to the in-flight transaction.
- For manual flows, fallback to constructing the URL from `step.action.fromChainId` and the transaction hash using the chain registry (`CHAINS` and `getChainShortName` in `../lifi-api-nextjs/src/app/lib/chains.ts:1`).

The plugin should emit these explorer links as part of the command result so the terminal can make them clickable.

## State & Error Handling

- Store the current route under `context.protocolState.get('lifi')` with shape `{ selectedRoute, lastUpdated, execution }`.
- On any non-2xx response from the proxy, bubble up the JSON `{ error }` field into the command result.
- If `LIFI_API_KEY` is missing, present an actionable error instructing users to set the secret in their environment before loading the plugin.

## Recommended Command Set

| Command           | Description                                             | Primary Endpoint            |
|-------------------|---------------------------------------------------------|-----------------------------|
| `lifi:health`     | Validate API key & upstream availability                 | `GET /api/lifi/test-key`    |
| `lifi:quote`      | Fetch and cache best bridge route                        | `POST /api/lifi/routes`     |
| `lifi:prepare`    | Fetch transaction data for a given step                  | `POST /api/lifi/step-transaction` |
| `lifi:execute`    | Execute selected route (delegated or manual)             | Depends on strategy         |
| `lifi:status`     | Poll bridge completion until finalised                   | `GET /api/lifi/status` (to implement) |
| `lifi:routes`     | List alternative routes or refresh the cache             | `POST /api/lifi/routes`     |

## Implementation Notes

- **Environment**: the CLI must boot the plugin with a config containing `enabled: true` and optionally the integrator ID so telemetry remains consistent with the proxy (`../lifi-api-nextjs/src/app/lib/lifi.ts:1`).
- **Token metadata**: reuse the static registries from the proxy repo to avoid desynchronisation in symbol → address mapping.
- **Extensibility**: keep the API client thin (`src/plugins/lifi/api.ts`) to encapsulate fetch calls; commands should remain declarative.
- **Testing**: write integration tests that stub the proxy endpoints to assert command outputs, ensuring the monoid contracts stay intact.

This architecture ensures the LiFi integration is cohesive across projects: the Next.js proxy manages authentication and mirrors the SDK reference implementation, while the CLI plugin exposes the same flow in a terminal-native manner with clear command ergonomics.
