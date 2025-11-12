# User Guide

This guide covers all features of the DappTerminal interface and how to use them effectively.

## Interface Overview

The DappTerminal interface consists of three main sections:

1. **Terminal Panel (Left)** - Command-line interface for executing DeFi operations
2. **Analytics Panel (Right)** - Real-time charts and data visualization
3. **Header** - Wallet connection, network selection, and settings

## Terminal Panel

### Command Input

The terminal accepts commands in a natural syntax:

```bash
command [options] [arguments]
```

**Features**:
- **Auto-completion** - Tab to complete commands (coming soon)
- **Command history** - Use ↑ and ↓ arrow keys to navigate previous commands
- **Clear output** - Type `clear` to clear the terminal
- **Multi-line support** - Commands are executed on Enter

### Command Syntax

DappTerminal supports three types of commands:

#### 1. Global Commands

Available everywhere, regardless of protocol context:

```bash
help               # Show help
wallet             # Show wallet info
balance            # Check balance
transfer 0.1 0x... # Send ETH
whoami             # Show your address
```

See [Global Commands Reference](./commands/global-commands.md) for the complete list.

#### 2. Protocol-Specific Commands

Commands that belong to a specific protocol. Two ways to use them:

**Method A: Direct Protocol Call**
```bash
1inch:price ETH
lifi:chains
wormhole:quote ethereum base USDC 100
```

**Method B: Protocol Context**
```bash
use 1inch
price ETH
gas
exit
```

#### 3. Alias Commands

Protocol-agnostic shortcuts that route to the active protocol:

```bash
swap 0.1 ETH USDC    # Routes to active protocol's swap
bridge 100 USDC      # Routes to active protocol's bridge
price ETH            # Defaults to 1inch price
```

### Protocol Context

Enter a protocol context to execute multiple commands without prefixing:

```bash
# Enter 1inch context
use 1inch

# Now all commands execute in 1inch context
price USDC           # Gets USDC price
gas                  # Gets gas prices
swap 0.1 ETH USDC    # Executes swap

# Exit context
exit
```

**Current Context Indicator**: The prompt shows your current context:
```bash
>                    # No context (global)
1inch>               # In 1inch context
aave-v3>             # In Aave V3 context
```

### Command History

Navigate your command history using keyboard shortcuts:

- **↑ (Up Arrow)** - Previous command
- **↓ (Down Arrow)** - Next command
- **`history`** - View all command history

The history persists across sessions and is stored locally in your browser.

### Multi-Tab Support

Organize your workflows using multiple tabs:

**Creating Tabs**:
- Click the **"+"** button in the tab bar
- Each tab is independent with its own:
  - Command history
  - Protocol context
  - Output buffer

**Managing Tabs**:
- Click a tab to switch to it
- Click the **×** to close a tab
- Rename tabs by clicking on the tab name (coming soon)

**Use Cases**:
- Tab 1: Monitor prices on 1inch
- Tab 2: Execute swaps on LiFi
- Tab 3: Track Aave positions

## Analytics Panel

The analytics panel displays real-time charts and data visualization.

### Adding Charts

Add charts using the `chart` command:

```bash
# Add token chart
chart ETH
chart BTC
chart USDC

# Add chart by type
chart candlestick
chart line
```

### Chart Types

**Candlestick Chart**:
- Shows OHLC (Open, High, Low, Close) data
- Useful for technical analysis
- 5-minute intervals

**Line Chart**:
- Shows closing price over time
- Cleaner view for price tracking
- Real-time updates

### Chart Controls

- **Switch Tabs** - Click between Candlestick and Line views
- **Zoom** - Scroll to zoom in/out
- **Pan** - Click and drag to pan
- **Reset** - Double-click to reset zoom

### Removing Charts

Charts persist in the analytics panel. To clear them:
- Refresh the page
- Or use the settings panel to manage charts (coming soon)

## Wallet Management

### Connecting Your Wallet

1. Click **"Connect Wallet"** in the top-right corner
2. Select your wallet provider:
   - MetaMask
   - Rainbow
   - WalletConnect (any compatible wallet)
3. Approve the connection request
4. Your wallet is now connected!

### Wallet Information

View your wallet details:

```bash
whoami                  # Shows address and ENS
wallet                  # Shows full wallet info
balance                 # Shows native token balance
```

### Network Switching

DappTerminal supports multiple networks:

- Ethereum (Chain ID: 1)
- Optimism (Chain ID: 10)
- Polygon (Chain ID: 137)
- Base (Chain ID: 8453)
- Arbitrum (Chain ID: 42161)
- BSC (Binance Smart Chain)
- Avalanche

**Switch Networks**:
1. Click the network selector in the header
2. Choose your desired network
3. Approve the switch in your wallet

Some commands are network-specific and will prompt you to switch if needed.

### Disconnecting

Click the wallet address in the header, then select **"Disconnect"**.

## Settings Panel

Access settings by clicking the gear icon in the header.

**Available Settings**:
- **Theme** - Light/Dark mode (coming soon)
- **Default Protocol** - Set default protocol for alias commands
- **RPC Endpoints** - Custom RPC endpoints
- **Rate Limits** - API rate limit preferences

## Command Resolution

DappTerminal uses an algebraic command resolution system. Here's how it works:

### Resolution Order

When you type a command, the system resolves it in this order:

1. **Exact Global Match** - Is it a global command?
2. **Protocol Context Match** - Are you in a protocol context?
3. **Protocol Prefix Match** - Does it have `protocol:command` format?
4. **Alias Match** - Is it an alias command?
5. **Fuzzy Match** - Does it closely match any command?

### Fuzzy Matching

If you mistype a command, the system suggests corrections:

```bash
> hlep
Did you mean 'help'? (y/n)

> sweap 0.1 ETH USDC
Did you mean 'swap'? (y/n)
```

The fuzzy matcher uses Levenshtein distance to find the closest match.

### Command Conflicts

If a command exists in multiple scopes, the system prefers:

1. Global commands (highest priority)
2. Current protocol context
3. Explicit protocol prefix
4. Default protocol (from settings)

## Transaction Flow

### Executing Transactions

When you execute a transaction command (swap, bridge, transfer, etc.):

1. **Quote/Preview** - The system shows transaction details
2. **Confirmation** - You confirm the transaction
3. **Wallet Approval** - Approve in your wallet
4. **Execution** - Transaction is submitted
5. **Status** - Real-time status updates
6. **Completion** - Success/failure notification with transaction hash

### Transaction Statuses

- **Pending** - Transaction submitted, waiting for confirmation
- **Confirmed** - Transaction included in a block
- **Success** - Transaction executed successfully
- **Failed** - Transaction failed (check error message)

### Viewing Transactions

View transaction details on block explorers:

```bash
# Transaction links are automatically provided
# Click the transaction hash to view on Etherscan, etc.
```

## Keyboard Shortcuts

Efficient navigation using keyboard shortcuts:

- **↑/↓** - Navigate command history
- **Tab** - Auto-complete (coming soon)
- **Ctrl+C** - Cancel current input
- **Ctrl+L** - Clear screen (same as `clear` command)
- **Ctrl+K** - Clear scrollback

## Best Practices

### Safety Tips

1. **Double-Check Addresses** - Always verify recipient addresses
2. **Test with Small Amounts** - Try small transactions first
3. **Understand Gas Fees** - Check gas prices before large transactions
4. **Use Slippage Limits** - Set appropriate slippage for swaps
5. **Review Quotes** - Always review swap/bridge quotes before confirming

### Efficiency Tips

1. **Use Protocol Context** - Enter context for multiple commands
2. **Use Aliases** - Faster than full protocol prefixes
3. **Check History** - Reuse previous successful commands
4. **Use Multiple Tabs** - Organize different workflows
5. **Monitor Charts** - Keep an eye on price movements

### Gas Optimization

1. **Check Gas Prices**:
   ```bash
   use 1inch
   gas
   ```

2. **Wait for Lower Gas** - Use the analytics panel to monitor gas trends

3. **Batch Operations** - Some protocols support batching (check individual plugin docs)

## Working with Tokens

### Token Symbols

Most commands accept standard token symbols:

```bash
price ETH
swap 0.1 ETH USDC
balance USDC
```

### Token Addresses

You can also use token contract addresses:

```bash
price 0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48  # USDC
```

### Unsupported Tokens

If a token is not recognized:
- Use the full contract address
- Check if the protocol supports that token
- Verify you're on the correct network

## Error Messages

DappTerminal provides clear error messages:

- **Command Not Found** - Invalid command (check `help`)
- **Invalid Arguments** - Wrong number or type of arguments
- **Protocol Error** - Issue with protocol API
- **Network Error** - Connection issue
- **Insufficient Balance** - Not enough tokens
- **Transaction Failed** - On-chain transaction error

For detailed error troubleshooting, see the [Troubleshooting Guide](./troubleshooting.md).

## Next Steps

- **[Command Reference](./commands/)** - Learn all available commands
- **[Tutorials](./tutorials/)** - Follow step-by-step guides
- **[FAQ](./faq.md)** - Common questions answered

Happy trading!
