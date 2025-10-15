# Plugin System

This directory contains the plugin system for DeFi protocol integrations.

## Architecture

Each protocol (e.g., Uniswap v4, Wormhole, Li.Fi) is implemented as a plugin in its own subdirectory.

## Directory Structure

```
plugins/
├── types.ts              # Plugin interfaces
├── plugin-loader.ts      # Plugin loader/manager
├── index.ts              # Exports
├── _template/            # Template for new plugins
│   ├── index.ts
│   ├── commands.ts
│   ├── types.ts
│   └── README.md
├── uniswap-v4/           # Example: Uniswap v4 plugin
│   ├── index.ts
│   ├── commands.ts
│   └── types.ts
├── aave-v3/              # Example: Aave v3 plugin
│   ├── index.ts
│   ├── commands.ts
│   └── types.ts
├── wormhole/             # Example: Wormhole bridge plugin
│   ├── index.ts
│   ├── commands.ts
│   └── types.ts
└── lifi/                 # Example: Li.Fi aggregator plugin
    ├── index.ts
    ├── commands.ts
    └── types.ts
```

## Creating a Plugin

To create a new protocol plugin:

1. **Copy the template:**
   ```bash
   cp -r src/plugins/_template src/plugins/your-protocol
   ```

2. **Update `index.ts`:**
   - Change the plugin metadata (id, name, version, etc.)
   - Implement the `initialize()` method
   - Add protocol-specific configuration

3. **Define commands in `commands.ts`:**
   - Each command must have `scope: 'G_p'`
   - Each command must have `protocol: 'your-protocol'`
   - Export all commands

4. **Define types in `types.ts`:**
   - Protocol-specific argument types
   - Result types
   - Configuration types

5. **Export your plugin:**
   ```typescript
   // In your-protocol/index.ts
   export const yourProtocolPlugin: Plugin = { ... }
   ```

## Example Plugin Structure

### Uniswap v4 Plugin

```typescript
// plugins/uniswap-v4/index.ts
import type { Plugin } from '@/plugins'
import type { ProtocolFiber, ExecutionContext } from '@/core'
import { createProtocolFiber, addCommandToFiber } from '@/core'
import { swapCommand, addLiquidityCommand } from './commands'

export const uniswapV4Plugin: Plugin = {
  metadata: {
    id: 'uniswap-v4',
    name: 'Uniswap v4',
    version: '1.0.0',
    description: 'Uniswap v4 DEX integration',
    tags: ['dex', 'swap', 'liquidity'],
  },

  defaultConfig: {
    enabled: true,
    config: {
      rpcUrl: 'https://mainnet.infura.io/v3/YOUR-KEY',
      chainId: 1,
    },
  },

  async initialize(context: ExecutionContext): Promise<ProtocolFiber> {
    const fiber = createProtocolFiber('uniswap-v4', 'Uniswap v4')

    addCommandToFiber(fiber, swapCommand)
    addCommandToFiber(fiber, addLiquidityCommand)

    return fiber
  },
}
```

### Commands

```typescript
// plugins/uniswap-v4/commands.ts
import type { Command, CommandResult, ExecutionContext } from '@/core'

export const swapCommand: Command = {
  id: 'swap',
  scope: 'G_p',
  protocol: 'uniswap-v4',
  description: 'Swap tokens on Uniswap v4',
  aliases: ['exchange', 'trade'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    // Implementation...
    return { success: true, value: result }
  },
}
```

## Loading Plugins

Plugins are loaded via the `PluginLoader`:

```typescript
import { pluginLoader } from '@/plugins'
import { uniswapV4Plugin } from '@/plugins/uniswap-v4'
import { aaveV3Plugin } from '@/plugins/aave-v3'
import { createExecutionContext } from '@/core'

const context = createExecutionContext()

// Load plugins
await pluginLoader.loadPlugin(uniswapV4Plugin, undefined, context)
await pluginLoader.loadPlugin(aaveV3Plugin, undefined, context)

// Check loaded plugins
console.log(pluginLoader.getLoadedPluginIds())
// ['uniswap-v4', 'aave-v3']
```

## Command Resolution

Commands from plugins can be accessed in multiple ways:

1. **Explicit protocol namespace:**
   ```
   uniswap-v4:swap 100 USDC ETH
   ```

2. **Protocol flag:**
   ```
   swap 100 USDC ETH --protocol uniswap-v4
   ```

3. **Active/preferred protocol:**
   ```
   swap 100 USDC ETH
   # Uses preferred protocol from user settings
   ```

## Command Scopes

Plugins create commands in the **G_p** (protocol-specific) scope:

- **G_core**: Core global commands (not in plugins)
- **G_alias**: Aliased commands that bind to protocols at runtime (not in plugins)
- **G_p**: Protocol-specific commands (defined in plugins)

See the [algebraic model documentation](https://github.com/nickmura/defi-terminal-research/blob/main/algebra/algebraic-model-of-defi-actions10.md) for more details on the fibered monoid architecture.

## Plugin Examples

Ready to implement:
- `uniswap-v4/` - Uniswap v4 DEX
- `aave-v3/` - Aave v3 lending protocol
- `wormhole/` - Wormhole cross-chain bridge
- `lifi/` - Li.Fi DEX aggregator
- `stargate/` - Stargate bridge protocol
- `compound/` - Compound lending
- `curve/` - Curve stableswap

Each protocol gets its own subdirectory with the same structure as `_template/`.
