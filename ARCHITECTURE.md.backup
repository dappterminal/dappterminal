# Wormhole Bridge Integration Architecture

This document captures the current implementation inside `/home/nick/dev/wormhole-api-nextjs` and defines how to translate it into an `M_p` fiber plugin for The DeFi Terminal. It mirrors the level of detail used for the Stargate/Li.Fi architecture notes and focuses on preparing a `wormhole` submonoid with a first-class `bridge` command.

---

## 1. Goals

- Expose Wormhole cross-chain token transfers through a dedicated protocol fiber `M_wormhole`.
- Reuse the proven workflow implemented in the Next.js reference app:
  1. Quote routes using the Wormhole SDK resolver.
  2. Let users preview routes/fees/ETAs.
  3. Execute the selected route by streaming the necessary transactions through the connected wallet.
- Preserve the fibered monoid guarantees: protocol-specific identity, closure, and isolation from other fibers.
- Provide CLI ergonomics comparable to the UI (`wormhole:quote`, `wormhole:routes`, `wormhole:bridge`, `wormhole:status`).

---

## 2. Reference Implementation Summary

Source: `src/app/lib/wormhole.ts`, `src/app/components/Bridge.tsx`, and supporting libs.

1. **SDK bootstrapping**
   - `wormhole('Mainnet', [evm])` initialises the SDK.
   - Resolver combines multiple route types (Automatic CCTP, manual CCTP, automatic token bridge, manual token bridge) to favour fast paths first.

2. **Signer bridging**
   - `createWormholeSigner` wraps a `WalletClient` (Viem) by converting it to an ethers-style signer that overrides `signAndSend` to directly broadcast transactions.
   - This avoids using unsupported `eth_signTransaction` flows while still satisfying the Wormhole SDK’s expectations.

3. **Route discovery**
   - `getTransferQuote`:
     - Resolves chain contexts (`wh.getChain`).
     - Builds a `tokenId` (special casing native gas token address).
     - Finds destination-compatible token representations via `resolver.supportedDestinationTokens`.
     - Creates a `RouteTransferRequest`, injecting sender/receiver addresses.
     - Calls `resolver.findRoutes` returning prioritised routes (first is “best”).
   - `getQuotesForAllRoutes` loops through candidate routes to validate and quote transfer costs/ETAs.

4. **Execution**
   - `initiateTransfer` validates the chosen route, re-quotes, and then calls `route.initiate(...)` using the custom signer. It returns receipts containing origin transaction hashes.

5. **UI Flow (`Bridge.tsx`)**
   - Collects inputs (chains, token, amount, route selection).
   - Calls `getTransferQuote` → `getQuotesForAllRoutes`.
   - Shows route list, allowing selection.
   - Uses `createWormholeSigner` & `initiateTransfer` to execute, then surfaces WormholeScan links.

These behaviours are what we must port into the terminal plugin and supporting API endpoints.

---

## 3. Target Fiber Design (`M_wormhole`)

| Attribute      | Value                                                            |
|----------------|------------------------------------------------------------------|
| Protocol ID    | `wormhole`                                                       |
| Scope          | `G_p`                                                             |
| Identity       | Added via `createProtocolFiber('wormhole', ...)` (scope `G_p`)   |
| Isolation      | Commands only callable inside `M_wormhole` session               |
| Tags           | `['bridge', 'cross-chain', 'wormhole']`                          |

### Command Set (Initial)

| Command          | Purpose                                                        | Aliases                   |
|------------------|----------------------------------------------------------------|---------------------------|
| `quote`          | Fetch candidate routes and summarise best ETA/fees             | `estimate`, `preview`     |
| `routes`         | Display full list of available routes + metadata               | `options`                 |
| `select`         | Mark a specific route as active (optional, else `quote` picks) | `choose`                  |
| `bridge`         | Execute the selected route using cached quote + wallet signer  | `transfer`, `execute`     |
| `status`         | Query WormholeScan / route status via tx hash                  | `track`                   |

Implementation lives in `src/plugins/wormhole/commands.ts`. All commands must set `scope: 'G_p'` and `protocol: 'wormhole'`, be registered via `addCommandToFiber`, and rely on protocol identity for no-op operations.

---

## 4. Backend API Surface

Create Next.js API routes under `src/app/api/wormhole/`:

1. **`/api/wormhole/quote` (POST)**
   - Request body: `{ sourceChainId, destChainId, tokenAddress, amount, sourceAddress, destAddress }`.
   - Map chain IDs to Wormhole chain names using a shared registry (`src/lib/wormhole/chains.ts`).
   - Run the same logic as `getTransferQuote` + `getQuotesForAllRoutes`.
   - Response (for `apiToCommandResult`):
     ```json
     {
       "success": true,
       "data": {
         "bestRoute": { ... },     // summary digest friendly for CLI display
         "quotes": [ ... ],        // array of route+quote details
         "transferRequest": { ... },
         "wormholeContext": { ... } // serialisable subset needed for execution
       }
     }
     ```
     Persist minimal route metadata (constructor name, required params) to avoid serialising SDK instances directly; store them in `ExecutionContext.protocolState`.

2. **`/api/wormhole/bridge` (POST)**
   - Accepts `transferRequest`, selected `routeType`, `laxQuoteParams`, plus wallet metadata.
   - Recreates the resolver/route instances, validates, and returns the ordered transactions to execute.
   - Does **not** broadcast itself; returns payload for CLI to send via wallet provider:
     ```json
     {
       "success": true,
       "data": {
         "transactions": [
           { "to": "...", "data": "0x...", "value": "0x0", "description": "ERC20 approval" },
           { "to": "...", "data": "0x...", "value": "0x0", "description": "Bridge transfer" }
         ],
         "receiverChain": "...",
         "scanUrl": "https://wormholescan.io/#/tx/<hash>?network=Mainnet"
       }
     }
     ```

3. **`/api/wormhole/routes` (POST)** (optional)
   - Return list of available routes with metadata (ETA, fees, reliability) to drive the `routes` command without repeating `quote`.

4. **`/api/wormhole/status` (GET)**
   - Proxy WormholeScan or Wormhole SDK status query to provide CLI-friendly updates.

Shared utilities should be extracted into `src/lib/wormhole/index.ts` (or similar) to avoid duplicating logic between API and plugin.

---

## 5. Command Behaviour & Context Handling

Use `ExecutionContext.protocolState.get('wormhole')` to store session data:

```ts
interface WormholeSessionState {
  lastQuote?: {
    bestRoute: RouteSummary
    quotes: RouteSummary[]
    transferRequest: SerializedTransferRequest
  }
  selectedRouteType?: string
  pendingTxs?: string[]        // hashes from latest bridge execution
}
```

- `quoteCommand`:
  - Parse input: `quote <fromChain> <toChain> <token> <amount> [--destToken SYMBOL --address DEST]`.
  - Resolve token addresses/decimals from shared map (`src/lib/tokens.ts`).
  - Call `/api/wormhole/quote`.
  - Cache result in `protocolState`.
  - Display best route summary (route type, ETA, relay fee, expected receive).
  - Suggest `wormhole:routes` to inspect others.

- `routesCommand`:
  - Use cached quote; if missing, prompt running `quote`.
  - Render all route options with indexes; optionally accept `routes --select <n>` to update `selectedRouteType`.

- `bridgeCommand`:
  - Require connected wallet + cached quote.
  - Ensure wallet chain matches source chain; instruct user to `use base` etc.
  - Hit `/api/wormhole/bridge`, passing selected route.
  - Iterate returned transactions:
    1. Present summary.
    2. Confirm unless `--yes`.
    3. Use `walletClient.sendTransaction`.
  - Record hashes in context history (`updateExecutionContext`).
  - Return final summary with WormholeScan link.

- `statusCommand`:
  - Accept tx hash or use last hash.
  - Call `/api/wormhole/status`.
  - Print human-readable stage (pending, attested, delivered).

Ensure all commands log to `ExecutionContext.history` for auditability.

---

## 6. CLI UX Notes

- **Namespace**: Provide protocol-local aliases (`wormhole:bridge`) and short forms (`bridge` when inside fiber).
- **Help integration**: hide protocol identity command; show `quote`, `routes`, `bridge`, `status`, plus essential globals (`help`, `exit`, `history`).
- **Isolation**: `ρ`/`ρ_f` already enforce fiber isolation. Double-check that fuzzy search inside `M_wormhole` only returns wormhole commands + allowed globals.
- **Errors**: Return explicit messages for unsupported chain/token combinations, missing quotes, or wallet chain mismatches.

---

## 7. Implementation Checklist

1. **Scaffold Plugin**
   - `cp -r src/plugins/_template src/plugins/wormhole`.
   - Update metadata (id `wormhole`, name `Wormhole Bridge`, tags).
   - Replace template commands with wormhole-specific ones.

2. **Server Routes & Helpers**
   - Create `src/app/api/wormhole/quote/route.ts`, `/bridge/route.ts`, `/status/route.ts`.
   - Extract shared logic into `src/lib/wormhole/` (chain map, token helpers, converter functions, serialization utilities).
   - Reuse existing `TOKENS`, `CHAINS`, and `wormhole.ts` logic—refactor into modular functions consumable by both API and CLI layers.

3. **Command Implementation**
   - Implement `quote`, `routes`, `bridge`, `status` commands using `callProtocolApi`.
   - Update `ExecutionContext` state as described.
   - Register commands in `initialize`.

4. **Terminal Wiring**
   - Ensure plugin loader registers `wormhole` plugin (either statically or via config).
   - Confirm `helpCommand` (fiber-aware) presents commands correctly.

5. **Testing**
   - Unit tests for helper utilities (token resolution, chain mapping).
   - Mock Wormhole SDK calls to validate API handler transformations.
   - Add integration tests verifying `composeCommands` keeps outputs within `G_p`, and that `wormhole` commands respect isolation.

6. **Documentation**
   - Once implementation lands, update protocol catalog in the main repo (`FIBERED-MONOID-SPEC.md`) with Wormhole info.

---

## 8. Future Enhancements

- Add slippage and gas-options flags (`--gas`, `--nativeGas`) mirroring SDK parameters.
- Support automatic completion on destination chain when required (e.g., swap-out flows).
- Persist route cache across sessions (local storage or server state).
- Explore cross-fiber compositions (e.g., `wormhole:bridge` followed by `uniswap:swap`) once ambient identity workflows are formalised.

---

With this architecture, the repository is ready to expose Wormhole bridging as a proper `M_p` submonoid plugin, ensuring feature parity with the existing Next.js implementation while respecting the terminal’s algebraic structure. 
