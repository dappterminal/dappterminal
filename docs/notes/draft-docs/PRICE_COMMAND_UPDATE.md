# Price Command Update - CoinPaprika Integration

## Summary
The `price` command has been updated to support multiple price data sources, including the new CoinPaprika integration.

## What Changed

### Before
```bash
price BTC   # Always uses 1inch
```

### After
```bash
# Multiple ways to get prices:

# 1. Default behavior (tries 1inch first, falls back to coinpaprika)
price BTC

# 2. Explicit protocol selection
price BTC --protocol coinpaprika
price BTC --protocol 1inch

# 3. Direct CoinPaprika command (unchanged)
cprice BTC
```

## Price Command Protocol Priority

When you run `price <symbol>`, the system tries data sources in this order:

1. **Explicit `--protocol` flag** - If you specify `--protocol coinpaprika`, it uses that
2. **Active protocol** - If you've run `use coinpaprika`, it uses that
3. **User preference** - Saved preference for price command
4. **Default: 1inch** - Chain-specific DEX price data
5. **Fallback: coinpaprika** - Cross-chain market data (56K+ coins)

## Use Cases

### When to use 1inch (default)
- Getting DEX prices for tokens on specific chains
- Trading on decentralized exchanges
- Need real-time on-chain liquidity data

### When to use CoinPaprika
- Looking up any coin from 56,000+ options
- Getting market aggregated prices
- Checking coins not available on 1inch
- Cross-chain price comparisons

## Command Examples

### Basic Usage
```bash
# Quick price check (uses 1inch by default)
price ETH

# Specific protocol
price BTC --protocol coinpaprika

# Direct CoinPaprika command
cprice SOL
```

### Comparing Sources
```bash
# Compare 1inch DEX price vs market price
price USDC --protocol 1inch
price USDC --protocol coinpaprika
```

### Finding Coins
```bash
# Search for a coin first
coinsearch dogecoin

# Then get its price
cprice DOGE
# or
price DOGE --protocol coinpaprika
```

## Benefits

✅ **Flexibility** - Choose your price data source
✅ **Fallback** - If 1inch doesn't have a token, coinpaprika might
✅ **Wider Coverage** - 56K+ coins from CoinPaprika vs ~10K tokens from 1inch
✅ **Backward Compatible** - Existing `price` commands still work
✅ **Consistent** - Same `--protocol` flag pattern as swap and bridge commands

## Technical Details

### Updated Command
- **File**: `src/core/commands.ts`
- **Command**: `priceAliasCommand`
- **Change**: Added protocol routing logic with `--protocol` flag support

### Protocol Detection
The system now:
1. Parses `--protocol` flag from arguments
2. Builds priority list of protocols to try
3. Routes to appropriate command (1inch fiber or coinpaprika cprice)
4. Returns first successful result

### Code Pattern
Follows the same pattern as `swap` and `bridge` alias commands:
- Parse `--protocol` flag
- Build candidate protocol list
- Try each in priority order
- Return first success or error

## Migration Guide

### For Users
No changes needed! Your existing commands work the same way:
```bash
price ETH  # Still works, uses 1inch
```

New capabilities added:
```bash
price ETH --protocol coinpaprika  # NEW: Choose source
cprice ETH                         # NEW: Direct CoinPaprika
```

### For Developers
The `cprice` command is now integrated into the global `price` alias system. If you were planning to build price integrations, use the same pattern:

1. Create a protocol-specific price command
2. Register it in the protocol's fiber (for protocol-scoped commands)
3. Or register as a core command (for global commands like cprice)
4. The price alias will automatically find and route to it

## See Also

- `COINPAPRIKA_IMPLEMENTATION.md` - Full CoinPaprika integration details
- `help price` - Command help in terminal
- `help cprice` - CoinPaprika-specific command help
