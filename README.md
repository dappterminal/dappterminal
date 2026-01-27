# dappterminal.com

**Version:** 0.2.1 (changelog coming soon)

**Last Updated:** 2026-01-26 (forgot to update these soon)

A composable, modular terminal interface for interacting with DeFi protocols across multiple blockchains. Built on a **fibered monoid** architecture that provides protocol isolation, type-safe command composition, and extensible plugin system.

## Overview

The DeFi Terminal implements a mathematically rigorous command system where:

- **Commands form a monoid** under composition with proper identity and associativity
- **Protocol fibers** provide isolated namespaces for each DeFi protocol (Uniswap, 1inch, Wormhole, etc.)
- **Algebraic operators** enable flexible command resolution and cross-protocol workflows
- **Plugin architecture** allows seamless integration of new protocols

### Key Features

- ✅ **Multi-protocol support**: 1inch, Wormhole, Stargate, LiFi, and more
- ✅ **Wallet integration**: RainbowKit + wagmi for seamless wallet connection
- ✅ **Type-safe composition**: Commands can be chained with compile-time safety
- ✅ **Fuzzy search**: Levenshtein distance-based command matching
- ✅ **Protocol isolation**: Each protocol operates in its own algebraic fiber
- ✅ **Cross-chain bridging**: Native support for Wormhole, Stargate, and LiFi bridges
- ✅ **Tabbed interface**: Multiple terminal sessions with independent contexts

## Architecture

The terminal is built on three core concepts:

1. **Command Scopes** (`G = G_core ∪ G_alias ∪ G_p`)
   - `G_core`: Global commands available everywhere (`help`, `balance`, `wallet`)
   - `G_alias`: Protocol-agnostic aliases that bind at runtime (`swap`, `bridge`)
   - `G_p`: Protocol-specific commands (`1inch:swap`, `wormhole:bridge`)

2. **Protocol Fibers** (`M_p`)
   - Each protocol has a submonoid with closure and identity
   - Commands compose within fibers maintaining type safety
   - Isolation prevents cross-protocol interference

3. **Resolution Operators**
   - `π` (projection): Maps commands to protocols
   - `σ` (section): Returns protocol fiber
   - `ρ` (exact resolver): Deterministic command resolution
   - `ρ_f` (fuzzy resolver): Levenshtein-based matching

See [FIBERED-MONOID-SPEC.md](./FIBERED-MONOID-SPEC.md) for the complete algebraic specification.
## Current protocols/APIs supported

- 1inch
- Stargate (LayerZero)
- Li.Fi
- Wormhole
- Uniswap (V4) (*work in progress*)
- Aave (V3) (*work in progress*)
- Hyperliquid (*TODO*)
- Chainlink (*TODO*)
- Hyperlane (*TODO*)
- LayerZero (*TODO*)
- Yahoo Finance API (*TODO*)
- Polygon.io API (*TODO*)
- & more

## Getting Started

### Prerequisites

- Node.js 20+
- npm/yarn/pnpm/bun
- A Web3 wallet (MetaMask, Rainbow, etc.)

### Installation

```bash
# Clone the repository
git clone https://github.com/nickmura/the-defi-terminal.git
cd the-defi-terminal

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env.local
# Edit .env.local with your API keys
```

### Environment Variables

Required API keys (add to `.env.local`):

```bash
# 1inch
ONEINCH_API_KEY=your_1inch_api_key

# LiFi Bridge API key
LIFI_API_KEY=your_lifi_api_key

# LiFi Proxy URL (external lifi-api-nextjs service)
LIFI_PROXY_URL=http://localhost:3001

# WalletConnect (optional)
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_project_id_here
```

### Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to access the terminal.

### Building for Production

```bash
npm run build
npm start
```

## Usage

### Basic Commands

```bash
# Get help
help

# Connect wallet
wallet

# Check wallet balance
whoami
balance

# View command history
history
```

### Protocol Usage

```bash
# Enter a protocol fiber
use 1inch

# Swap tokens (within 1inch context)
swap 1 eth usdc

# Exit protocol context
exit

# Use explicit namespace (from any context)
1inch:swap 1 eth usdc
```

### Cross-Chain Bridging

```bash
# LiFi bridge (aggregator)
use lifi
quote ethereum polygon usdc 100
routes
execute 0

# Wormhole bridge
use wormhole
quote base arbitrum usdc 1
bridge

# Stargate bridge
use stargate
quote base arbitrum usdc 1
bridge
```

### Tab Management

- Click "+" to create new terminal tabs
- Each tab maintains independent execution context
- Switch between tabs for parallel workflows

## Project Structure

```
the-defi-terminal/
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── api/                # API routes (see src/app/api/README.md)
│   │   │   ├── 1inch/          # 1inch DEX aggregator
│   │   │   ├── lifi/           # LiFi bridge aggregator
│   │   │   ├── wormhole/       # Wormhole bridge
│   │   │   └── stargate/       # Stargate bridge
│   │   └── page.tsx            # Main terminal interface
│   ├── core/                   # Core algebraic system
│   │   ├── monoid.ts           # Monoid operations & composition
│   │   ├── command-registry.ts # Resolution operators (π, σ, ρ, ρ_f)
│   │   ├── commands.ts         # Core global commands
│   │   └── types.ts            # Type definitions
│   ├── plugins/                # Protocol plugins (see src/plugins/README.md)
│   │   ├── _template/          # Plugin template
│   │   ├── 1inch/              # 1inch integration
│   │   ├── lifi/               # LiFi integration
│   │   ├── wormhole/           # Wormhole integration
│   │   └── stargate/           # Stargate integration
│   ├── components/             # React components
│   │   ├── terminal.tsx        # Terminal UI
│   │   └── command-output.tsx  # Command output rendering
│   └── lib/                    # Shared utilities
├── FIBERED-MONOID-SPEC.md      # Algebraic specification
├── ARCHITECTURE.md             # System architecture guide
└── README.md                   # This file
```

## Documentation

- **[FIBERED-MONOID-SPEC.md](./FIBERED-MONOID-SPEC.md)**: Complete algebraic specification and implementation details
- **[ARCHITECTURE.md](./ARCHITECTURE.md)**: System architecture and design patterns
- **[src/app/api/README.md](./src/app/api/README.md)**: API routes documentation
- **[src/plugins/README.md](./src/plugins/README.md)**: Plugin development guide
- **[src/plugins/wormhole/ARCHITECTURE.md](./src/plugins/wormhole/ARCHITECTURE.md)**: Wormhole integration details
- **[src/plugins/stargate/ARCHITECTURE.md](./src/plugins/stargate/ARCHITECTURE.md)**: Stargate integration details

## Supported Protocols

| Protocol | Type | Status | Commands |
|----------|------|--------|----------|
| 1inch | DEX Aggregator | ✅ Live | `swap`, `quote`, `chains`, `tokens` |
| LiFi | Bridge Aggregator | ✅ Live | `health`, `quote`, `routes`, `execute`, `prepare`, `chains`, `status` |
| Wormhole | Cross-chain Bridge | ✅ Live | `quote`, `routes`, `bridge`, `status` |
| Stargate | LayerZero Bridge | ✅ Live | `quote`, `bridge`, `chains` |

## Development

### Adding a New Protocol

1. Copy the plugin template:
   ```bash
   cp -r src/plugins/_template src/plugins/your-protocol
   ```

2. Update plugin metadata and implement commands

3. Create API routes under `src/app/api/your-protocol/`

4. Register the plugin in `src/plugins/index.ts`

See [src/plugins/README.md](./src/plugins/README.md) for detailed instructions.

### Running Tests

```bash
npm test
```

### Linting

```bash
npm run lint
```

## Contributing

Contributions are welcome! Please ensure:

1. All commands maintain monoid laws (associativity, identity)
2. Protocol fibers remain isolated (proper submonoid structure)
3. New plugins follow the template structure
4. Documentation is updated accordingly

## License

MIT

## Acknowledgments

- Built with [Next.js 15](https://nextjs.org)
- Wallet integration by [RainbowKit](https://www.rainbowkit.com/)
- Cross-chain messaging by [Wormhole](https://wormhole.com/)
- Inspired by algebraic approaches to composable systems

---

**Research**: This project implements the fibered monoid architecture described in the [DeFi Terminal Research](https://github.com/nickmura/defi-terminal-research) repository.
