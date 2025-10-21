# Wormhole Bridge Integration Architecture

**Last Updated:** 2025-10-17
**Status:** ✅ Implemented

This document describes the Wormhole cross-chain bridge integration for The DeFi Terminal, implementing the protocol as an `M_wormhole` fiber plugin within the fibered monoid architecture.

---

## 1. Overview & Objectives

### Goals

- Expose Wormhole cross-chain token transfers as a protocol fiber plugin in the `G_p` scope
- Preserve fiber isolation and identity guarantees supplied by `createProtocolFiber`
- Reuse proven SDK patterns from reference implementation (route discovery, custom signer, sequential execution)
- Provide ergonomic CLI commands (`wormhole:quote`, `wormhole:bridge`, etc.) integrated with terminal UX

### Reference Implementation

Based on: `/home/nick/dev/wormhole-api-nextjs`

Key components ported from reference app:
- SDK bootstrap and resolver composition (AutomaticCCTP, CCTP, AutomaticTokenBridge, TokenBridge routes)
- Custom Viem → ethers signer adapter with direct transaction broadcasting
- Route discovery and quote aggregation workflow (`getTransferQuote`, `getQuotesForAllRoutes`)
- Multi-step transfer execution via `route.initiate(...)`

---

## 2. Fiber Definition (`M_wormhole`)

| Field          | Value                                                                  |
|----------------|------------------------------------------------------------------------|
| Protocol ID    | `wormhole`                                                             |
| Name           | `Wormhole Bridge`                                                      |
| Tags           | `['bridge', 'cross-chain', 'wormhole']`                                |
| Identity       | Injected automatically via `createProtocolFiber('wormhole', ...)`      |
| Isolation      | Only Wormhole commands + essential globals are visible while in fiber  |

### Command Set

| Command ID | Purpose                                                               | Status | Aliases                 |
|------------|-----------------------------------------------------------------------|--------|-------------------------|
| `quote`    | Discover available Wormhole routes and cache the best option          | ✅ Implemented | `estimate`, `preview`   |
| `routes`   | List all routes with fees/ETA, optionally select one                  | ✅ Implemented | `options`               |
| `bridge`   | Execute the cached route by streaming the SDK transactions            | ✅ Implemented | `transfer`, `execute`   |
| `status`   | Fetch WormholeScan status for the latest hash                         | 🚧 Planned     | `track`                 |
| `tokens`   | Display supported assets per chain                                    | 🚧 Planned     | `assets`                |
| `chains`   | List supported chains with metadata                                   | ✅ Implemented | `networks`              |

Each command sets `scope: 'G_p'` and `protocol: 'wormhole'`, registered via `addCommandToFiber` during plugin initialization.

**Implementation:** `src/plugins/wormhole/commands.ts`

---

## 3. API Implementation

API handlers under `src/app/api/wormhole/`:

### **POST `/api/wormhole/quote`** ✅ Implemented

Discover available Wormhole routes and return quotes.

**Request:**
```json
{
  "sourceChainId": 8453,
  "destChainId": 42161,
  "tokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "amount": "1000000",
  "sourceAddress": "0x...",
  "destAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bestRoute": {
      "type": "AutomaticCCTPRoute",
      "eta": "12m",
      "fee": "1500",
      "receiveAmount": "998500"
    },
    "quotes": [/* Array of all available routes */],
    "transferRequest": {/* Serialized transfer request */},
    "wormholeContext": {/* SDK context data */}
  }
}
```

**Behavior:**
- Maps chain IDs → Wormhole chain names using `CHAIN_KEY_MAP`
- Calls SDK helpers (`getTransferQuote`, `getQuotesForAllRoutes`)
- Returns best route first (typically AutomaticCCTPRoute)
- Serializes only enums/strings (no raw SDK instances)

**Implementation:** `src/app/api/wormhole/quote/route.ts`

---

### **POST `/api/wormhole/bridge`** ✅ Implemented

Execute a Wormhole bridge transfer.

**Request:**
```json
{
  "selectedRouteType": "AutomaticCCTPRoute",
  "transferRequest": {/* From quote response */},
  "amount": "1000000",
  "sourceAddress": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "transactions": [
      { "to": "0x...", "data": "0x...", "value": "0x0", "description": "ERC20 approve" },
      { "to": "0x...", "data": "0x...", "value": "0x0", "description": "Bridge transfer" }
    ],
    "receiverChain": "Arbitrum",
    "scanUrl": "https://wormholescan.io/#/tx/{{hash}}?network=Mainnet"
  }
}
```

**Behavior:**
- Reconstructs route via resolver
- Validates and re-quotes
- Returns ordered transaction list for CLI to execute
- Does NOT broadcast transactions (client-side signing)

**Implementation:** `src/app/api/wormhole/bridge/route.ts`

---

### Future Routes

- **GET `/api/wormhole/status`** - Query WormholeScan transaction status (pending, attested, delivered)
- **GET `/api/wormhole/tokens`** - Supported tokens per chain for autocomplete

---

## 4. Shared Library Module

**Location:** `src/lib/wormhole/index.ts`

Consolidates reusable logic:

- **Chain + token metadata**: Ported from `wormhole-api-nextjs/src/app/lib/chains.ts` and `tokens.ts`
- **Serializable types**: `RouteSummary`, `SerializedTransferRequest`, etc.
- **Helpers**:
  - `getWormholeChains()` - Returns supported chain metadata
  - `resolveTokenAddress(chainId, symbol)` - Maps symbols to addresses
  - `buildTransferQuote(params)` - Wraps SDK and returns quote
  - `buildTransferTxList(params)` - Used by `/bridge` endpoint
  - `formatRouteSummary(route, quote)` - CLI display formatting
- **Custom signer utilities**: Viem → ethers adapter with `signAndSend` override

This avoids duplication between API handlers and commands.

---

## 5. Command Behavior

### `quoteCommand` ✅ Implemented

**Usage:** `quote <fromChain> <toChain> <token> <amount> [--destToken <symbol>] [--receiver 0x...]`

**Flow:**
1. Parse CLI input and resolve chain IDs + token addresses
2. Call `/api/wormhole/quote`
3. Cache result in `ExecutionContext.protocolState`
4. Display summary:
   ```
   Best route: AutomaticCCTPRoute (ETA ≈ 12m)
   Send: 1.00 USDC (Base)
   Receive: 0.9985 USDC (Arbitrum)   Relay fee: 0.0015 USDC
   Steps:
     1. ERC20 approve → 0x...
     2. Bridge transfer → 0x...
   ```
5. Suggest `wormhole:routes` to inspect alternatives

**Implementation:** `src/plugins/wormhole/commands.ts:quoteCommand`

---

### `routesCommand` ✅ Implemented

**Usage:** `routes [--select <index>]`

**Flow:**
- Pull cached quote state
- List all available routes with indexes, ETAs, and fees
- Accept optional `--select <index>` to update preferred route
- If no cached quote, instruct user to run `wormhole:quote`

**Implementation:** `src/plugins/wormhole/commands.ts:routesCommand`

---

### `bridgeCommand` ✅ Implemented

**Usage:** `bridge [--yes]`

**Flow:**
1. Guard: wallet must be connected, `wallet.chainId` must match source chain
2. Fetch cached quote + selected route (default to `bestRoute`)
3. Call `/api/wormhole/bridge` to get transaction envelopes
4. For each transaction:
   - Present summary (type, `to`, `value`, truncated data)
   - Require confirmation unless `--yes` flag
   - Broadcast via `walletClient.sendTransaction`
5. Append tx hashes to `ExecutionContext.history`
6. Output final summary with WormholeScan link

**Implementation:** `src/plugins/wormhole/commands.ts:bridgeCommand`

---

### `chainsCommand` ✅ Implemented

**Usage:** `chains`

**Flow:**
- Display supported Wormhole chains with IDs and names
- Useful for discovery and command construction

**Implementation:** `src/plugins/wormhole/commands.ts:chainsCommand`

---

### Future Commands

#### `statusCommand` 🚧 Planned

**Usage:** `status [txHash]`

**Flow:**
- Default to last cached hash if not supplied
- Call `/api/wormhole/status`
- Render cross-chain state (pending, attested, delivered) + WormholeScan link

#### `tokensCommand` 🚧 Planned

**Usage:** `tokens [chainId]`

**Flow:**
- Render supported assets per chain using local metadata
- Useful for user discovery and command completion

---

## 6. Execution Context Shape

Session state stored under `context.protocolState.get('wormhole')`:

```typescript
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

Updated after each command to maintain session continuity.

---

## 7. Terminal UX Considerations

- **Isolation**: Relies on `ρ`/`ρ_f` operators—only wormhole commands + essential globals appear inside the fiber
- **Help output**: `help` command filters by fiber context; wormhole commands show concise descriptions and aliases
- **Errors**: Actionable messages:
  - "Unsupported chain pair: Base → Polygon"
  - "Run `wormhole:quote` first to fetch routes"
  - "Connect your wallet to Base (8453)"
- **History**: Every command appends entries to `ExecutionContext.history` for auditability

---

## 8. Implementation Status

### ✅ Completed

- [x] Plugin scaffold (`src/plugins/wormhole/`)
- [x] Fiber metadata (`id: 'wormhole'`, tags, protocol-specific identity)
- [x] Command registration via `addCommandToFiber`
- [x] API route handlers (`/quote`, `/bridge`)
- [x] Shared library (`src/lib/wormhole/`)
- [x] CLI commands (`quote`, `routes`, `bridge`, `chains`)
- [x] Execution context state management
- [x] Wallet integration (viem/wagmi)
- [x] Multi-step transaction execution
- [x] Error handling and user feedback

### 🚧 Planned

- [ ] `/api/wormhole/status` endpoint
- [ ] `statusCommand` implementation
- [ ] `tokensCommand` implementation
- [ ] Unit tests for helpers (token resolution, serialization)
- [ ] Integration tests for fiber closure (`composeCommands` in `G_p`)
- [ ] Mocked API route tests

### 📝 Documentation

- [x] Architecture document (this file)
- [x] API reference in `/src/app/api/README.md`
- [x] Protocol catalog in `/FIBERED-MONOID-SPEC.md`
- [x] Main README updated

---

## 9. Usage Examples

### Basic Bridge Flow

```bash
# Enter Wormhole fiber
use wormhole

# Get quote for bridging USDC from Base to Arbitrum
quote base arbitrum usdc 1

# View all available routes
routes

# Execute bridge transaction
bridge

# Check status (future)
status

# Exit fiber
exit
```

### Advanced Options

```bash
# Quote with custom destination address
wormhole:quote base arbitrum usdc 1 --receiver 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb

# Select specific route before bridging
routes --select 2

# Auto-confirm bridge (skip prompt)
bridge --yes

# View supported chains
chains
```

---

## 10. Future Enhancements

- Add `--slippage` flag for relay fee preferences
- Support native gas funding options (pass through to SDK)
- Automatic destination chain completion flows when SDK exposes them
- Persistent route cache between sessions (local storage/server state)
- Cross-fiber compositions once ambient identity workflows are formalized
- Batch bridging (multiple transfers in one session)
- Gas estimation display before execution

---

## 11. Related Documentation

- **Main README**: `/README.md` - Project overview and setup
- **Fibered Monoid Spec**: `/FIBERED-MONOID-SPEC.md` - Algebraic architecture
- **Plugin Guide**: `/src/plugins/README.md` - Plugin development
- **API Reference**: `/src/app/api/README.md` - API routes documentation
- **Stargate Architecture**: `/src/plugins/stargate/ARCHITECTURE.md` - Similar bridge implementation

---

**Summary:** The `wormhole` plugin implements a proper `M_p` submonoid that faithfully reproduces the Wormhole SDK workflow within The DeFi Terminal, maintaining all algebraic guarantees of the fibered monoid architecture.
