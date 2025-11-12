# 1inch Commands

1inch is a DEX aggregator that finds the best swap rates across multiple decentralized exchanges.

## Prerequisites

- Connected wallet
- 1inch API key configured in `.env.local`
- Sufficient token balance for swaps

## Entering 1inch Context

```bash
use 1inch
```

Or use commands directly with the `1inch:` prefix:
```bash
1inch:price ETH
```

## Commands

### `price <token>`

Get the current price of a token.

**Syntax**:
```bash
price <token>
```

**Arguments**:
- `token` - Token symbol (e.g., `ETH`, `USDC`) or contract address

**Output**:
- Current USD price
- 24-hour price change
- Price source

**Example**:
```bash
1inch> price ETH
ETH: $3,456.78
24h Change: +2.34%
Source: 1inch Price API

1inch> price USDC
USDC: $1.0001
24h Change: +0.01%
```

**Direct Call**:
```bash
> 1inch:price BTC
BTC: $65,432.10 (24h: -1.23%)
```

---

### `gas`

Get current gas prices for transactions.

**Syntax**:
```bash
gas
```

**Output**:
- Slow gas price (GWEI)
- Standard gas price (GWEI)
- Fast gas price (GWEI)
- Current base fee
- Priority fee

**Example**:
```bash
1inch> gas
Current Gas Prices:
  Slow:     12 GWEI (~5 min)
  Standard: 15 GWEI (~2 min)
  Fast:     20 GWEI (~30 sec)
Base Fee: 10 GWEI
Priority: 2 GWEI
```

**Use Case**: Check gas prices before executing swaps to optimize costs.

---

### `swap <amount> <fromToken> <toToken> [options]`

Execute a token swap with best rates from multiple DEXes.

**Syntax**:
```bash
swap <amount> <from> <to> [--slippage <percentage>] [--gas <speed>]
```

**Arguments**:
- `amount` - Amount to swap (e.g., `0.1`, `100`)
- `from` - Source token symbol or address
- `to` - Destination token symbol or address

**Options**:
- `--slippage <percentage>` - Max slippage tolerance (default: 1%)
- `--gas <speed>` - Gas speed: `slow`, `standard`, `fast` (default: standard)

**Example**:
```bash
# Basic swap
1inch> swap 0.1 ETH USDC
Quote:
  From: 0.1 ETH
  To: 345.67 USDC
  Rate: 1 ETH = 3,456.70 USDC
  Price Impact: 0.05%
  Gas Cost: ~0.002 ETH ($6.91)
  Route: Uniswap V3 (60%) + Curve (40%)
Confirm? (y/n): y
Approve ETH spending? (y/n): y
Transaction submitted: 0xabc123...
Status: Pending...
Success! 345.67 USDC received
View on Etherscan: https://etherscan.io/tx/0xabc123...

# Swap with custom slippage
1inch> swap 100 USDC ETH --slippage 0.5
Quote:
  From: 100 USDC
  To: 0.0289 ETH
  Rate: 1 ETH = 3,458.21 USDC
  Max Slippage: 0.5%
  Min Received: 0.0288 ETH
Confirm? (y/n): y

# Swap with fast gas
1inch> swap 50 DAI USDC --gas fast
Using fast gas (20 GWEI)
```

**Notes**:
- Swaps may require token approval before execution
- Price updates in real-time during confirmation
- Slippage protects against price movement
- 1inch aggregates rates from: Uniswap, Curve, Balancer, SushiSwap, and more

---

### `limitorder <amount> <fromToken> <toToken> --rate <price> [options]`

Create a limit order to swap tokens at a specific rate.

**Syntax**:
```bash
limitorder <amount> <from> <to> --rate <price> [--expiry <time>]
```

**Arguments**:
- `amount` - Amount to sell
- `from` - Token to sell
- `to` - Token to buy
- `--rate <price>` - Desired exchange rate

**Options**:
- `--expiry <time>` - Order expiration time (default: 7 days)
  - Format: `1h`, `1d`, `7d`, or timestamp

**Example**:
```bash
# Create limit order
1inch> limitorder 1 ETH USDC --rate 3500
Limit Order Created:
  Sell: 1 ETH
  Buy: 3,500 USDC
  Rate: 1 ETH = 3,500 USDC
  Current Rate: 1 ETH = 3,456.70 USDC
  Expires: 2025-11-16 12:00:00 UTC
  Order ID: 0xdef456...

Order will execute when ETH reaches $3,500

# Order with custom expiry
1inch> limitorder 0.5 ETH USDC --rate 3600 --expiry 24h
Limit order expires in 24 hours

# Check order status
1inch> orders
Active Limit Orders:
1. 1 ETH → 3,500 USDC (Pending, expires in 6d 23h)
2. 0.5 ETH → 3,600 USDC (Pending, expires in 23h)
```

**Notes**:
- Limit orders are off-chain until executed
- No gas fees until order is filled
- Orders can be cancelled at any time
- Automatically executes when price target is reached

---

### `eth_rpc <method> [params]`

Execute raw Ethereum RPC calls through 1inch infrastructure.

**Syntax**:
```bash
eth_rpc <method> [param1] [param2] ...
```

**Arguments**:
- `method` - Ethereum JSON-RPC method name
- `params` - Method parameters (optional)

**Common Methods**:
- `eth_blockNumber` - Get latest block number
- `eth_getBalance <address>` - Get address balance
- `eth_getTransactionByHash <hash>` - Get transaction details
- `eth_call <data>` - Call contract method

**Example**:
```bash
# Get latest block
1inch> eth_rpc eth_blockNumber
Latest Block: 18,456,789

# Get address balance
1inch> eth_rpc eth_getBalance 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
Balance: 12.456 ETH

# Get transaction
1inch> eth_rpc eth_getTransactionByHash 0xabc123...
Transaction Details:
  From: 0x742d35...
  To: 0x1234ab...
  Value: 0.1 ETH
  Gas: 21000
  Status: Success
```

**Use Cases**:
- Debug transactions
- Query contract state
- Check balances
- Verify transaction status

---

## Token Resolver

1inch has built-in support for 10,000+ tokens via dynamic resolution:

**Supported Tokens**:
- All major tokens (ETH, WETH, USDC, USDT, DAI, WBTC, etc.)
- DeFi tokens (UNI, AAVE, COMP, MKR, etc.)
- Stablecoins (USDC, USDT, DAI, FRAX, etc.)
- Wrapped tokens (WETH, WBTC, wstETH, etc.)

**Token Formats**:
```bash
# By symbol
price ETH

# By contract address
price 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48

# Case insensitive
price usdc
price USDC
```

If a token is not found, the command will suggest similar tokens or prompt you to use the contract address.

---

## Multi-Chain Support

1inch supports multiple networks. Switch networks in your wallet or use the network selector.

**Supported Networks**:
- Ethereum
- Optimism
- Arbitrum
- Polygon
- BSC (Binance Smart Chain)
- Avalanche
- Base

Commands automatically use the active network from your wallet.

---

## Best Practices

### 1. Check Gas Before Swapping

```bash
1inch> gas
# Wait for lower gas if possible
1inch> swap 0.1 ETH USDC
```

### 2. Monitor Price Charts

```bash
> chart ETH
> use 1inch
1inch> price ETH
1inch> swap 0.1 ETH USDC
# Watch chart while executing
```

### 3. Use Limit Orders for Better Rates

```bash
# Current: 1 ETH = $3,450
# Target: 1 ETH = $3,500
1inch> limitorder 1 ETH USDC --rate 3500
# Order executes automatically when price hits $3,500
```

### 4. Set Appropriate Slippage

- **Stablecoins**: 0.1% - 0.5%
- **Major tokens**: 0.5% - 1%
- **Volatile tokens**: 1% - 3%
- **Low liquidity**: 3% - 5%

```bash
# Low slippage for stablecoins
1inch> swap 1000 USDC USDT --slippage 0.1

# Higher slippage for volatile tokens
1inch> swap 100 SHIB DOGE --slippage 3
```

---

## Error Handling

### Common Errors

**Insufficient Balance**:
```bash
1inch> swap 10 ETH USDC
Error: Insufficient ETH balance
Current balance: 1.5 ETH
Required: 10 ETH
```

**Token Not Approved**:
```bash
1inch> swap 100 USDC ETH
USDC spending not approved
Approve USDC? (y/n): y
Approving USDC...
Approved! You can now swap.
```

**Slippage Exceeded**:
```bash
1inch> swap 0.1 ETH USDC --slippage 0.1
Error: Price moved beyond slippage tolerance
Expected: 345.67 USDC
Current: 344.32 USDC
Try again with higher slippage or wait for price stability
```

**API Rate Limit**:
```bash
1inch> price ETH
Error: Rate limit exceeded
Wait: 30 seconds
Or upgrade to higher tier API key
```

---

## See Also

- [Global Commands](./global-commands.md) - Core terminal commands
- [Aave V3 Commands](./aave-v3.md) - Lending protocol
- [LiFi Commands](./lifi.md) - Cross-chain bridging
- [User Guide](../user-guide.md) - Complete interface guide
- [Swap Tutorial](../tutorials/swapping-tokens.md) - Step-by-step swap guide
