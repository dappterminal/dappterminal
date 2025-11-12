# Tutorial: Cross-Chain Bridging

This tutorial will guide you through bridging assets between different blockchains using DappTerminal's bridge protocols (LiFi, Stargate, and Wormhole).

## What You'll Learn

- How to choose the right bridge protocol
- How to get bridge quotes
- How to execute cross-chain transfers
- How to track bridge transactions

## Prerequisites

- Connected wallet with assets to bridge
- Native gas tokens on **both** source and destination chains
- Understanding of cross-chain bridge risks

## Choosing a Bridge Protocol

DappTerminal supports three bridge protocols:

| Protocol | Best For | Speed | Chains |
|----------|----------|-------|--------|
| **LiFi** | Best rates (aggregator) | Varies | 40+ |
| **Stargate** | USDC/stablecoins | Fast (3-5 min) | 15+ |
| **Wormhole** | USDC via CCTP, Solana | Fast (2-15 min) | 30+ |

**Quick Decision Guide**:
- Bridging USDC? → **Stargate** or **Wormhole CCTP**
- To/from Solana? → **Wormhole**
- Want best rate? → **LiFi** (compares all)
- Other tokens? → **LiFi**

## Example 1: Bridge USDC (Ethereum → Base) with Stargate

This is the most common use case - bridging stablecoins between EVM chains.

### Step 1: Check Your Balance

```bash
> balance USDC
Balance: 1,000 USDC
```

### Step 2: Enter Stargate Context

```bash
> use stargate
Switched to stargate protocol
```

### Step 3: Get a Quote

```bash
stargate> quote ethereum base USDC 100
Stargate Bridge Quote:

From: Ethereum → Base
Amount: 100 USDC

Fees:
  Protocol Fee: 0.06 USDC (0.06%)
  LayerZero Fee: 0.015 USDC
  Total Fee: 0.075 USDC (0.075%)

Gas Costs:
  Source Chain (Ethereum): ~$2.80
  Destination Chain (Base): Covered

You Will Receive: 99.925 USDC on Base
Estimated Time: 3-5 minutes

Confirm quote? (y/n)
```

### Step 4: Execute the Bridge

```bash
Confirm quote? (y/n): y

Approve USDC for bridging? (y/n): y
Approving USDC...
✓ Approval confirmed

Executing bridge...
Transaction submitted: 0xabc123...

⏳ Step 1/3: Transaction confirmed on Ethereum
   Block: 18,456,789
   ✓ Complete

⏳ Step 2/3: LayerZero message relay
   Relaying cross-chain message...
   ✓ Message delivered

⏳ Step 3/3: Executing on Base
   Minting 99.925 USDC...
   ✓ Complete

Bridge Complete! ✓
Received: 99.925 USDC on Base
Time: 3m 12s

View on Ethereum: https://etherscan.io/tx/0xabc123...
View on Base: https://basescan.org/tx/0xdef456...
```

### Step 5: Verify on Destination Chain

Switch your wallet network to Base and check:

```bash
stargate> exit
# Switch wallet to Base network
> balance USDC
Balance: 99.925 USDC ✓
```

Success! You've bridged USDC from Ethereum to Base.

## Example 2: Bridge Using LiFi (Best Rates)

LiFi aggregates multiple bridge protocols to find you the best route.

### Step 1: Enter LiFi Context

```bash
> use lifi
Switched to lifi protocol
```

### Step 2: Compare Multiple Routes

```bash
lifi> quote ethereum base USDC 100
Finding best routes from Ethereum to Base for 100 USDC...

Route 1 (Fastest): ⭐ Recommended
  Protocol: Circle CCTP
  Time: ~3 minutes
  Fee: 0.10 USDC (0.1%)
  You receive: 99.90 USDC
  Gas cost: ~$2.50

Route 2 (Cheapest):
  Protocol: Stargate
  Time: ~5 minutes
  Fee: 0.075 USDC (0.075%)
  You receive: 99.925 USDC
  Gas cost: ~$2.80

Route 3:
  Protocol: Across
  Time: ~10 minutes
  Fee: 0.15 USDC (0.15%)
  You receive: 99.85 USDC
  Gas cost: ~$2.00

Select route (1-3) or 'cancel':
```

### Step 3: Choose and Execute

```bash
Select route (1-3) or 'cancel': 2

Using Stargate route...
Executing bridge...
# ... (similar to Stargate example above)
```

**Pro Tip**: LiFi automatically finds the best route. You can always accept the recommended route (usually #1).

## Example 3: Bridge to Solana with Wormhole

Bridging from EVM chains to Solana requires Wormhole.

### Step 1: Enter Wormhole Context

```bash
> use wormhole
Switched to wormhole protocol
```

### Step 2: Get Cross-VM Quote

```bash
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

**Important**: Note that you receive "Wormhole-wrapped" USDC on Solana, not native USDC.

### Step 3: Execute Cross-VM Bridge

```bash
Confirm quote? (y/n): y

Approve USDC? (y/n): y
Locking 100 USDC on Ethereum...
Transaction submitted: 0xdef456...

⏳ Status: Ethereum confirmation...
✓ USDC locked on Ethereum

⏳ Status: Wormhole guardians signing...
  Signatures: 13/19 (Quorum: 13)
✓ Quorum reached

⏳ Status: Relaying to Solana...
⏳ Status: Minting USDC on Solana...
✓ Complete

Bridge Complete! ✓
Received: 100.00 USDCet on Solana
Solana Address: 7xK...mR9
Time: 14m 23s

Wormhole Scan: https://wormholescan.io/#/tx/0xdef456...
```

### Step 4: Use Wrapped Tokens

On Solana, you can:
- Use wrapped USDC directly in Solana DeFi protocols
- Swap for native USDC or SOL on Solana DEXes (Jupiter, etc.)
- Bridge back to Ethereum for native USDC

## Tracking Bridge Transactions

All bridge protocols provide transaction tracking.

### Check Status During Bridge

```bash
lifi> status
Bridge Transaction Status:

Source Chain (Ethereum):
  ✓ Confirmed

Cross-Chain Status:
  ⏳ Processing...

Destination Chain (Base):
  ⏳ Pending...

Status: In Progress
Estimated completion: 2 minutes
```

### Check Status After Bridge

```bash
stargate> status 0xabc123...
Stargate Bridge Status:

Transaction: 0xabc123...
Overall Status: Complete ✓
Total Time: 3m 12s

View details on LayerZero Scan
```

## Important Considerations

### 1. Ensure Gas on Destination Chain

Before bridging, make sure you have native gas on the destination chain:

```bash
# Bad: Bridge all your ETH from Base to Arbitrum
# You'll have no ETH on Base to do anything!

# Good: Bridge some ETH first, then bridge other tokens
lifi> bridge 0.1 ETH ethereum base
# Wait for completion
lifi> bridge 1000 USDC ethereum base
```

### 2. Understand Token Types

- **Native tokens**: Original tokens (e.g., USDC on Ethereum)
- **Wrapped tokens**: Bridged versions (e.g., Wormhole USDC on Solana)

**CCTP bridges** (Circle's protocol) provide native tokens:
```bash
wormhole> bridge 100 USDC ethereum base
Route: CCTP ✓
You receive: Native USDC on Base
```

**Token bridges** create wrapped versions:
```bash
wormhole> bridge 1 ETH ethereum solana
You receive: Wormhole ETH on Solana (wrapped)
```

### 3. Bridge Times Vary

- **EVM → EVM**: 2-5 minutes (CCTP, Stargate)
- **EVM → EVM** (Token Bridge): 5-15 minutes
- **EVM → Solana**: 10-20 minutes (longer finality)
- **Multi-step routes**: Add 5-10 minutes per step

### 4. Fees Add Up

```bash
# Small bridge - fees are high %
Bridge: $50 USDC
Fee: $0.05
Gas: $2.80
Total cost: $2.85 (5.7% of amount) ❌ Expensive!

# Larger bridge - fees are low %
Bridge: $5,000 USDC
Fee: $2.50
Gas: $2.80
Total cost: $5.30 (0.1% of amount) ✓ Reasonable
```

**Recommendation**: Bridge larger amounts less frequently.

## Troubleshooting

### Bridge Taking Too Long

```bash
lifi> status
Status: Pending for 30+ minutes ⚠️

Possible causes:
- Network congestion
- Relayer issues
- RPC problems
```

**Solutions**:
1. Check Wormhole Scan or LayerZero Scan for details
2. Verify source transaction confirmed on block explorer
3. Contact bridge protocol support if stuck >1 hour

### "Insufficient Liquidity" Error

```bash
stargate> bridge 10000000 USDC ethereum base
Error: Insufficient pool liquidity
Available: $23.4M USDC
Requested: $10M USDC
```

**Solutions**:
- Bridge smaller amounts
- Use LiFi to find alternative routes
- Wait for liquidity to replenish

### Wrong Token Received

```bash
# Bridged USDC but received wrapped version
Expected: Native USDC
Received: Wormhole USDC
```

**Solution**:
- Use CCTP routes for native tokens
- Or swap wrapped tokens for native on destination DEX

## Best Practices Summary

1. **Compare Routes**: Use LiFi to see all options
2. **Check Liquidity**: Large bridges need deep pools
3. **Ensure Destination Gas**: Bridge native tokens first
4. **Mind the Fees**: Don't bridge tiny amounts
5. **Understand Token Types**: Native vs wrapped
6. **Track Transactions**: Use status commands
7. **Be Patient**: Cross-chain takes time
8. **Test First**: Try small amount first time

## Quick Reference

```bash
# LiFi (Aggregator - Best rates)
use lifi
quote <fromChain> <toChain> <token> <amount>
bridge <amount> <token> <fromChain> <toChain>
status [txHash]

# Stargate (Fast stablecoins)
use stargate
quote <fromChain> <toChain> <token> <amount>
bridge <amount> <token> <fromChain> <toChain>
chains

# Wormhole (CCTP + Solana)
use wormhole
quote <fromChain> <toChain> <token> <amount>
bridge <amount> <token> <fromChain> <toChain>
routes
```

## Next Steps

- **[LiFi Commands](../commands/lifi.md)** - Full LiFi reference
- **[Stargate Commands](../commands/stargate.md)** - Stargate details
- **[Wormhole Commands](../commands/wormhole.md)** - Wormhole guide
- **[Supported Networks](../networks.md)** - All available chains

Happy bridging!
