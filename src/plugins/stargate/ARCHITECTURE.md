# Stargate Bridge Integration Architecture

**Last Updated:** 2025-10-17
**Status:** ✅ Implemented

This document describes the Stargate/LayerZero bridge integration for The DeFi Terminal as an `M_stargate` submonoid plugin within the fibered monoid architecture.

---

## 1. Overview & Objectives

### Goals

- Expose Stargate (LayerZero) stablecoin bridges as a protocol fiber plugin in the `G_p` scope
- Support multi-step cross-chain transfers (approval + bridge) driven by Stargate's API
- Preserve algebraic guarantees (protocol-specific identity, closure, isolation)
- Provide ergonomic CLI workflow (`stargate:quote`, `stargate:bridge`, `stargate:chains`) mirroring the reference app

### Reference Implementation

Based on: `/home/nick/dev/li.fi-api` (Stargate bridge explorer)

Key components:
- Li.Fi-style API route mapping to Stargate quote endpoint
- Chain ID → Stargate chain key conversion (`CHAIN_KEY_MAP`)
- Slippage calculation for `dstAmountMin`
- Multi-step transaction execution (approve + bridge)

### Current Scope

- ✅ Stablecoin bridging (USDC, USDT supported by Stargate)
- ✅ Multi-step transaction workflow
- ❌ Non-stablecoin assets (limited by Stargate API)
- ❌ Cross-protocol compositions (fiber isolation maintained)
- ❌ Arbitrary LayerZero messaging (bridge-only)

---

## 2. Fiber Definition (`M_stargate`)

| Field          | Value                                                            |
|----------------|------------------------------------------------------------------|
| Protocol ID    | `stargate`                                                       |
| Name           | `Stargate Bridge`                                                |
| Tags           | `['bridge', 'layerzero', 'stablecoins']`                         |
| Identity       | Injected automatically via `createProtocolFiber('stargate', …)`  |
| Isolation      | Only Stargate commands + essential globals visible in fiber      |

### Command Set

| Command ID | Purpose                                                | Status         | Aliases             |
|------------|--------------------------------------------------------|----------------|---------------------|
| `quote`    | Request bridge quote & display estimated receive       | ✅ Implemented | `estimate`, `price` |
| `bridge`   | Execute previously quoted steps sequentially           | ✅ Implemented | `transfer`          |
| `chains`   | List supported chains with metadata                    | ✅ Implemented | `networks`          |
| `status`   | Check LayerZeroScan transaction status                 | 🚧 Planned     | `track`             |
| `tokens`   | List supported tokens per chain                        | 🚧 Planned     | `assets`            |

Each command sets `scope: 'G_p'` and `protocol: 'stargate'`, registered via `addCommandToFiber` during plugin initialization.

**Implementation:** `src/plugins/stargate/commands.ts`

---

## 3. API Implementation

API handlers under `src/app/api/stargate/`:

### **POST `/api/stargate/quote`** ✅ Implemented

Fetch bridge quote from Stargate/LayerZero API.

**Request:**
```json
{
  "fromChainId": 8453,
  "toChainId": 42161,
  "fromTokenAddress": "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
  "toTokenAddress": "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
  "fromAmount": "1000000",
  "fromAddress": "0x...",
  "toAddress": "0x...",
  "slippage": 0.5
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "fromChainId": 8453,
    "toChainId": 42161,
    "fromAmount": "1000000",
    "toAmount": "997500",
    "stargateSteps": [
      {
        "type": "approve",
        "transaction": { "to": "0x...", "data": "0x...", "value": "0x0" }
      },
      {
        "type": "bridge",
        "transaction": { "to": "0x...", "data": "0x...", "value": "0x123" }
      }
    ],
    "fullQuote": { /* Full Stargate API response */ }
  }
}
```

**Behavior:**
- Maps chain IDs → Stargate chain keys via `CHAIN_KEY_MAP`
- Calculates `dstAmountMin` with slippage (default 0.5%)
- Queries `https://stargate.finance/api/v1/quotes`
- Returns multi-step transaction array (approve + bridge)

**Supported Chains:** Base (8453), Arbitrum (42161), Ethereum (1), Polygon (137), Optimism (10)

**Implementation:** `src/app/api/stargate/quote/route.ts`

---

### Future Routes

- **POST `/api/stargate/bridge`** - Prepare bridge transactions (currently quote returns steps directly)
- **GET `/api/stargate/tokens`** - Supported tokens per chain
- **GET `/api/stargate/status`** - Query LayerZeroScan status

---

## 4. Shared Library Module

**Location:** `src/lib/stargate.ts`

Consolidates reusable logic:

- **Chain key mapping**: `CHAIN_KEY_MAP` converting EVM chain IDs → Stargate chain keys
- **Slippage calculation**: `calculateMinDestAmount(amount, slippage)`
- **Token metadata**: Static lists per chain with 1inch fallback
- **TypeScript types**: `StargateStep`, `StargateQuote`, `StargateChain`, etc.

This avoids duplication between API handlers and commands.

---

## 5. Command Behavior

### `quoteCommand` ✅ Implemented

**Usage:** `quote <fromChain> <toChain> <token> <amount> [--destToken TOKEN] [--slippage 0.5]`

**Flow:**
1. Parse CLI input and resolve chain IDs + token addresses
2. Calculate amount in base units (respecting token decimals)
3. Call `/api/stargate/quote`
4. Store returned quote (including `stargateSteps`) in `ExecutionContext.protocolState`
5. Display summary:
   ```
   From: 1.00 USDC (Base)
   To:   0.995 USDC (Arbitrum)  (-0.5% slippage)
   Steps:
     1. ERC20 Approve → 0x... (estimated gas: 45,000)
     2. Stargate Bridge → 0x...
   ```
6. Suggest `stargate:bridge` to execute

**Implementation:** `src/plugins/stargate/commands.ts:quoteCommand`

---

### `bridgeCommand` ✅ Implemented

**Usage:** `bridge [--yes] [--refresh]`

**Flow:**
1. Guard: wallet must be connected, `wallet.chainId` must match source chain
2. Fetch cached quote from `protocolState` (or re-query with `--refresh`)
3. Iterate `stargateSteps`, constructing each transaction payload
4. For each transaction:
   - Present summary (type, `to`, `value`, truncated data)
   - Request confirmation unless `--yes` flag
   - Submit via `walletClient.sendTransaction`
   - Collect hash
5. Append all hashes to `ExecutionContext.history`
6. Output final summary with LayerZeroScan links

**Implementation:** `src/plugins/stargate/commands.ts:bridgeCommand`

---

### `chainsCommand` ✅ Implemented

**Usage:** `chains`

**Flow:**
- Display supported Stargate chains with IDs and names
- Shows chain key mappings for debugging
- Useful for discovery and command construction

**Implementation:** `src/plugins/stargate/commands.ts:chainsCommand`

---

### Future Commands

#### `statusCommand` 🚧 Planned

**Usage:** `status [txHash]`

**Flow:**
- Default to last cached hash if not supplied
- Query LayerZeroScan API: `https://layerzeroscan.com/api/tx/<hash>`
- Display cross-chain state (enqueued, executed, delivered, failed)
- Provide LayerZeroScan + block explorer links

#### `tokensCommand` 🚧 Planned

**Usage:** `tokens [chainId]`

**Flow:**
- Display supported tokens per chain using shared token map
- Useful for discovery inside the terminal

---

## 6. Execution Context Shape

Session state stored under `context.protocolState.get('stargate')`:

```typescript
interface StargateState {
  lastQuote?: {
    fromChainId: number
    toChainId: number
    fromAmount: string
    toAmount: string
    stargateSteps: StargateStep[]
    fullQuote: any
  }
  lastTxHashes?: string[]
  tokenCache?: Record<string, { address: string; decimals: number }>
}
```

Updated after each command to maintain session continuity.

---

## 7. Terminal UX Considerations

- **Isolation**: Relies on `ρ`/`ρ_f` operators—only stargate commands + essential globals appear inside the fiber
- **Help output**: `help` command filters by fiber context; stargate commands show concise descriptions and aliases
- **Errors**: Actionable messages:
  - "Unsupported chain pair: Ethereum → Polygon"
  - "Run `stargate:quote` first to fetch a quote"
  - "Wallet must be connected to Base (8453)"
- **History**: Every command appends entries to `ExecutionContext.history` for auditability
- **Protocol identity**: Injected automatically via `createProtocolFiber`, ensuring proper submonoid structure

---

## 8. Implementation Status

### ✅ Completed

- [x] Plugin scaffold (`src/plugins/stargate/`)
- [x] Fiber metadata (`id: 'stargate'`, tags, protocol-specific identity)
- [x] Command registration via `addCommandToFiber`
- [x] API route handler (`/quote`)
- [x] Shared library (`src/lib/stargate.ts`)
- [x] CLI commands (`quote`, `bridge`, `chains`)
- [x] Execution context state management
- [x] Wallet integration (viem/wagmi)
- [x] Multi-step transaction execution (approve + bridge)
- [x] Error handling and user feedback

### 🚧 Planned

- [ ] `/api/stargate/bridge` endpoint (currently quote returns steps directly)
- [ ] `/api/stargate/status` endpoint
- [ ] `/api/stargate/tokens` endpoint
- [ ] `statusCommand` implementation
- [ ] `tokensCommand` implementation
- [ ] Unit tests for helpers (token resolution, slippage calculation)
- [ ] Integration tests for fiber closure
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
# Enter Stargate fiber
use stargate

# Get quote for bridging USDC from Base to Arbitrum
quote base arbitrum usdc 1

# Execute bridge transaction
bridge

# Check status (future)
status

# Exit fiber
exit
```

### Advanced Options

```bash
# Quote with custom slippage
stargate:quote base arbitrum usdc 1 --slippage 1.0

# Auto-confirm bridge (skip prompt)
bridge --yes

# Refresh quote before bridging
bridge --refresh

# View supported chains
chains
```

---

## 10. Future Enhancements

- Add `--slippage` flag configuration for `dstAmountMin`
- Cache supported tokens/chain info at runtime (background refresh)
- Retry/backoff logic for LayerZero status polling
- Cross-fiber compositions once ambient identity workflows are formalized
- Batch bridging (multiple transfers in one session)
- Gas estimation display before execution
- Support for non-stablecoin assets (when Stargate adds support)

---

## 11. Related Documentation

- **Main README**: `/README.md` - Project overview and setup
- **Fibered Monoid Spec**: `/FIBERED-MONOID-SPEC.md` - Algebraic architecture
- **Plugin Guide**: `/src/plugins/README.md` - Plugin development
- **API Reference**: `/src/app/api/README.md` - API routes documentation
- **Wormhole Architecture**: `/src/plugins/wormhole/ARCHITECTURE.md` - Similar bridge implementation

---

**Summary:** The `stargate` plugin implements a proper `M_p` submonoid that integrates Stargate/LayerZero stablecoin bridging within The DeFi Terminal, maintaining all algebraic guarantees of the fibered monoid architecture.

