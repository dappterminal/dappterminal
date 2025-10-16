# The DeFi Terminal - Fibered Monoid Architecture

## Overview

The DeFi Terminal is built on a **fibered monoid** architecture where different DeFi protocols are organized as separate algebraic structures (fibers) that can be composed together.

## Core Concepts

### Command Scopes

Commands are organized into three scopes:

1. **G_core** - Core global commands (help, version, wallet, balance, etc.)
2. **G_alias** - Protocol-agnostic aliases (swap, lend, bridge) - bound at runtime
3. **G_p** - Protocol-specific commands within protocol fibers

### Algebraic Operators

The command registry implements four key operators:

- **π (projection)**: Maps commands to their protocol namespace
- **σ (section)**: Returns the protocol fiber M_P = π⁻¹(P)
- **ρ (exact resolver)**: Resolves commands through G_core → G_alias → G_p
- **ρ_f (fuzzy resolver)**: Fuzzy command matching using Levenshtein distance

## Directory Structure

```
src/
├── core/                           # Core monoid system
│   ├── types.ts                    # Type definitions for monoid architecture
│   ├── monoid.ts                   # Base monoid operations
│   ├── command-registry.ts         # π, σ, ρ, ρ_f operators
│   ├── commands.ts                 # G_core commands
│   └── index.ts                    # Exports
│
├── plugins/                        # Protocol plugins (fibers)
│   ├── _template/                  # Template for new protocols
│   │   ├── index.ts               # Plugin entry point
│   │   ├── commands.ts            # G_p commands for this protocol
│   │   ├── types.ts               # Protocol-specific types
│   │   └── README.md              # Documentation
│   │
│   ├── uniswap-v4/                # Example: Uniswap v4 plugin
│   ├── aave-v3/                   # Example: Aave v3 plugin
│   ├── wormhole/                  # Example: Wormhole bridge plugin
│   │
│   ├── types.ts                   # Plugin interface definitions
│   ├── plugin-loader.ts           # Dynamic plugin loading
│   └── index.ts                   # Plugin exports
│
├── app/                           # Next.js app directory
│   ├── api/                       # API routes for protocols
│   │   ├── _template/             # API route templates
│   │   │   ├── quote/route.ts    # Example: read-only endpoint
│   │   │   ├── swap/route.ts     # Example: write endpoint
│   │   │   └── action/route.ts   # Generic template
│   │   │
│   │   ├── [protocol]/            # Protocol-specific API routes
│   │   │   └── [action]/
│   │   │       └── route.ts       # Next.js route handler
│   │   │
│   │   └── README.md              # API architecture docs
│   │
│   ├── layout.tsx                 # Root layout with providers
│   ├── providers.tsx              # Wagmi & RainbowKit providers
│   ├── page.tsx                   # Main page
│   └── globals.css                # Global styles
│
├── components/
│   └── terminal.tsx               # Terminal UI component
│
└── lib/
    ├── wagmi-config.ts            # Wagmi/RainbowKit configuration
    └── api-client.ts              # API client utilities
```

## Protocol Plugin Architecture

### Plugin Structure

Each protocol plugin follows this structure:

```typescript
// src/plugins/[protocol-id]/index.ts
export const protocolPlugin: Plugin = {
  metadata: {
    id: 'protocol-id',
    name: 'Protocol Name',
    version: '1.0.0',
    // ...
  },

  async initialize(context): Promise<ProtocolFiber> {
    const fiber = createProtocolFiber(...)
    addCommandToFiber(fiber, command1)
    addCommandToFiber(fiber, command2)
    return fiber
  },

  // cleanup, validateConfig, healthCheck...
}
```

### Commands (G_p scope)

```typescript
// src/plugins/[protocol-id]/commands.ts
import { callProtocolApi } from '@/lib/api-client'

export const swapCommand: Command = {
  id: 'swap',
  scope: 'G_p',
  protocol: 'protocol-id',

  async run(args, context) {
    // Call backend API
    const response = await callProtocolApi('protocol-id', 'swap', {
      body: { /* params */ }
    })

    return apiToCommandResult(response)
  }
}
```

### API Routes

```typescript
// src/app/api/[protocol-id]/[action]/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  const body = await request.json()

  // Protocol logic here
  const result = await performAction(body)

  return NextResponse.json({
    success: true,
    data: result
  })
}
```

## Command Resolution Flow

1. User types command: `swap USDC ETH 100`
2. Terminal calls `registry.ρ()` to resolve command
3. Resolution order:
   - Check G_core (core commands)
   - Check G_alias (aliases bound to active protocol)
   - Check G_p (current protocol's fiber)
   - Check G_p with explicit protocol flag: `swap --protocol uniswap-v4`
4. Command executes → calls API endpoint → returns result
5. Terminal formats and displays result

## API Integration Pattern

```
┌─────────────┐
│   Command   │  (G_p scope in plugin)
│  (Client)   │
└──────┬──────┘
       │ callProtocolApi()
       ↓
┌─────────────┐
│ API Client  │  (src/lib/api-client.ts)
│   Helper    │
└──────┬──────┘
       │ fetch('/api/[protocol]/[action]')
       ↓
┌─────────────┐
│  API Route  │  (src/app/api/[protocol]/[action]/route.ts)
│  (Server)   │
└──────┬──────┘
       │
       ↓
┌─────────────┐
│  Protocol   │  (External RPC, SDK, Smart Contracts)
│   Backend   │
└─────────────┘
```

## Creating a New Protocol Plugin

1. **Copy Template**
   ```bash
   cp -r src/plugins/_template src/plugins/your-protocol
   cp -r src/app/api/_template src/app/api/your-protocol
   ```

2. **Update Plugin Metadata** (`src/plugins/your-protocol/index.ts`)
   - Set protocol ID, name, version
   - Add configuration defaults

3. **Implement Commands** (`src/plugins/your-protocol/commands.ts`)
   - Define G_p commands
   - Each command calls corresponding API endpoint

4. **Create API Routes** (`src/app/api/your-protocol/`)
   - Implement route handlers for each action
   - Follow standard response format: `{ success, data/error }`

5. **Load Plugin**
   ```typescript
   import { yourProtocolPlugin } from '@/plugins/your-protocol'
   await pluginLoader.loadPlugin(yourProtocolPlugin, config, context)
   ```

## Command Usage Examples

```bash
# Core commands (G_core)
help
version
balance
whoami

# With active protocol set
use uniswap-v4
swap USDC ETH 100          # Resolves to uniswap-v4:swap

# Explicit protocol
swap USDC ETH 100 --protocol aave-v3

# Namespaced (explicit)
uniswap-v4:swap USDC ETH 100

# Fuzzy autocomplete (Tab key)
sw<Tab>  → suggests: swap, swapCommand, etc.
```

## Wallet Integration

- **RainbowKit** for wallet connection UI
- **Wagmi** for blockchain interactions
- **viem** for utilities (formatUnits, etc.)
- ENS resolution via `useEnsName` hook
- Wallet state synced to ExecutionContext

## Next Steps

1. Implement first real protocol plugin (e.g., Uniswap v4)
2. Add G_alias commands (swap, lend, bridge)
3. Implement cross-chain balance queries
4. Add transaction signing flow
5. Build protocol SDK integrations
