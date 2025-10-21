# The DeFi Terminal - System Architecture

**Last Updated:** 2025-10-17
**Version:** 0.1.0

This document provides an overview of The DeFi Terminal's system architecture, focusing on how components interact to provide a mathematically rigorous, composable CLI for DeFi protocols.

---

## Table of Contents

1. [Overview](#overview)
2. [Core Architecture](#core-architecture)
3. [Algebraic Foundation](#algebraic-foundation)
4. [Component Layers](#component-layers)
5. [Data Flow](#data-flow)
6. [Plugin System](#plugin-system)
7. [API Layer](#api-layer)
8. [Frontend Architecture](#frontend-architecture)
9. [Related Documentation](#related-documentation)

---

## Overview

The DeFi Terminal is a Next.js application that implements a terminal-based interface for interacting with multiple DeFi protocols. The architecture is built on a **fibered monoid** algebraic structure that provides:

- **Protocol Isolation**: Each protocol operates in its own algebraic fiber
- **Type-Safe Composition**: Commands can be chained with compile-time guarantees
- **Flexible Resolution**: Commands resolve via exact, fuzzy, or namespace-based matching
- **Extensibility**: New protocols can be added via a plugin system

### Technology Stack

- **Frontend**: Next.js 15, React 19, TypeScript
- **Styling**: Tailwind CSS 4
- **Wallet**: RainbowKit + wagmi + viem
- **State Management**: React hooks + ExecutionContext
- **Architecture**: Fibered Monoid (algebraic structure)

---

## Core Architecture

### High-Level System Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                         Frontend                             │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Terminal   │  │  RainbowKit  │  │   Tabs UI    │       │
│  │    UI       │  │   Wallet     │  │   Context    │       │
│  └──────┬──────┘  └──────┬───────┘  └──────┬───────┘       │
│         │                │                  │                │
│         └────────────────┴──────────────────┘                │
│                          │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    Core System                               │
│  ┌────────────────────┐ │ ┌────────────────────────────┐    │
│  │  Command Registry  │◄┼─┤  Resolution Operators      │    │
│  │  (π, σ, ρ, ρ_f)   │ │ │  - Exact (ρ)               │    │
│  └─────────┬──────────┘ │ │  - Fuzzy (ρ_f)             │    │
│            │            │ │  - Projection (π)           │    │
│  ┌─────────▼──────────┐ │ │  - Section (σ)             │    │
│  │  Execution Context │ │ └────────────────────────────┘    │
│  │  - Active Protocol │ │                                   │
│  │  - Protocol State  │ │                                   │
│  │  - History         │ │                                   │
│  └────────────────────┘ │                                   │
└──────────────────────────┼───────────────────────────────────┘
                           │
┌──────────────────────────┼───────────────────────────────────┐
│                    Plugin Layer                              │
│                          │                                   │
│  ┌────────┐  ┌────────┐  ┌────────┐  ┌────────┐             │
│  │ 1inch  │  │  LiFi  │  │Wormhole│  │Stargate│             │
│  │M_1inch │  │ M_lifi │  │M_wrmhl │  │M_starg │             │
│  └───┬────┘  └───┬────┘  └───┬────┘  └───┬────┘             │
│      │           │           │           │                   │
└──────┼───────────┼───────────┼───────────┼───────────────────┘
       │           │           │           │
┌──────┼───────────┼───────────┼───────────┼───────────────────┐
│                      API Layer                               │
│  ┌───▼─────┐  ┌──▼──────┐  ┌──▼──────┐  ┌──▼──────┐         │
│  │/api/    │  │/api/lifi│  │/api/    │  │/api/    │         │
│  │1inch/   │  │ -routes │  │wormhole/│  │stargate/│         │
│  │ -gas    │  │ -status │  │ -quote  │  │ -quote  │         │
│  └─────────┘  └─────────┘  │ -bridge │  └─────────┘         │
│                             └─────────┘                       │
└──────────────────────────────────────────────────────────────┘
```

---

## Algebraic Foundation

The DeFi Terminal is built on a **fibered monoid** structure. See [FIBERED-MONOID-SPEC.md](./FIBERED-MONOID-SPEC.md) for the complete mathematical specification.

### Key Concepts

#### Monoid Structure (M, ∘, e)

- **Set M**: All commands in the system
- **Operation ∘**: Command composition
- **Identity e**: No-op command (both global and protocol-specific)

**Laws:**
```
(f ∘ g) ∘ h = f ∘ (g ∘ h)  (Associativity)
e ∘ f = f                    (Left Identity)
f ∘ e = f                    (Right Identity)
```

#### Command Scopes

Commands are partitioned into three disjoint scopes:

**G = G_core ∪ G_alias ∪ G_p**

- **G_core**: Global commands (`help`, `balance`, `wallet`, `whoami`)
- **G_alias**: Protocol-agnostic aliases (`swap`, `bridge` - binds at runtime)
- **G_p**: Protocol-specific commands (`1inch:swap`, `wormhole:bridge`)

#### Protocol Fibers (M_p)

Each protocol has a **submonoid** M_p ⊆ M with:

- **Closure**: f, g ∈ M_p ⇒ f ∘ g ∈ M_p
- **Identity**: e_p ∈ M_p (protocol-specific identity)
- **Isolation**: M_p ∩ M_q = ∅ for p ≠ q

**Implementation:** `src/core/monoid.ts:createProtocolFiber`

#### Resolution Operators

- **π (Projection)**: M → Protocols ∪ {⊥} - Maps command to protocol
- **σ (Section)**: Protocols → M_p - Returns protocol fiber
- **ρ (Exact Resolver)**: (Protocols ∪ G) → M ∪ {⊥} - Deterministic resolution
- **ρ_f (Fuzzy Resolver)**: (Protocols ∪ G) × ℝ → [M] - Levenshtein-based matching

**Implementation:** `src/core/command-registry.ts`

---

## Component Layers

### 1. Core Layer (`src/core/`)

**Monoid System** (`monoid.ts`)
- `identityCommand`: Global identity element
- `composeCommands`: Binary composition operation
- `createProtocolFiber`: Creates protocol submonoids with identity
- `verifyMonoidLaws`: Test harness for algebraic properties

**Command Registry** (`command-registry.ts`)
- Implements resolution operators (π, σ, ρ, ρ_f)
- Maintains command mappings (G_core, G_alias, G_p)
- Handles protocol-local alias resolution
- Enforces fiber isolation

**Execution Context** (`types.ts`)
- Active protocol tracking
- Protocol state management (per-fiber state)
- Command history
- Wallet connection state

**Core Commands** (`commands.ts`)
- `help`: Fiber-aware command listing
- `use`: Enter protocol fiber
- `exit`: Exit protocol fiber
- `history`: Command execution log
- `wallet`: Wallet connection
- `whoami`: Display connected address
- `balance`: Show wallet balance

### 2. Plugin Layer (`src/plugins/`)

Each protocol plugin implements:

```typescript
interface Plugin {
  metadata: {
    id: ProtocolId
    name: string
    version: string
    description: string
    tags: string[]
  }

  defaultConfig: PluginConfig

  initialize(context: ExecutionContext): Promise<ProtocolFiber>
}
```

**Implemented Plugins:**
- **1inch** (`src/plugins/1inch/`) - DEX aggregator
- **LiFi** (`src/plugins/lifi/`) - Bridge aggregator
- **Wormhole** (`src/plugins/wormhole/`) - Cross-chain bridge
- **Stargate** (`src/plugins/stargate/`) - LayerZero bridge

**Plugin Structure:**
```
src/plugins/[protocol]/
├── index.ts          # Plugin metadata & initialization
├── commands.ts       # Protocol commands (G_p scope)
├── types.ts          # Protocol-specific types
└── ARCHITECTURE.md   # Protocol-specific docs
```

### 3. API Layer (`src/app/api/`)

Next.js API routes organized by protocol:

```
src/app/api/
├── 1inch/
│   └── gas/route.ts
├── lifi/
│   ├── routes/route.ts
│   ├── step-transaction/route.ts
│   ├── test-key/route.ts
│   └── status/route.ts
├── wormhole/
│   ├── quote/route.ts
│   └── bridge/route.ts
└── stargate/
    └── quote/route.ts
```

**Standard Response Format:**
```typescript
// Success
{ success: true, data: T }

// Error
{ success: false, error: string }
```

### 4. Frontend Layer (`src/app/` & `src/components/`)

**Terminal UI** (`src/components/terminal.tsx`)
- Command input handling
- Output rendering
- Command history (up/down arrows)
- Tab management

**Main Page** (`src/app/page.tsx`)
- RainbowKit wallet provider
- Tabbed terminal instances
- Execution context management

---

## Data Flow

### Command Execution Flow

```
1. User Input
   └─> Terminal UI captures input

2. Resolution
   └─> CommandRegistry.ρ(input, context)
       ├─> Check G_core (global commands)
       ├─> Check G_alias (aliased commands)
       └─> Check G_p (protocol-specific)
           ├─> Explicit: --protocol flag
           ├─> Namespace: protocol:command
           └─> Active protocol context

3. Execution
   └─> command.run(args, context)
       ├─> May call API routes
       ├─> May update ExecutionContext
       └─> Returns CommandResult

4. Rendering
   └─> Terminal displays result
       └─> Update history
```

### Protocol State Management

```typescript
ExecutionContext {
  activeProtocol?: ProtocolId        // Current fiber (or undefined = M_G)

  protocolState: Map<ProtocolId, any> // Per-protocol session state
  // Example for wormhole:
  // {
  //   'wormhole': {
  //     lastQuote: {...},
  //     selectedRoute: 'AutomaticCCTPRoute',
  //     lastTxHashes: ['0x...']
  //   }
  // }

  history: CommandHistoryEntry[]     // Execution log

  wallet: {                          // Wallet connection
    address?: string
    chainId?: number
    isConnected: boolean
  }
}
```

---

## Plugin System

### Creating a New Plugin

1. **Scaffold:**
   ```bash
   cp -r src/plugins/_template src/plugins/my-protocol
   ```

2. **Update Metadata** (`index.ts`):
   ```typescript
   export const myProtocolPlugin: Plugin = {
     metadata: {
       id: 'my-protocol',
       name: 'My Protocol',
       version: '1.0.0',
       description: 'My DeFi protocol integration',
       tags: ['dex', 'swap']
     },

     async initialize(context) {
       const fiber = createProtocolFiber('my-protocol', 'My Protocol')
       addCommandToFiber(fiber, swapCommand)
       return fiber
     }
   }
   ```

3. **Define Commands** (`commands.ts`):
   ```typescript
   export const swapCommand: Command = {
     id: 'swap',
     scope: 'G_p',
     protocol: 'my-protocol',
     description: 'Swap tokens',

     async run(args, context) {
       // Implementation
       return { success: true, value: result }
     }
   }
   ```

4. **Create API Routes** (`src/app/api/my-protocol/`):
   ```typescript
   // src/app/api/my-protocol/quote/route.ts
   export async function POST(request: NextRequest) {
     // Implementation
     return NextResponse.json({ success: true, data: {...} })
   }
   ```

5. **Register Plugin** (`src/plugins/index.ts`):
   ```typescript
   import { myProtocolPlugin } from './my-protocol'
   export const plugins = [myProtocolPlugin, ...]
   ```

---

## API Layer

### Design Principles

1. **Protocol Isolation**: Each protocol has its own `/api/[protocol]/` namespace
2. **Standard Format**: All routes return `{ success, data | error }`
3. **No Direct Wallet Access**: Routes return transaction data; client signs
4. **Stateless**: Session state managed in ExecutionContext (client-side)

### Example API Route

```typescript
// src/app/api/my-protocol/quote/route.ts
import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validate
    if (!body.tokenIn || !body.tokenOut) {
      return NextResponse.json(
        { success: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    // Call protocol API/SDK
    const quote = await getQuote(body)

    // Return standard format
    return NextResponse.json({
      success: true,
      data: quote
    })
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    )
  }
}
```

---

## Frontend Architecture

### Terminal Component

**State Management:**
- Command history (stored in ExecutionContext)
- Input buffer (local state)
- Active tab (local state)
- Wallet connection (wagmi hooks)

**Key Features:**
- Multi-line command support
- Arrow key history navigation
- Tab completion (via ρ_f fuzzy resolver)
- Protocol context indicator (e.g., `user@1inch>`)

### Execution Context Provider

```typescript
const ExecutionContextProvider: React.FC = ({ children }) => {
  const [contexts, setContexts] = useState<Map<string, ExecutionContext>>()

  // Each tab gets its own ExecutionContext
  // Allows independent protocol sessions

  return (
    <ExecutionContextContext.Provider value={{contexts, setContexts}}>
      {children}
    </ExecutionContextContext.Provider>
  )
}
```

---

## Related Documentation

- **[README.md](./README.md)** - Project overview and setup
- **[FIBERED-MONOID-SPEC.md](./FIBERED-MONOID-SPEC.md)** - Complete algebraic specification
- **[src/app/api/README.md](./src/app/api/README.md)** - API routes reference
- **[src/plugins/README.md](./src/plugins/README.md)** - Plugin development guide
- **[src/plugins/wormhole/ARCHITECTURE.md](./src/plugins/wormhole/ARCHITECTURE.md)** - Wormhole integration
- **[src/plugins/stargate/ARCHITECTURE.md](./src/plugins/stargate/ARCHITECTURE.md)** - Stargate integration

---

## Implementation Status

### ✅ Completed (v0.1.0)

- [x] Core monoid system with proper identity and composition
- [x] Command registry with all resolution operators (π, σ, ρ, ρ_f)
- [x] Execution context and state management
- [x] Protocol fiber isolation
- [x] Plugin system and loader
- [x] 1inch plugin (swap, quote, chains, tokens)
- [x] LiFi plugin (health, quote, routes, execute, prepare, chains, status)
- [x] Wormhole plugin (quote, routes, bridge, chains)
- [x] Stargate plugin (quote, bridge, chains)
- [x] RainbowKit wallet integration
- [x] Tabbed terminal UI
- [x] Command history and aliases
- [x] Fuzzy command matching

### 🚧 In Progress

- [ ] Unit tests for core monoid operations
- [ ] Integration tests for fiber closure
- [ ] Status commands for bridges (Wormhole, Stargate)
- [ ] Token listing commands

### 📋 Planned (v0.2.0+)

- [ ] Ambient identity for cross-fiber workflows
- [ ] G_alias command support (when 2+ protocols share functionality)
- [ ] Command composition macros
- [ ] Transaction batching
- [ ] Multi-chain wallet support
- [ ] Additional protocol integrations (Uniswap, Aave, Curve)

---

**Version History:**

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2025-10-17 | Initial architecture document |

---

For questions or contributions, see [Contributing](#) section in main README.
