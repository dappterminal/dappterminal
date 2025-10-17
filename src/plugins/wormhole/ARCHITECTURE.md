# Wormhole Fiber Architecture

This document distills the behaviour of the Wormhole bridge demo (`/home/nick/dev/wormhole-api-nextjs`) into guidance for building a Wormhole protocol fiber (`M_wormhole`) inside The DeFi Terminal. It mirrors the structure we adopted for Stargate so that all `M_p` implementations stay consistent with the fibered monoid spec.

---

## 1. Objectives

- Expose Wormhole cross-chain token transfers as a plugin that inhabits the `G_p` scope.
- Preserve fiber isolation and identity guarantees supplied by `createProtocolFiber`.
- Reuse proven SDK patterns from the reference app (route discovery, custom signer, sequential execution).
- Provide a clear CLI surface (`wormhole:quote`, `wormhole:bridge`, etc.) that integrates with existing terminal UX (help output, history, tab contexts).

---

## 2. External Reference Summary

Source repository: `/home/nick/dev/wormhole-api-nextjs`

Key components to port:

1. **SDK bootstrap** – `wormhole('Mainnet', [evm])` plus resolver composition (`AutomaticCCTPRoute`, `CCTPRoute`, `AutomaticTokenBridgeRoute`, `TokenBridgeRoute`).
2. **Custom signer** – Viem wallet client → ethers-style signer overriding `signAndSend` to broadcast transactions directly.
3. **Route discovery** – Build `tokenId`, find supported destination tokens, create `RouteTransferRequest`, and call `resolver.findRoutes`.
4. **Quote aggregation** – Validate and quote all candidate routes (`getQuotesForAllRoutes`) to present ETA/fee/relay data.
5. **Transfer initiation** – Validate selected route, re-quote, and call `route.initiate(...)`, returning receipts with origin transaction hashes.

---

## 3. Fiber Definition (`M_wormhole`)

| Field          | Value                                                                  |
|----------------|------------------------------------------------------------------------|
| Protocol ID    | `wormhole`                                                             |
| Name           | `Wormhole Bridge`                                                      |
| Tags           | `['bridge', 'cross-chain', 'wormhole']`                                |
| Identity       | Injected automatically via `createProtocolFiber('wormhole', ...)`      |
| Isolation      | Only Wormhole commands + essential globals are visible while in fiber  |

### Command Set (initial)

| Command ID | Purpose                                                               | Aliases                 |
|------------|-----------------------------------------------------------------------|-------------------------|
| `quote`    | Discover available Wormhole routes and cache the best option          | `estimate`, `preview`   |
| `routes`   | List all routes with fees/ETA, optionally select one                  | `options`               |
| `bridge`   | Execute the cached route by streaming the SDK transactions            | `transfer`, `execute`   |
| `status`   | Fetch WormholeScan status for the latest hash                         | `track`                 |
| `tokens`   | (Optional) Display supported assets per chain                         | `assets`                |

Each command **must** set `scope: 'G_p'` and `protocol: 'wormhole'`. Register them with `addCommandToFiber` during plugin initialization.

---

## 4. API Surface

Create Next.js API handlers under `src/app/api/wormhole/` that wrap the SDK logic:

1. **POST `/api/wormhole/quote`**
   - Body: `{ sourceChainId, destChainId, tokenAddress, amount, sourceAddress, destAddress }`.
   - Behaviour:
     - Map chain IDs → Wormhole chain names (centralise map in `src/lib/wormhole/chains.ts`).
     - Call SDK helpers (`getTransferQuote`, `getQuotesForAllRoutes`).
     - Return Li.Fi-style payload consumable by CLI, e.g.:
       ```json
       {
         "success": true,
         "data": {
           "bestRoute": { ...summary },
           "quotes": [{ ... }, ...],
           "transferRequest": { ...serialized },
           "context": { ...minimal data needed for execution }
         }
       }
       ```
     - Avoid returning raw SDK instances; serialize enums/strings only.

2. **POST `/api/wormhole/bridge`**
   - Body: `{ selectedRouteType, transferRequest, amount, sourceAddress }`.
   - Reconstruct route via resolver, validate, quote, and return an ordered list of transactions:
     ```json
     {
       "success": true,
       "data": {
         "transactions": [
           { "to": "0x...", "data": "0x...", "value": "0x0", "description": "ERC20 approve" },
           { "to": "0x...", "data": "0x...", "value": "0x0", "description": "Bridge transfer" }
         ],
         "receiverChain": "...",
         "scanUrlTemplate": "https://wormholescan.io/#/tx/{{hash}}?network=Mainnet"
       }
     }
     ```

3. **GET `/api/wormhole/status`** (optional)
   - Accept `txHash`, proxy WormholeScan status, return stage info (pending, attested, delivered).

4. **GET `/api/wormhole/tokens`** (optional helper)
   - Provide per-chain token metadata (prefill CLI autocomplete).

All endpoints should return the standard `{ success, data | error }` format so the plugin can call them via `callProtocolApi`.

---

## 5. Shared Library Module

Create `src/lib/wormhole/index.ts` consolidating reusable logic:

- Chain + token metadata (ported from `wormhole-api-nextjs/src/app/lib/chains.ts` and `tokens.ts`).
- Serialisable types (`RouteSummary`, `SerializedTransferRequest`, etc.).
- Helpers:
  - `getWormholeChains()`
  - `resolveTokenAddress(chainId, symbol)`
  - `buildTransferQuote(params)` – wraps SDK and returns statement for API.
  - `buildTransferTxList(params)` – used by `/bridge`.
  - `formatRouteSummary(route, quote)` – used by CLI display.
- Custom signer utilities (adapted from `createWormholeSigner`) exposing a function that can run on the client command if needed.

This avoids duplication between API handlers and commands.

---

## 6. Command Behaviour

### `quoteCommand`

1. Parse CLI input: `quote <fromChain> <toChain> <token> <amount> [--destToken <symbol>] [--receiver 0x...]`.
2. Resolve chain IDs and token addresses using shared helpers.
3. Call `/api/wormhole/quote`.
4. Cache result in `ExecutionContext.protocolState` under `wormhole`.
5. Display summary:
   ```
   Best route: AutomaticCCTPRoute (ETA ≈ 12m)
   Send: 1.00 USDC (Base)
   Receive: 0.9985 USDC (Ethereum)   Relay fee: 0.0015 USDC
   Steps:
     1. ERC20 approve → 0x...
     2. Bridge transfer → 0x...
   ```
6. Suggest `wormhole:routes` to inspect alternatives.

### `routesCommand`

- Pull cached state, list all available routes with indexes.
- Accept optional `--select <index>` to update preferred route in state.
- If no cached quote, instruct user to run `wormhole:quote`.

### `bridgeCommand`

1. Guard: wallet must be connected, and `wallet.chainId` must match source chain.
2. Fetch cached quote + selected route (default to `bestRoute` if none selected).
3. Call `/api/wormhole/bridge` to get transaction envelope(s).
4. For each transaction:
   - Present summary (type, `to`, `value`, truncated data).
   - Require confirmation unless `--yes`.
   - Broadcast via `walletClient.sendTransaction`.
5. Append tx hashes to `ExecutionContext.history` using `updateExecutionContext`.
6. Output final summary with WormholeScan link (fill template using last hash).

### `statusCommand`

- Input: `status [txHash]`.
- Default to last cached hash if not supplied.
- Call `/api/wormhole/status`.
- Render stage + helpful link(s).

### `tokensCommand` (optional)

- Render supported assets per chain using local metadata.
- Useful for user discovery and command completion.

---

## 7. Execution Context Shape

Store the session under `context.protocolState.get('wormhole')`:

```ts
interface WormholeState {
  lastQuote?: {
    bestRoute: RouteSummary
    allRoutes: RouteSummary[]
    transferRequest: SerializedTransferRequest
    sourceChainId: number
    destChainId: number
    tokenSymbol: string
    amount: string
  }
  selectedRouteType?: string
  lastTxHashes?: string[]
}
```

Update this object after each command to keep CLI flows stateless from the user’s perspective.

---

## 8. Terminal UX Considerations

- **Isolation**: rely on existing `ρ`/`ρ_f` behaviour—only wormhole commands + essential globals appear inside the fiber.
- **Help output**: `help` already filters identities; ensure wormhole commands provide concise descriptions and aliases.
- **Errors**: Provide actionable messages (“Unsupported chain pair”, “Run `wormhole:quote` first”, “Connect your wallet to Base (8453)”).
- **History**: every command should append entries to `ExecutionContext.history` for auditing.

---

## 9. Implementation Checklist

1. Scaffold plugin:
   ```bash
   cp -r src/plugins/_template src/plugins/wormhole
   # prune template commands, keep metadata + structure
   ```
2. Replace metadata (`id: 'wormhole'`, etc.) and register commands.
3. Implement command logic in `commands.ts` using helpers + API routes.
4. Build shared library in `src/lib/wormhole/`.
5. Create API route handlers (`quote`, `bridge`, optionally `status`, `tokens`).
6. Write tests:
   - Unit tests for helpers (token resolution, serialization).
   - Integration tests ensuring `composeCommands` keeps results in `G_p`.
   - Mocked API route tests verifying shape of responses.
7. Update docs (`FIBERED-MONOID-SPEC.md`, protocol catalog) once live.

---

## 10. Future Enhancements

- Add flags for relay fee preferences / native gas funding (pass through to SDK).
- Support automatic destination chain completion flows when SDK exposes them.
- Persist wormhole route cache between sessions (local storage or server state).
- Explore cross-fiber compositions once ambient identity workflows are formalised.

---

With this blueprint the `wormhole` plugin can be implemented as a proper `M_p` submonoid that faithfully reproduces the Wormhole SDK workflow within The DeFi Terminal.

