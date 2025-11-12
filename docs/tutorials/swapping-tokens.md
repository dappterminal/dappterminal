# Tutorial: Swapping Tokens

This tutorial will walk you through executing a token swap on DappTerminal using the 1inch protocol.

## What You'll Learn

- How to check token prices
- How to get a swap quote
- How to execute a token swap
- How to monitor your swap with charts

## Prerequisites

- Connected wallet with ETH for gas
- Tokens to swap (we'll use ETH → USDC in this example)
- 1inch API key configured

## Step 1: Check Your Balance

First, verify you have sufficient tokens to swap:

```bash
> balance
Balance: 1.5 ETH
```

If you need ETH, you'll need to acquire some first through an exchange or other means.

## Step 2: Check Token Price

Before swapping, check the current market price:

```bash
> price ETH
ETH: $3,456.78
24h Change: +2.34%
```

You can also check the destination token price:

```bash
> price USDC
USDC: $1.0001
24h Change: +0.01%
```

## Step 3: Add Price Chart (Optional)

Monitor price movements while swapping:

```bash
> chart ETH
Added ETH chart to analytics panel
```

The chart will appear on the right side of your terminal, showing real-time price data.

## Step 4: Enter 1inch Protocol Context

Enter the 1inch protocol to access swap functionality:

```bash
> use 1inch
Switched to 1inch protocol
```

Your prompt should now show `1inch>` indicating you're in the 1inch context.

## Step 5: Check Gas Prices

Before swapping, check current gas prices to optimize costs:

```bash
1inch> gas
Current Gas Prices:
  Slow:     12 GWEI (~5 min)
  Standard: 15 GWEI (~2 min)
  Fast:     20 GWEI (~30 sec)
```

If gas is high, you might want to wait. If it's reasonable, proceed to the next step.

## Step 6: Get a Swap Quote

Get a quote for your swap:

```bash
1inch> swap 0.1 ETH USDC
Quote:
  From: 0.1 ETH
  To: 345.67 USDC
  Rate: 1 ETH = 3,456.70 USDC
  Price Impact: 0.05%
  Gas Cost: ~0.002 ETH ($6.91)
  Route: Uniswap V3 (60%) + Curve (40%)
```

**Review the Quote**:
- **Rate**: Is it close to the market price you checked earlier?
- **Price Impact**: Should be low (<1% for major tokens)
- **Gas Cost**: Is it acceptable for your swap amount?
- **Route**: 1inch finds the best route across multiple DEXes

## Step 7: Execute the Swap

If the quote looks good, confirm:

```bash
Confirm? (y/n): y
```

### Approve Token Spending (First Time Only)

If this is your first time swapping ETH (or any ERC-20 token), you'll need to approve it:

```bash
Approve ETH spending? (y/n): y
Approving...
✓ Approval transaction submitted: 0xabc123...
⏳ Waiting for confirmation...
✓ Approved! You can now swap.
```

**Note**: Future swaps of the same token won't require approval.

### Execute the Swap Transaction

After approval (or if already approved), the swap executes:

```bash
Swap transaction submitted: 0xdef456...
Status: Pending...

⏳ Waiting for confirmation...
✓ Confirmed in block 18,456,789

Success! 345.67 USDC received

Transaction Details:
  TX Hash: 0xdef456...
  Gas Used: 0.0019 ETH ($6.57)
  Execution Price: 1 ETH = 3,456.70 USDC

View on Etherscan: https://etherscan.io/tx/0xdef456...
```

## Step 8: Verify Your New Balance

Check that you received your USDC:

```bash
1inch> exit
> balance USDC
Balance: 345.67 USDC
```

Congratulations! You've successfully swapped ETH for USDC.

## Advanced: Custom Slippage

For volatile tokens or during high volatility, you may want to adjust slippage:

```bash
1inch> swap 100 SHIB DOGE --slippage 3
Quote:
  From: 100 SHIB
  To: 0.0523 DOGE
  Max Slippage: 3%
  Min Received: 0.0507 DOGE
```

**Slippage Guidelines**:
- **Stablecoins**: 0.1% - 0.5%
- **Major tokens** (ETH, BTC): 0.5% - 1%
- **Volatile tokens**: 1% - 3%
- **Low liquidity**: 3% - 5%

## Advanced: Fast Gas for Urgent Swaps

If you need your swap to execute quickly:

```bash
1inch> swap 0.1 ETH USDC --gas fast
Using fast gas (20 GWEI)
Gas cost: ~0.003 ETH ($10.37)

Confirm? (y/n): y
```

This ensures your transaction is included in the next block.

## Troubleshooting

### "Insufficient Balance" Error

```bash
1inch> swap 10 ETH USDC
Error: Insufficient ETH balance
Current balance: 1.5 ETH
Required: 10 ETH
```

**Solution**: Reduce the swap amount or acquire more ETH.

### "Slippage Exceeded" Error

```bash
Error: Price moved beyond slippage tolerance
Expected: 345.67 USDC
Current: 344.32 USDC
```

**Solution**:
- Try again immediately (price may stabilize)
- Increase slippage tolerance: `swap 0.1 ETH USDC --slippage 1`
- Wait for market stability

### High Gas Fees

```bash
Gas cost: ~0.01 ETH ($34.56)
```

**Solution**:
- Wait for gas prices to drop
- Check gas regularly: `gas`
- Swap during off-peak hours (weekends, late night UTC)

## Best Practices

1. **Always Check Prices First**: Use `price` command before swapping

2. **Monitor with Charts**: Use `chart ETH` to watch price movements

3. **Review Quotes Carefully**: Check rate, price impact, and gas costs

4. **Start Small**: Test with small amounts first

5. **Mind the Gas**: Don't swap amounts where gas is significant portion of value
   - Bad: Swap $10 worth with $7 gas
   - Good: Swap $1000 worth with $7 gas

6. **Use Appropriate Slippage**: Don't use 1% slippage on stablecoin swaps

7. **Watch for MEV**: Large swaps may be front-run; consider using smaller amounts

## Next Steps

- **[Limit Orders Tutorial](./limit-orders.md)** - Learn to set limit orders
- **[Bridge Tutorial](./cross-chain-bridge.md)** - Move tokens across chains
- **[1inch Commands](../commands/1inch.md)** - Full 1inch command reference

## Quick Reference

```bash
# Essential swap commands
balance                        # Check your balance
price ETH                      # Check price
chart ETH                      # Add chart

use 1inch                      # Enter 1inch
gas                           # Check gas prices
swap <amount> <from> <to>     # Swap tokens
exit                          # Exit protocol

# With options
swap 0.1 ETH USDC --slippage 0.5
swap 0.1 ETH USDC --gas fast
```

Happy swapping!
