# LiFi Commands

LiFi is a cross-chain bridge aggregator that finds the best routes for bridging assets between different blockchains.

## Prerequisites

- Connected wallet
- LiFi API key configured in `.env.local`
- Assets to bridge
- Native gas tokens on both source and destination chains

## Entering LiFi Context

```bash
use lifi
```

Or use commands directly with the `lifi:` prefix:
```bash
lifi:chains
```

## Commands

### `health`

Check LiFi API connectivity and service status.

**Syntax**:
```bash
health
```

**Output**:
- API connection status
- Service health
- Supported chains count
- API version

**Example**:
```bash
lifi> health
LiFi Service Status:
✓ API: Connected
✓ Routes: Available
✓ Chains: 40+ supported
✓ Version: 3.12.14

Status: All systems operational
```

---

### `chains`

List all supported blockchain networks.

**Syntax**:
```bash
chains
```

**Output**:
- Chain ID
- Chain name
- Native token
- RPC status

**Example**:
```bash
lifi> chains
Supported Chains:

ID    Name                 Native Token    Status
-----------------------------------------------------
1     Ethereum            ETH              ✓
10    Optimism            ETH              ✓
42161 Arbitrum            ETH              ✓
8453  Base                ETH              ✓
137   Polygon             MATIC            ✓
56    BSC                 BNB              ✓
43114 Avalanche           AVAX             ✓
100   Gnosis              xDAI             ✓
250   Fantom              FTM              ✓
8217  Klaytn              KLAY             ✓

... and 30+ more chains
```

---

### `quote <fromChain> <toChain> <token> <amount>`

Get a bridge quote for transferring assets cross-chain.

**Syntax**:
```bash
quote <fromChain> <toChain> <token> <amount>
```

**Arguments**:
- `fromChain` - Source chain (ethereum, optimism, base, etc.)
- `toChain` - Destination chain
- `token` - Token symbol to bridge (USDC, ETH, USDT, etc.)
- `amount` - Amount to bridge

**Example**:
```bash
lifi> quote ethereum base USDC 100
Finding best routes from Ethereum to Base for 100 USDC...

Route 1 (Fastest): ⭐ Recommended
  Protocol: Circle CCTP
  Time: ~3 minutes
  Fee: 0.10 USDC (0.1%)
  You receive: 99.90 USDC
  Gas cost: ~$2.50 (ETH)
  Steps: 1

Route 2 (Cheapest):
  Protocol: Stargate
  Time: ~5 minutes
  Fee: 0.05 USDC (0.05%)
  You receive: 99.95 USDC
  Gas cost: ~$3.00 (ETH)
  Steps: 1

Route 3:
  Protocol: Across
  Time: ~10 minutes
  Fee: 0.15 USDC (0.15%)
  You receive: 99.85 USDC
  Gas cost: ~$2.00 (ETH)
  Steps: 1

Select route (1-3) or 'cancel': 1
```

**Notes**:
- LiFi aggregates multiple bridge protocols
- Shows time, fees, and gas costs for comparison
- Automatically selects optimal route if not specified

---

### `routes`

List all available bridge routes and protocols.

**Syntax**:
```bash
routes
```

**Output**:
- Available protocols
- Supported tokens per protocol
- Route capabilities

**Example**:
```bash
lifi> routes
Available Bridge Protocols:

Circle CCTP:
  Tokens: USDC
  Chains: Ethereum, Optimism, Arbitrum, Base, Polygon, Avalanche
  Speed: Fast (3-5 min)

Stargate:
  Tokens: USDC, USDT, ETH
  Chains: 10+ EVM chains
  Speed: Medium (5-15 min)

Across:
  Tokens: ETH, WETH, USDC, DAI
  Chains: Ethereum, Optimism, Arbitrum, Polygon, Base
  Speed: Medium (10-20 min)

Hop Protocol:
  Tokens: ETH, USDC, USDT, DAI
  Chains: Ethereum, Optimism, Arbitrum, Polygon
  Speed: Fast (5-10 min)

... and 10+ more protocols
```

---

### `bridge <amount> <token> <fromChain> <toChain> [--route <id>]`

Execute a cross-chain bridge transfer.

**Syntax**:
```bash
bridge <amount> <token> <fromChain> <toChain> [--route <id>]
```

**Arguments**:
- `amount` - Amount to bridge
- `token` - Token symbol
- `fromChain` - Source chain
- `toChain` - Destination chain

**Options**:
- `--route <id>` - Specific route ID (from quote)

**Example**:
```bash
lifi> bridge 100 USDC ethereum base
Finding best route...

Selected Route:
  From: Ethereum
  To: Base
  Amount: 100 USDC
  Protocol: Circle CCTP
  Fee: 0.10 USDC
  Gas: ~$2.50
  Time: ~3 minutes
  You receive: 99.90 USDC

Confirm bridge? (y/n): y

Step 1/1: Approve USDC
Approve 100 USDC for bridging? (y/n): y
Approving...
✓ Approved

Step 1/1: Execute Bridge
Executing bridge transaction...
Transaction submitted: 0xabc123...

Status: Pending...
⏳ Waiting for confirmation on Ethereum...
✓ Confirmed on Ethereum (Block 18,456,789)

⏳ Processing cross-chain message...
⏳ Minting on Base...
✓ Completed! 99.90 USDC received on Base

Transaction Hash (Ethereum): 0xabc123...
Transaction Hash (Base): 0xdef456...
View on Explorer: https://etherscan.io/tx/0xabc123...

# Bridge with specific route
lifi> bridge 50 USDC ethereum optimism --route cctp
Using Circle CCTP route...
```

**Notes**:
- Multi-step bridges show progress for each step
- Transactions may require approval first
- Gas is paid on source chain
- Destination address is your connected wallet

---

### `execute`

Execute a previously selected bridge route.

**Syntax**:
```bash
execute
```

**Example**:
```bash
# After getting a quote
lifi> quote ethereum base USDC 100
# ... routes shown ...

lifi> execute
Executing selected route (Circle CCTP)...
```

---

### `prepare-step <index>`

Get transaction data for a specific step in a multi-step route.

**Syntax**:
```bash
prepare-step <index>
```

**Arguments**:
- `index` - Step number (1, 2, 3, etc.)

**Example**:
```bash
# For complex multi-step bridges
lifi> quote ethereum polygon DAI 1000
Route has 2 steps:
  1. Swap DAI to USDC (Ethereum)
  2. Bridge USDC to Polygon

lifi> prepare-step 1
Step 1 Transaction Data:
  To: 0x1234...
  Data: 0xabcd...
  Value: 0
  Gas: 150,000

lifi> prepare-step 2
Step 2 Transaction Data:
  ...
```

---

### `status [txHash]`

Check the status of a bridge transaction.

**Syntax**:
```bash
status [txHash]
```

**Arguments**:
- `txHash` (optional) - Transaction hash (uses last transaction if omitted)

**Example**:
```bash
lifi> status 0xabc123...
Bridge Transaction Status:

Source Chain (Ethereum):
  ✓ Confirmed (Block 18,456,789)
  ✓ Transaction successful
  ✓ Tokens burned/locked

Cross-Chain Status:
  ✓ Message relayed
  ✓ Proof validated

Destination Chain (Base):
  ✓ Confirmed (Block 5,123,456)
  ✓ Tokens minted
  ✓ Transfer complete

Status: Completed ✓
Amount: 99.90 USDC received
Time elapsed: 2m 45s

# Check last transaction
lifi> status
Checking last bridge transaction...
```

---

## Supported Tokens

LiFi supports bridging of major tokens across chains:

**Stablecoins**:
- USDC (most chains via CCTP)
- USDT
- DAI
- FRAX

**Native/Wrapped Tokens**:
- ETH
- WETH
- WBTC
- MATIC
- BNB

**DeFi Tokens**:
- UNI
- AAVE
- LINK
- And many more

Token availability varies by chain. Use `quote` to check if a specific route is supported.

---

## Supported Chains

**EVM Chains** (40+):
- Ethereum, Optimism, Arbitrum, Base, Polygon
- BSC, Avalanche, Fantom, Gnosis
- zkSync Era, Polygon zkEVM
- And more

**Non-EVM Chains** (via specific bridges):
- Solana (via Wormhole)
- Cosmos chains (via IBC)

---

## Best Practices

### 1. Compare Routes Before Bridging

```bash
# Always check multiple routes
lifi> quote ethereum base USDC 100
# Review all options for best rate and speed
```

### 2. Consider Time vs. Cost Trade-offs

```bash
# Fast but higher fee
Route 1: 3 min, $2.50 fee

# Slower but cheaper
Route 2: 10 min, $1.00 fee

# Choose based on urgency
```

### 3. Ensure Gas on Both Chains

```bash
# Check gas on source chain (for bridge tx)
> balance
Balance: 0.5 ETH ✓

# Ensure gas on destination chain (for using bridged tokens)
# Bridge some native tokens first if needed
lifi> bridge 0.1 ETH ethereum base
```

### 4. Monitor Bridge Status

```bash
# Large bridges may take time
lifi> bridge 10000 USDC ethereum polygon
# ... transaction submitted ...

# Check status periodically
lifi> status
Status: Processing... (Step 1/2)

# Wait for completion
lifi> status
Status: Completed ✓
```

---

## Multi-Step Bridges

Some routes require multiple steps (swap + bridge):

```bash
lifi> quote ethereum polygon DAI 1000

Multi-Step Route:
Step 1: Swap DAI → USDC on Ethereum (Uniswap)
  1000 DAI → 999.50 USDC
  Fee: 0.3%
  Gas: $1.50

Step 2: Bridge USDC to Polygon (Circle CCTP)
  999.50 USDC → 999.00 USDC
  Fee: 0.1%
  Gas: $2.00

Total Time: ~5 minutes
Total Received: 999.00 USDC on Polygon

Confirm multi-step route? (y/n): y
```

---

## Error Handling

### Common Errors

**Insufficient Liquidity**:
```bash
lifi> bridge 1000000 USDC ethereum base
Error: Insufficient liquidity for this route
Max amount: 500,000 USDC
Try smaller amount or different route
```

**Chain Not Supported**:
```bash
lifi> quote ethereum solana USDC 100
Error: Direct route not available
Suggested: Use Wormhole plugin for Solana bridges
```

**Token Not Supported**:
```bash
lifi> quote ethereum base SHIB 1000
Error: SHIB bridging not available on this route
Supported tokens: USDC, USDT, ETH, WETH
```

**Bridge Transaction Failed**:
```bash
lifi> status 0xabc123
Status: Failed ✗
Error: Transaction reverted on source chain
Reason: Slippage exceeded

Your funds are safe. No tokens were bridged.
Try again with updated quote.
```

---

## See Also

- [Global Commands](./global-commands.md) - Core terminal commands
- [Stargate Commands](./stargate.md) - Specific Stargate bridging
- [Wormhole Commands](./wormhole.md) - Specific Wormhole bridging
- [Bridge Tutorial](../tutorials/cross-chain-bridge.md) - Step-by-step guide
- [User Guide](../user-guide.md) - Complete interface guide
