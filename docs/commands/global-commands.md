# Global Commands

Global commands are available everywhere in DappTerminal, regardless of the current protocol context.

## Core Commands

### `help`

Display available commands and usage information.

**Syntax**:
```bash
help
```

**Output**:
- Lists all global commands
- Shows available protocol plugins
- Displays current protocol context

**Example**:
```bash
> help
Available commands:
  help - Show this help message
  protocols - List available protocols
  ...
```

---

### `protocols`

List all available protocol plugins.

**Syntax**:
```bash
protocols
```

**Output**:
- Protocol ID
- Protocol name
- Protocol version
- Description

**Example**:
```bash
> protocols
Available protocols:
- 1inch (v1.0.0): DEX aggregator for optimal swap rates
- lifi (v1.0.0): Cross-chain bridge aggregator
- wormhole (v1.0.0): Cross-chain messaging and bridging
...
```

---

### `use <protocol>`

Enter a protocol context to execute protocol-specific commands.

**Syntax**:
```bash
use <protocol_id>
```

**Arguments**:
- `protocol_id` - The ID of the protocol (e.g., `1inch`, `lifi`, `wormhole`)

**Example**:
```bash
> use 1inch
Switched to 1inch protocol

1inch> price ETH
ETH Price: $3,456.78

1inch> exit
Exited 1inch protocol
```

---

### `exit`

Exit the current protocol context and return to global scope.

**Syntax**:
```bash
exit
```

**Example**:
```bash
1inch> exit
>
```

---

### `history`

Display command history for the current tab.

**Syntax**:
```bash
history
```

**Output**:
- Numbered list of previous commands
- Most recent commands at the bottom

**Example**:
```bash
> history
1. help
2. protocols
3. use 1inch
4. price ETH
5. exit
```

**Tip**: Use ↑ and ↓ arrow keys to navigate history interactively.

---

### `clear`

Clear the terminal output.

**Syntax**:
```bash
clear
```

**Keyboard Shortcut**: `Ctrl+L`

**Example**:
```bash
> clear
# Terminal is cleared
```

---

### `version`

Display DappTerminal version information.

**Syntax**:
```bash
version
```

**Output**:
- Application version
- Build information
- Supported protocols

**Example**:
```bash
> version
DappTerminal v0.1.1
Build: 2025-10-23
Protocols: 1inch, aave-v3, lifi, stargate, wormhole
```

---

## Wallet Commands

### `wallet`

Display comprehensive wallet information.

**Syntax**:
```bash
wallet
```

**Output**:
- Wallet address
- ENS name (if available)
- Current network
- Native token balance
- Connection status

**Example**:
```bash
> wallet
Address: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb
ENS: vitalik.eth
Network: Ethereum Mainnet (Chain ID: 1)
Balance: 12.456 ETH
Status: Connected
```

---

### `whoami`

Display your wallet address and ENS name.

**Syntax**:
```bash
whoami
```

**Output**:
- Wallet address
- ENS name (if available)

**Example**:
```bash
> whoami
0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb (vitalik.eth)
```

---

### `balance [token]`

Check your token balance.

**Syntax**:
```bash
balance               # Native token (ETH, MATIC, etc.)
balance <token>       # Specific ERC-20 token
```

**Arguments**:
- `token` (optional) - Token symbol or contract address

**Example**:
```bash
> balance
Balance: 12.456 ETH

> balance USDC
Balance: 1,234.56 USDC
```

---

### `transfer <amount> <address> [token]`

Transfer native tokens or ERC-20 tokens to another address.

**Syntax**:
```bash
transfer <amount> <address> [token]
```

**Arguments**:
- `amount` - Amount to transfer (e.g., `0.1`, `100`)
- `address` - Recipient address or ENS name
- `token` (optional) - Token symbol (defaults to native token)

**Example**:
```bash
# Transfer ETH
> transfer 0.1 vitalik.eth
Transferring 0.1 ETH to vitalik.eth (0x742d35...)
Confirm? (y/n): y
Transaction submitted: 0xabc123...

# Transfer USDC
> transfer 100 0x742d35... USDC
Transferring 100 USDC to 0x742d35...
Confirm? (y/n): y
Transaction submitted: 0xdef456...
```

---

## Analytics Commands

### `chart <symbol|type>`

Add a chart to the analytics panel.

**Syntax**:
```bash
chart <symbol>        # Add token chart
chart <type>          # Add chart by type
```

**Arguments**:
- `symbol` - Token symbol (e.g., `ETH`, `BTC`, `USDC`)
- `type` - Chart type (`candlestick`, `line`)

**Example**:
```bash
> chart ETH
Added ETH chart to analytics panel

> chart candlestick
Displaying candlestick chart
```

**Chart Features**:
- Real-time price updates from 1inch
- Candlestick and line chart views
- Interactive zoom and pan
- 5-minute intervals

---

## Global Alias Commands

Alias commands are protocol-agnostic and route to the active protocol or default protocol.

### `swap <amount> <fromToken> <toToken>`

Execute a token swap using the active protocol.

**Syntax**:
```bash
swap <amount> <from> <to> [options]
```

**Routing**:
- Routes to active protocol context
- If no context, uses default protocol (1inch)

**Example**:
```bash
> swap 0.1 ETH USDC
Using 1inch protocol
Quote: 0.1 ETH → 345.67 USDC
Rate: 1 ETH = 3,456.70 USDC
Confirm? (y/n): y
```

See protocol-specific documentation for detailed swap options:
- [1inch Swap](./1inch.md#swap)
- [LiFi Swap](./lifi.md)

---

### `bridge <amount> <token> <fromChain> <toChain>`

Bridge tokens across chains using the active protocol.

**Syntax**:
```bash
bridge <amount> <token> <fromChain> <toChain>
```

**Routing**:
- Routes to active protocol context
- If no context, prompts for protocol selection

**Example**:
```bash
> bridge 100 USDC ethereum base
Select protocol:
1. lifi
2. stargate
3. wormhole
Choice: 1

Using LiFi protocol
Quote: 100 USDC (Ethereum → Base)
Fee: 0.5 USDC
Time: ~5 minutes
Confirm? (y/n): y
```

See protocol-specific documentation:
- [LiFi Bridge](./lifi.md#bridge)
- [Stargate Bridge](./stargate.md#bridge)
- [Wormhole Bridge](./wormhole.md#bridge)

---

### `price <token>`

Get current token price (defaults to 1inch).

**Syntax**:
```bash
price <token>
```

**Arguments**:
- `token` - Token symbol or contract address

**Example**:
```bash
> price ETH
ETH: $3,456.78 (24h: +2.34%)

> price BTC
BTC: $65,432.10 (24h: -1.23%)
```

---

## Command Composition

Global commands can be composed with protocol commands for powerful workflows:

**Example 1: Check balance, then swap**
```bash
> balance
Balance: 1.5 ETH

> use 1inch
1inch> swap 0.5 ETH USDC
```

**Example 2: Multi-protocol workflow**
```bash
> use 1inch
1inch> price ETH
ETH: $3,456.78

1inch> exit
> use wormhole
wormhole> quote ethereum base USDC 100
```

---

## Tips & Tricks

1. **Use Tab Navigation**: Switch between command history with ↑/↓ arrows

2. **Protocol Shortcuts**: Use direct protocol calls without context:
   ```bash
   1inch:price ETH
   lifi:chains
   ```

3. **Fuzzy Matching**: Mistyped commands get auto-suggestions:
   ```bash
   > hlep
   Did you mean 'help'? (y/n)
   ```

4. **Multiple Tabs**: Use tabs to organize different workflows

5. **Chart Everything**: Add charts while executing commands:
   ```bash
   > chart ETH
   > swap 0.1 ETH USDC
   # Watch price movement in analytics panel
   ```

---

## See Also

- [User Guide](../user-guide.md) - Complete interface guide
- [1inch Commands](./1inch.md) - 1inch protocol commands
- [LiFi Commands](./lifi.md) - LiFi bridge commands
- [Wormhole Commands](./wormhole.md) - Wormhole bridge commands
