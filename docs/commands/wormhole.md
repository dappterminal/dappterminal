# Wormhole Commands

Wormhole is a cross-chain messaging protocol that enables asset transfers between blockchains, including both EVM and non-EVM chains.

## Prerequisites

- Connected wallet
- Assets to bridge
- Native gas tokens on both source and destination chains
- Understanding of Wormhole's validator network

## Entering Wormhole Context

```bash
use wormhole
```

Or use commands directly with the `wormhole:` prefix:
```bash
wormhole:quote ethereum solana USDC 100
```

## Commands

### `quote <fromChain> <toChain> <token> <amount>`

Get bridge quotes for cross-chain transfers via Wormhole.

**Syntax**:
```bash
quote <fromChain> <toChain> <token> <amount>
```

**Arguments**:
- `fromChain` - Source chain (ethereum, solana, polygon, bsc, etc.)
- `toChain` - Destination chain
- `token` - Token to bridge (USDC, ETH, SOL, etc.)
- `amount` - Amount to bridge

**Example**:
```bash
wormhole> quote ethereum base USDC 100
Wormhole Bridge Quote:

Route 1: Circle CCTP (Native) ⭐ Recommended
  From: Ethereum → Base
  Amount: 100 USDC
  Protocol: Circle CCTP via Wormhole

  Time: ~2 minutes (native burn/mint)
  Fee: 0.00 USDC (no protocol fee)
  Gas (Ethereum): ~$2.50
  Gas (Base): ~$0.01 (auto-relayed)

  You Receive: 100.00 USDC (native USDC)

Route 2: Wormhole Token Bridge
  From: Ethereum → Base
  Amount: 100 USDC
  Protocol: Wormhole Wrapped

  Time: ~5 minutes (lock/mint)
  Fee: 0.00 USDC
  Gas: ~$3.00

  You Receive: 100.00 USDC (wrapped)

Select route (1-2) or 'cancel': 1

# Cross-chain to Solana
wormhole> quote ethereum solana USDC 100
Wormhole Bridge Quote:

Route: Wormhole Token Bridge
  From: Ethereum → Solana
  Amount: 100 USDC

  Mechanism: Lock on Ethereum, Mint on Solana
  Time: ~15 minutes (Solana finality)
  Fee: 0.00 USDC
  Gas (Ethereum): ~$3.50
  Gas (Solana): ~0.001 SOL (auto-relayed)

  You Receive: 100.00 USDC (Wormhole-wrapped)
  Token: USDCet (Wormhole USDC on Solana)

Confirm quote? (y/n)
```

**Notes**:
- CCTP routes provide native tokens (no wrapping)
- Regular Wormhole routes create wrapped tokens
- Cross-VM bridges (EVM ↔ Solana) take longer due to finality
- Automatic route selection prioritizes CCTP when available

---

### `routes`

List all available Wormhole routes and protocols.

**Syntax**:
```bash
routes
```

**Output**:
- Available bridge mechanisms
- Supported chains
- Token types

**Example**:
```bash
wormhole> routes
Wormhole Bridge Routes:

Circle CCTP (Native):
  ✓ Ethereum ↔ Optimism, Arbitrum, Base, Polygon, Avalanche
  ✓ Tokens: USDC (native)
  ✓ Fast: 2-3 minutes
  ✓ No wrapping, native tokens

Wormhole Token Bridge:
  ✓ 30+ chains (EVM and non-EVM)
  ✓ Tokens: All major tokens
  ✓ Medium: 5-20 minutes
  ✓ Creates wrapped tokens

Wormhole Connect:
  ✓ Automated routing
  ✓ Combines CCTP + Token Bridge
  ✓ Optimizes for best route

Supported Chain Pairs:
  EVM ↔ EVM: Ethereum, BSC, Polygon, Avalanche, Fantom, etc.
  EVM ↔ Solana
  EVM ↔ Terra
  EVM ↔ Cosmos chains
  And more...
```

---

### `bridge <amount> <token> <fromChain> <toChain> [--route <type>]`

Execute a cross-chain bridge transfer via Wormhole.

**Syntax**:
```bash
bridge <amount> <token> <fromChain> <toChain> [--route <cctp|token>]
```

**Arguments**:
- `amount` - Amount to bridge
- `token` - Token symbol
- `fromChain` - Source chain
- `toChain` - Destination chain

**Options**:
- `--route <type>` - Force specific route: `cctp` or `token`

**Example**:
```bash
# CCTP bridge (native USDC)
wormhole> bridge 100 USDC ethereum base
Using Circle CCTP route...

Wormhole CCTP Bridge:
  From: Ethereum → Base
  Amount: 100 USDC
  Route: Circle CCTP (Native)
  You receive: 100.00 USDC (native)

Step 1/2: Approve USDC
Approve 100 USDC? (y/n): y
Approving...
✓ Approval confirmed

Step 2/2: Burn and Transfer
Executing CCTP burn on Ethereum...
Transaction submitted: 0xabc123...

⏳ Status: Waiting for Ethereum confirmation...
✓ Burn confirmed on Ethereum (Block 18,456,789)

⏳ Status: Attestation from Circle...
✓ Attestation received

⏳ Status: Minting on Base...
✓ Mint complete on Base

Bridge Complete! ✓
Received: 100.00 USDC (native) on Base
Time: 1m 47s

View on Ethereum: https://etherscan.io/tx/0xabc123...
View on Base: https://basescan.org/tx/0xdef456...
Wormhole Scan: https://wormholescan.io/#/tx/0xabc123...

# Token Bridge (wrapped tokens)
wormhole> bridge 0.1 ETH ethereum solana --route token
Using Wormhole Token Bridge...

Wormhole Token Bridge:
  From: Ethereum → Solana
  Amount: 0.1 ETH
  Route: Wormhole Token Bridge
  You receive: 0.1 WETH (Wormhole-wrapped)

Approve ETH? (y/n): y
Locking 0.1 ETH on Ethereum...
Transaction submitted: 0xdef456...

⏳ Status: Ethereum confirmation...
✓ ETH locked on Ethereum

⏳ Status: Wormhole guardians signing...
  Signatures: 13/19 (Quorum: 13)
✓ Quorum reached

⏳ Status: Relaying to Solana...
⏳ Status: Minting WETH on Solana...
✓ Complete

Bridge Complete! ✓
Received: 0.1 WETH on Solana
Solana Address: 7xK...mR9
Time: 14m 23s
```

**Notes**:
- CCTP is automatic for supported USDC routes
- Token Bridge creates wrapped versions (e.g., "Wormhole ETH")
- Wrapped tokens can be swapped for native on destination chain
- First-time bridging requires token approval

---

### `status [txHash]`

Check the status of a Wormhole bridge transaction.

**Syntax**:
```bash
status [txHash]
```

**Arguments**:
- `txHash` (optional) - Transaction hash from source chain

**Example**:
```bash
wormhole> status 0xabc123...
Wormhole Bridge Status:

Transaction: 0xabc123...
Route: Ethereum → Base (CCTP)
Amount: 100 USDC

Source Chain (Ethereum):
  Status: ✓ Confirmed
  Block: 18,456,789
  Timestamp: 2025-11-09 14:30:00 UTC
  Tokens: Burned

Circle Attestation:
  Status: ✓ Received
  Attestation Hash: 0x789def...
  Timestamp: 2025-11-09 14:31:15 UTC

Destination Chain (Base):
  Status: ✓ Confirmed
  Block: 5,345,678
  Timestamp: 2025-11-09 14:31:47 UTC
  Tokens: Minted
  Received: 100.00 USDC

Overall Status: Complete ✓
Total Time: 1m 47s

# Token Bridge status
wormhole> status 0xdef456...
Wormhole Bridge Status:

Transaction: 0xdef456...
Route: Ethereum → Solana (Token Bridge)
Amount: 0.1 ETH

Source Chain (Ethereum):
  Status: ✓ Confirmed
  Tokens: Locked

Wormhole Network:
  Guardian Signatures: 19/19 ✓
  VAA (Verified Action Approval): Available

Destination Chain (Solana):
  Status: ✓ Confirmed
  Tokens: Minted (WETH)
  Received: 0.1 WETH

Overall Status: Complete ✓
```

---

### `guardians`

View Wormhole guardian network status.

**Syntax**:
```bash
guardians
```

**Output**:
- Active guardians
- Network quorum
- Recent activity

**Example**:
```bash
wormhole> guardians
Wormhole Guardian Network:

Total Guardians: 19
Required Quorum: 13 (68%)
Network Status: ✓ Healthy

Recent Activity (Last Hour):
  Messages Signed: 1,247
  Average Signatures: 19/19
  Uptime: 99.98%

Guardian Set:
  1. Jump Crypto
  2. Certus One
  3. Staked
  4. Figment
  5. ChainodeTech
  ... and 14 more

Security: Multi-signature verification ensures
no single guardian can compromise the network.
```

---

## Supported Chains

Wormhole supports 30+ blockchains:

**EVM Chains**:
- Ethereum, BSC, Polygon, Avalanche
- Optimism, Arbitrum, Base
- Fantom, Celo, Moonbeam
- And more

**Non-EVM Chains**:
- Solana
- Terra Classic, Terra 2.0
- Algorand
- Near
- Aptos, Sui
- Cosmos chains (via IBC)

**Use Cases**:
- EVM ↔ EVM: Use for any token
- EVM ↔ Solana: Primary use case for Solana bridging
- Multi-hop: Bridge through multiple chains

---

## Supported Tokens

**Native vs. Wrapped**:

**CCTP Route** (Native):
- USDC only
- Native tokens on both chains
- Faster execution
- Best user experience

**Token Bridge** (Wrapped):
- All major tokens supported
- Creates wrapped versions
- Examples: WETH (Wormhole ETH), WETHet (Wormhole ETH on Solana)
- Can be swapped for native on DEXes

**Common Tokens**:
- ETH, WETH
- USDC, USDT
- WBTC
- SOL (on EVM chains as Wormhole SOL)
- And 1000s more

---

## Best Practices

### 1. Prefer CCTP for USDC

```bash
# CCTP: Native USDC, faster
wormhole> bridge 100 USDC ethereum base
Route: CCTP ⭐
You receive: Native USDC ✓

# Token Bridge: Wrapped USDC, slower
wormhole> bridge 100 USDC ethereum base --route token
Route: Token Bridge
You receive: Wormhole USDC (needs unwrapping)
```

### 2. Understand Wrapped Tokens

```bash
# Bridging ETH to Solana creates Wormhole ETH
wormhole> bridge 1 ETH ethereum solana
You receive: 1 WETHet on Solana

# Can be swapped on Solana DEXes for SOL or other tokens
# Or bridged back to Ethereum for native ETH
```

### 3. Monitor Guardian Signatures

```bash
# Check guardian status during bridge
wormhole> status 0xabc123
Guardian Signatures: 13/19 ✓ (Quorum reached)
Status: Processing...

# 13 signatures = quorum = safe to proceed
```

### 4. Account for Finality Times

```bash
# EVM → EVM: Fast (2-5 min)
wormhole> bridge 100 USDC ethereum base
Expected time: ~2 minutes ✓

# EVM → Solana: Slower (10-20 min)
wormhole> bridge 100 USDC ethereum solana
Expected time: ~15 minutes
Reason: Solana finality requirements
```

---

## CCTP vs Token Bridge

| Feature | CCTP | Token Bridge |
|---------|------|--------------|
| **Speed** | 2-3 min | 5-20 min |
| **Tokens** | USDC only | All tokens |
| **Result** | Native token | Wrapped token |
| **Fee** | $0 protocol fee | $0 protocol fee |
| **Chains** | 6 chains | 30+ chains |
| **Best For** | USDC transfers | Other tokens, non-EVM |

**Decision Guide**:
```bash
# Bridging USDC between supported chains? → Use CCTP
wormhole> bridge 100 USDC ethereum base
Auto-selected: CCTP ✓

# Bridging other tokens? → Use Token Bridge
wormhole> bridge 1 ETH ethereum solana
Route: Token Bridge (only option)

# Bridging to non-EVM? → Use Token Bridge
wormhole> bridge 100 USDC ethereum solana
Route: Token Bridge (CCTP not available)
```

---

## Error Handling

### Common Errors

**Chain Not Supported**:
```bash
wormhole> quote ethereum bitcoin BTC 1
Error: Bitcoin not supported by Wormhole Connect
Supported: EVM chains, Solana, Terra, Algorand, Near, Aptos, Sui
```

**Insufficient Finality**:
```bash
wormhole> status 0xabc123
Status: Waiting for finality...
Ethereum blocks: 8/15 confirmations

Action: Wait for sufficient block confirmations
Wormhole requires 15 confirmations for security
```

**Guardian Quorum Not Reached**:
```bash
wormhole> status 0xdef456
Status: Waiting for guardian signatures
Signatures: 11/19 (Need 13)

This is unusual. Possible causes:
- Guardian network issues
- Recent guardian set update
Action: Wait or contact Wormhole support
```

**Wrapped Token Confusion**:
```bash
# User tries to use wrapped token on Ethereum
Error: Token not recognized on destination chain
You have: Wormhole ETH (from Solana)
Try: Bridge back to Solana or swap for native ETH
```

---

## Security

**Guardian Network**:
- 19 independent validators
- 13 signature quorum (68%)
- Includes: Jump Crypto, Certus One, Staked, Figment, etc.
- $billions secured

**Best Practices**:
1. Verify transactions on Wormhole Scan
2. Understand wrapped vs native tokens
3. Wait for full finality before considering funds transferred
4. Use official Wormhole interfaces only

---

## Advanced Features

### Automatic Relaying

Wormhole automatically relays messages:
```bash
# You only pay gas on source chain
wormhole> bridge 100 USDC ethereum base
Gas (Ethereum): $2.50 ✓
Gas (Base): $0.01 (auto-relayed) ✓

# No need to claim on destination manually
```

### Manual Redeem (if needed)

If automatic relay fails:
```bash
wormhole> redeem 0xabc123
Checking VAA availability...
✓ VAA available
Submitting redeem transaction on Base...
✓ Tokens claimed
```

---

## See Also

- [Global Commands](./global-commands.md) - Core terminal commands
- [LiFi Commands](./lifi.md) - Bridge aggregator (includes Wormhole)
- [Stargate Commands](./stargate.md) - Alternative bridge
- [Bridge Tutorial](../tutorials/cross-chain-bridge.md) - Step-by-step guide
- [User Guide](../user-guide.md) - Complete interface guide

## External Resources

- [Wormhole Docs](https://docs.wormhole.com/)
- [Wormhole Scan](https://wormholescan.io/) - Transaction explorer
- [Circle CCTP](https://www.circle.com/en/cross-chain-transfer-protocol) - CCTP documentation
