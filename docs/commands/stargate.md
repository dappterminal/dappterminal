# Stargate Commands

Stargate is a cross-chain bridge protocol built on LayerZero that enables seamless transfer of stablecoins between blockchains.

## Prerequisites

- Connected wallet
- USDC or other supported stablecoins
- Native gas tokens on both source and destination chains

## Entering Stargate Context

```bash
use stargate
```

Or use commands directly with the `stargate:` prefix:
```bash
stargate:chains
```

## Commands

### `chains`

List all supported blockchain networks for Stargate bridging.

**Syntax**:
```bash
chains
```

**Output**:
- Chain ID
- Chain name
- Supported tokens
- Pool liquidity

**Example**:
```bash
stargate> chains
Stargate Supported Chains:

Chain           Chain ID    Supported Tokens         Liquidity
-----------------------------------------------------------------
Ethereum        1           USDC, USDT, ETH          $450M
Optimism        10          USDC, USDT, ETH          $45M
Arbitrum        42161       USDC, USDT, ETH          $78M
Base            8453        USDC, ETH                $23M
Polygon         137         USDC, USDT               $34M
BSC             56          USDT, BUSD               $67M
Avalanche       43114       USDC, USDT               $28M

Total Liquidity: $725M+
```

---

### `quote <fromChain> <toChain> <token> <amount>`

Get a bridge quote for transferring assets via Stargate.

**Syntax**:
```bash
quote <fromChain> <toChain> <token> <amount>
```

**Arguments**:
- `fromChain` - Source chain (ethereum, optimism, base, arbitrum, polygon, etc.)
- `toChain` - Destination chain
- `token` - Token to bridge (USDC, USDT, ETH)
- `amount` - Amount to bridge

**Example**:
```bash
stargate> quote ethereum base USDC 100
Stargate Bridge Quote:

From: Ethereum → Base
Amount: 100 USDC

Route Details:
  Protocol: Stargate (LayerZero)
  Pool: USDC Liquidity Pool
  Available Liquidity: $23.4M ✓

Fees:
  Protocol Fee: 0.06 USDC (0.06%)
  LayerZero Fee: 0.015 USDC
  Total Fee: 0.075 USDC (0.075%)

Gas Costs:
  Source Chain (Ethereum): ~$2.80
  Destination Chain (Base): Covered by protocol

You Will Receive:
  99.925 USDC on Base

Estimated Time: 3-5 minutes

Confirm quote? (y/n)
```

**Notes**:
- Quotes update in real-time based on current liquidity
- Fees are typically 0.06% for stablecoin transfers
- LayerZero handles cross-chain messaging

---

### `bridge <amount> <token> <fromChain> <toChain>`

Execute a cross-chain bridge transfer via Stargate.

**Syntax**:
```bash
bridge <amount> <token> <fromChain> <toChain>
```

**Arguments**:
- `amount` - Amount to bridge
- `token` - Token symbol (USDC, USDT, ETH)
- `fromChain` - Source chain
- `toChain` - Destination chain

**Example**:
```bash
stargate> bridge 100 USDC ethereum base

Stargate Bridge: Ethereum → Base
Amount: 100 USDC
You receive: 99.925 USDC
Fee: 0.075 USDC
Gas: ~$2.80

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
LayerZero Scan: https://layerzeroscan.com/tx/0xabc123...
```

**Notes**:
- Destination address is automatically your connected wallet
- First-time bridging requires USDC approval
- Subsequent bridges skip approval if allowance exists
- Progress tracked in real-time through LayerZero

---

### `pools [chain]`

View Stargate liquidity pool information.

**Syntax**:
```bash
pools              # All pools
pools <chain>      # Specific chain's pools
```

**Example**:
```bash
stargate> pools ethereum
Ethereum Stargate Pools:

USDC Pool:
  Total Liquidity: $234.5M
  24h Volume: $45.2M
  Pool APY: 3.45%
  Available: $234.5M ✓

USDT Pool:
  Total Liquidity: $156.8M
  24h Volume: $28.9M
  Pool APY: 2.98%
  Available: $156.8M ✓

ETH Pool:
  Total Liquidity: $89.3M
  24h Volume: $12.4M
  Pool APY: 1.87%
  Available: $89.3M ✓
```

---

### `status [txHash]`

Check the status of a Stargate bridge transaction.

**Syntax**:
```bash
status [txHash]
```

**Arguments**:
- `txHash` (optional) - Transaction hash (uses last if omitted)

**Example**:
```bash
stargate> status 0xabc123...
Stargate Bridge Status:

Transaction: 0xabc123...
Route: Ethereum → Base
Amount: 100 USDC

Source Chain (Ethereum):
  Status: ✓ Confirmed
  Block: 18,456,789
  Timestamp: 2025-11-09 10:30:45 UTC

LayerZero:
  Status: ✓ Message Delivered
  Confirmations: 15/15
  Relayer: LayerZero Relayer

Destination Chain (Base):
  Status: ✓ Confirmed
  Block: 5,234,567
  Received: 99.925 USDC
  Timestamp: 2025-11-09 10:33:12 UTC

Overall Status: Complete ✓
Total Time: 2m 27s

# Check last transaction
stargate> status
Checking last bridge transaction...
```

---

## Supported Tokens

Stargate specializes in stablecoin and ETH bridging:

**Primary Tokens**:
- **USDC** - Most widely supported, best liquidity
- **USDT** - Available on most chains
- **ETH** - Native ETH bridging

**Chain-Specific Tokens**:
- **BUSD** - BSC
- **MAI** - Polygon
- **FRAX** - Selected chains

Check `chains` command for token availability per network.

---

## Supported Chains

**EVM Chains**:
- Ethereum (Mainnet)
- Optimism
- Arbitrum
- Base
- Polygon
- BSC (Binance Smart Chain)
- Avalanche
- Fantom
- Metis

**Total**: 15+ chains and growing

---

## Best Practices

### 1. Check Liquidity Before Large Transfers

```bash
stargate> pools base
Base USDC Pool: $23.4M available ✓

# Good: Amount is well below liquidity
stargate> bridge 1000 USDC ethereum base

# Caution: Large relative to pool
stargate> bridge 10000000 USDC ethereum base
Warning: This is a large transfer relative to pool size
May experience higher slippage
```

### 2. Monitor Gas Prices

```bash
# Check gas on source chain first
> use 1inch
1inch> gas
Current Gas: 15 GWEI (Standard)

# Then execute bridge
> use stargate
stargate> bridge 100 USDC ethereum base
Gas cost: ~$2.80 ✓
```

### 3. Use for Stablecoins

Stargate is optimized for stablecoins:

```bash
# Excellent for stablecoins
stargate> bridge 1000 USDC ethereum base
Fee: 0.06% ✓ Very low

# For other tokens, consider alternatives
# (LiFi aggregator might find better routes)
```

### 4. Verify Destination Chain Gas

```bash
# Ensure you have gas on destination chain
# Switch network to check
stargate> bridge 100 USDC ethereum base

# After bridge, you'll need ETH on Base to use USDC
# Bridge some ETH first if needed
stargate> bridge 0.05 ETH ethereum base
```

---

## LayerZero Integration

Stargate uses LayerZero for cross-chain messaging:

**Benefits**:
- **Security**: 20+ confirmations on source chain
- **Speed**: 3-5 minute average transfer time
- **Reliability**: Proven track record with $billions bridged
- **Transparency**: Full transaction tracking on LayerZero Scan

**Tracking**:
```bash
# Every bridge provides LayerZero tracking link
LayerZero Scan: https://layerzeroscan.com/tx/0xabc123...

# View detailed cross-chain message flow
# See relayer activity
# Confirm delivery status
```

---

## Fee Structure

**Protocol Fees**:
- **Stablecoins**: ~0.06% per transfer
- **ETH**: ~0.1% per transfer
- **Minimum**: Usually $0.01 worth

**LayerZero Fees**:
- **Message Fee**: ~$0.01-0.05 (varies by chain)
- **Covers**: Cross-chain message relay and delivery

**Gas Fees**:
- **Source Chain**: Paid by you in native token
- **Destination Chain**: Covered by protocol

**Total Cost Example**:
```bash
Bridge 100 USDC (Ethereum → Base):
  Protocol Fee: $0.06
  LayerZero Fee: $0.015
  Gas (Ethereum): $2.80
  Total Cost: $2.875

You Receive: $99.925 USDC
Effective Fee: 0.075% + gas
```

---

## Error Handling

### Common Errors

**Insufficient Liquidity**:
```bash
stargate> bridge 50000000 USDC ethereum base
Error: Insufficient pool liquidity
Available: $23.4M USDC
Requested: $50M USDC
Try: Smaller amount or use LiFi for route aggregation
```

**Chain Not Supported**:
```bash
stargate> quote ethereum solana USDC 100
Error: Solana not supported by Stargate
Supported: Ethereum, Optimism, Arbitrum, Base, Polygon, BSC, Avalanche
Try: Use Wormhole plugin for Solana bridging
```

**Slippage Exceeded**:
```bash
stargate> bridge 1000 USDC ethereum base
Error: Pool liquidity changed, slippage exceeded
Try: Get new quote
stargate> quote ethereum base USDC 1000
```

**Transaction Stuck**:
```bash
stargate> status 0xabc123
Status: Pending on LayerZero (30+ minutes)

This is unusual. Possible causes:
- Network congestion
- Relayer issues
- RPC problems

Action: Contact Stargate support with transaction hash
```

---

## Advantages of Stargate

1. **Low Fees**: Typically 0.06% for stablecoins
2. **Fast**: 3-5 minute average transfers
3. **Secure**: LayerZero's proven security model
4. **Deep Liquidity**: $700M+ in pools
5. **Unified Liquidity**: Shared pools across chains
6. **Instant Finality**: No need to wait for external validators

---

## See Also

- [Global Commands](./global-commands.md) - Core terminal commands
- [LiFi Commands](./lifi.md) - Bridge aggregator
- [Wormhole Commands](./wormhole.md) - Alternative bridge
- [Bridge Tutorial](../tutorials/cross-chain-bridge.md) - Step-by-step guide
- [User Guide](../user-guide.md) - Complete interface guide
