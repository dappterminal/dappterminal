# Stargate Fiber Plugin Architecture

Prepared for integrating Stargate stablecoin bridging into The DeFi Terminal as an `M_p` submonoid plugin. This document distills the behaviour observed in `/home/nick/dev/li.fi-api` (Stargate bridge explorer) and maps it onto the terminal’s fibered monoid architecture.

---

## 1. Goals & Scope

- Expose Stargate (LayerZero) stablecoin bridges as a protocol fiber `M_stargate`.
- Support multi-step cross-chain transfers (approval + bridge) driven by Stargate’s API.
- Preserve the algebraic guarantees of the terminal (protocol-specific identity, closure, isolation).
- Provide an ergonomic CLI workflow (`stargate:quote`, `stargate:bridge`, `stargate:status`) that mirrors the existing Next.js reference app.

Out-of-scope for the first iteration:
- Non-stablecoin assets (only the tokens Stargate quotes today).
- Route batching or combining with other protocols (remains isolated to `M_stargate`).
- Arbitrary LayerZero messaging — bridge-only.

---

## 2. Reference Implementation (li.fi-api)

Key observations from `/home/nick/dev/li.fi-api`:

1. **API route** (`src/app/api/routes/route.ts`) maps Li.Fi-style requests to the official Stargate quote endpoint:
   - Maintains a `CHAIN_KEY_MAP` converting EVM chain IDs → Stargate chain keys.
   - Calculates `dstAmountMin` (currently 0.5% slippage buffer).
   - Makes `GET https://stargate.finance/api/v1/quotes?...`.
   - Returns a Li.Fi-shaped `routes` object with `stargateSteps` (array of transactions that must be executed sequentially).

2. **Frontend workflow** (`src/app/page.tsx`):
   - Collects form data (tokens, chains, amount).
   - Calls `/api/routes` to fetch a transformed quote.
   - Stores `stargateSteps` and, upon execution, iterates each step:
     ```ts
     for const step of stargateSteps:
       walletClient.sendTransaction(step.transaction)
     ```
   - Tracks hashes to generate LayerZeroScan links.

3. **Token metadata** lives in `src/app/lib/tokens.ts` with per-chain static lists and 1inch fallbacks.

These are the behaviours we need to replicate behind terminal commands.

---

## 3. Fiber Design (`M_stargate`)

| Element                | Value / Notes                                                |
|------------------------|--------------------------------------------------------------|
| Protocol ID            | `stargate`                                                   |
| Scope                  | `G_p` (protocol fiber)                                       |
| Identity               | Added automatically via `createProtocolFiber('stargate', …)` |
| Isolation              | Commands only callable inside `M_stargate` session           |
| Tags                   | `['bridge', 'layerzero', 'stablecoins']`                     |

### Command Set (initial)

| Command ID      | Purpose                                                         | Aliases             |
|-----------------|-----------------------------------------------------------------|---------------------|
| `quote`         | Request bridge quote & expose estimated receive + steps         | `estimate`, `price` |
| `bridge`        | Execute previously quoted steps sequentially                    | `transfer`          |
| `status`        | Check LayerZeroScan / transaction hash status (polling helper)  | `track`             |
| `tokens`        | List supported tokens per chain (optional helper)               | `assets`            |

All commands live in `src/plugins/stargate/commands.ts` and must set `scope: 'G_p'` and `protocol: 'stargate'`.

---

## 4. API Surface

### 4.1 Next.js Routes (under `src/app/api/stargate/`)

1. **`/api/stargate/quote` (POST)**  
   - Request body mirrors the reference app (`fromChainId`, `toChainId`, `fromTokenAddress`, `toTokenAddress`, `fromAmount`, addresses).  
   - Performs the chain key lookup, slippage math, GET request to Stargate’s API.  
   - Returns:
     ```json
     {
       "success": true,
       "data": {
         "fromChainId": 8453,
         "toChainId": 42161,
         "fromAmount": "1000000",
         "toAmount": "997500",
         "stargateSteps": [...],
         "fullQuote": {...}
       }
     }
     ```

2. **`/api/stargate/bridge` (POST)**  
   - Accepts the quote payload plus wallet metadata (address, chain).  
   - Returns the ordered list of transaction envelopes along with recommended execution metadata.  
   - This endpoint does *not* send transactions; it preps data for the CLI client.  
   - Response shape consumed by `bridgeCommand`.

3. **`/api/stargate/tokens` (GET)** (optional but helpful)  
   - Serve a merged view of supported tokens per chain (from static list and/or 1inch fetch).

All handlers should return `apiToCommandResult`-friendly payloads (i.e., `{ success, data | error }`).

### 4.2 Shared Utilities

- `src/lib/stargate.ts` (to be created) centralises:
  - `CHAIN_KEY_MAP`
  - Token list / helper functions
  - `transformQuoteToRoute` (aligns with the reference implementation)
  - TypeScript types for `StargateStep`, `StargateQuote`, etc.

---

## 5. Command Behaviour

### 5.1 `quoteCommand`

- Parse CLI input: `quote <fromChain> <toChain> <token> <amount> [--destToken TOKEN]`.
- Resolve token addresses/decimals (prefer cached map in `ExecutionContext.protocolState`).
- Calculate amount in base units.
- Call `/api/stargate/quote`.
- Store returned quote (including `stargateSteps`) in `ExecutionContext.protocolState` keyed by session to avoid re-fetch before `bridge`.
- Emit a nicely formatted summary:
  ```
  From: 1 USDC (Base)
  To:   0.995 USDC (Arbitrum)  (-0.5% slippage)
  Steps:
    1. ERC20Approve → 0x... (gas estimate xx)
    2. StargateBridge → 0x...
  ```

### 5.2 `bridgeCommand`

- Require wallet connection (context wallet guard).
- Fetch latest quote from `protocolState`; optionally accept a `--refresh` flag to re-query.
- Iterate `stargateSteps`, constructing each `sendTransaction` payload (respecting `value`, `data`, `to`, chain).
- Use `context.wallet.chainId` to verify source chain; prompt user if mismatched (`use <chain>` to switch).
- For each transaction:
  1. Present summary (type, gas estimation, call data snippet).
  2. Ask for confirmation unless `--yes` flag provided.
  3. Submit via `walletClient.sendTransaction`.
  4. Collect hashes, push to `ExecutionContext.history`.
- Return all hashes plus convenience URLs (`LayerZeroScan`, `Block Explorer`).

### 5.3 `statusCommand`

- Input: `status <txHash>` or blank to use last hash from protocol state.
- Query `https://layerzeroscan.com/api/tx/<hash>` (or official API if exposed).
- Display cross-chain state (enqueued, executed, failed).
- If API unavailable, instruct manual tracking.

### 5.4 `tokensCommand` (optional helper)

- Print tokens by chain using the shared token map.
- Useful for discoverability inside the terminal.

---

## 6. Execution Context Usage

- `ExecutionContext.protocolState` should maintain:
  ```ts
  {
    lastQuote?: StargateQuote,
    lastTxHashes?: string[],
    tokenCache?: Record<string, { address: string; decimals: number }>
  }
  ```
- Update after every `quote` and `bridge`.
- Ensure `updateExecutionContext` is used to append execution history for auditability.

---

## 7. Identity & Composition

- `createProtocolFiber('stargate', 'Stargate Bridge', 'LayerZero stablecoin bridge')` automatically inserts `identity`.
- All commands must be registered via `addCommandToFiber`.
- Command composition examples:
  - `composeCommands(quoteCommand, bridgeCommand)` remains within `M_stargate` (enables future macros like `stargate:quote_then_bridge`).
  - Ambient identity (`identityCommand` from `G_core`) should not be used inside the fiber; rely on protocol identity for no-ops.

---

## 8. CLI UX Considerations

- **Aliases**: register protocol-local aliases (`bridge` → `stargate:bridge`) and leverage namespace resolution (`stargate:quote`) in global context.
- **Help Output**: hide the fiber identity command; surface `quote`, `bridge`, `status`, `tokens`, plus essential globals (`help`, `exit`, `history`, etc.).
- **Errors**: lean on descriptive messages (“Unsupported chain pair”, “Missing cached quote – run `stargate:quote` first”, “Wallet must be connected to Base”).
- **Isolation**: ensure `ρ` blocks `polygon:swap` invocations while inside `M_stargate` so the algebraic isolation guarantee holds.

---

## 9. Implementation Checklist

1. **Scaffold Plugin**
   - `cp -r src/plugins/_template src/plugins/stargate`
   - Update metadata (id, name, tags).
   - Replace template commands with Stargate-specific implementations.

2. **Server Routes**
   - Create `/app/api/stargate/quote/route.ts` and `/app/api/stargate/bridge/route.ts`.
   - Add optional `/tokens` route.
   - Share schema/types via `src/plugins/stargate/types.ts`.

3. **Shared Libs**
   - Add `src/lib/stargate.ts` with chain map, token helpers, transformers.
   - Export from `src/lib/index.ts` if needed.

4. **Hook Into Terminal**
   - Register plugin via `src/plugins/index.ts` or loader configuration.
   - Update `helpCommand` filtering to include Stargate commands (already fiber-aware).

5. **Testing**
   - Unit test token/address resolution.
   - Mock Stargate API responses for quote transformation tests.
   - Add integration test to ensure `stargate` commands stay in `G_p` scope and respect fiber isolation (similar to `monoid.test.ts` checks).

6. **Documentation**
   - Update `FIBERED-MONOID-SPEC.md` or protocol catalog once implementation lands.

---

## 10. Future Enhancements

- Support slippage configuration (`--slippage` flag) and pass to `dstAmountMin`.
- Cache supported tokens/chain info at runtime (background refresh).
- Add retry / backoff logic for LayerZero status polling.
- Explore composing Stargate with other fibers via ambient identity once cross-fiber workflow support is formalised.

---

With this blueprint, the repository is ready to implement the Stargate plugin as a proper `M_p` submonoid while reusing the proven behaviour from the reference li.fi integration.

