# Getting Started with DappTerminal

Welcome to DappTerminal! This guide will help you install, configure, and start using the DeFi Terminal.

## Prerequisites

Before you begin, ensure you have the following installed:

- **Node.js 20+** - [Download](https://nodejs.org/)
- **pnpm** (recommended) - Install with `npm install -g pnpm`
- **Web3 Wallet** - MetaMask, Rainbow, or any WalletConnect-compatible wallet

## Installation

### 1. Clone the Repository

```bash
git clone https://github.com/nickmura/the-defi-terminal.git
cd the-defi-terminal
```

### 2. Install Dependencies

Using pnpm (recommended):
```bash
pnpm install
```

Or using npm/yarn/bun:
```bash
npm install
# or
yarn install
# or
bun install
```

### 3. Configure Environment Variables

Copy the example environment file:
```bash
cp .env.example .env.local
```

Edit `.env.local` and add your API keys:

```bash
# Required
ONEINCH_API_KEY=your_1inch_api_key_here
LIFI_API_KEY=your_lifi_api_key_here
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id_here
```

#### Getting API Keys

**1inch API Key**:
1. Visit [1inch Developer Portal](https://portal.1inch.dev/)
2. Sign up or log in
3. Create a new API key
4. Copy the key to your `.env.local` file

**LiFi API Key**:
1. Visit [LiFi](https://li.fi/)
2. Contact them for API access
3. Add the key to your `.env.local` file

**WalletConnect Project ID**:
1. Visit [WalletConnect Cloud](https://cloud.walletconnect.com/)
2. Create a new project
3. Copy the Project ID to your `.env.local` file

### 4. Start the Development Server

```bash
pnpm run dev
```

The application will be available at [http://localhost:3000](http://localhost:3000)

## First Steps

### Connect Your Wallet

1. Open DappTerminal in your browser
2. Click the **"Connect Wallet"** button in the top-right corner
3. Select your wallet provider (MetaMask, Rainbow, etc.)
4. Approve the connection in your wallet

### Try Your First Commands

Once your wallet is connected, try these basic commands:

#### 1. Check Your Wallet Info
```bash
whoami
```
This displays your wallet address and ENS name (if you have one).

#### 2. Check Your Balance
```bash
balance
```
This shows your native token balance (ETH, MATIC, etc.) on the current network.

#### 3. View Available Commands
```bash
help
```
This lists all available global commands.

#### 4. List Available Protocols
```bash
protocols
```
This shows all installed protocol plugins.

#### 5. Get Token Price
```bash
price ETH
```
This fetches the current price of ETH using the 1inch price API.

### Using Protocol Commands

To use protocol-specific commands, you have two options:

#### Option 1: Use the Protocol Context

Enter a protocol context:
```bash
use 1inch
```

Now all commands will be executed in the 1inch context:
```bash
price USDC
swap 0.1 ETH USDC
gas
```

Exit the protocol context:
```bash
exit
```

#### Option 2: Direct Protocol Commands

You can also call protocol commands directly without entering the context:
```bash
1inch:price USDC
lifi:chains
wormhole:quote ethereum base USDC 100
```

### Using the Analytics Panel

The analytics panel on the right side shows real-time charts:

1. Add a chart:
```bash
chart ETH
```

2. Switch between candlestick and line charts using the tabs

3. Charts update automatically with real-time data from 1inch

### Multi-Tab Support

DappTerminal supports multiple tabs for organizing your workflows:

- Click the **"+"** button to create a new tab
- Click on a tab to switch between them
- Each tab maintains its own command history and protocol context

## Next Steps

Now that you're set up, explore these resources:

- **[User Guide](./user-guide.md)** - Learn all interface features
- **[Command Reference](./commands/)** - Complete command documentation
- **[Tutorials](./tutorials/)** - Step-by-step walkthroughs for common tasks

## Common Issues

### Wallet Won't Connect

- Make sure your wallet extension is installed and unlocked
- Try refreshing the page
- Check that you're on a supported network (Ethereum, Base, Arbitrum, etc.)

### API Errors

- Verify your API keys in `.env.local` are correct
- Check that you haven't exceeded rate limits
- Ensure you're on a stable internet connection

### Build Errors

- Make sure you're using Node.js 20 or higher
- Try deleting `node_modules` and `.next` folders, then run `pnpm install` again
- Check for conflicting global packages

For more troubleshooting, see the [Troubleshooting Guide](./troubleshooting.md).

## Getting Help

- **Documentation**: Browse the [full documentation](./README.md)
- **FAQ**: Check the [FAQ](./faq.md) for common questions
- **Issues**: Report bugs on [GitHub Issues](https://github.com/nickmura/the-defi-terminal/issues)

Welcome to the future of DeFi interaction!
