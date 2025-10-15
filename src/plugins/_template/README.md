# Template Protocol Plugin

This is a template for creating new protocol plugins.

## Usage

1. Copy this directory to `plugins/<your-protocol-name>/`
2. Update `index.ts` with your protocol metadata
3. Implement your commands in `commands.ts`
4. Define protocol-specific types in `types.ts`
5. Export your plugin and load it

## Structure

```
<protocol-name>/
├── index.ts       # Plugin entry point (implements Plugin interface)
├── commands.ts    # Protocol commands (G_p scope)
├── types.ts       # Protocol-specific types
└── README.md      # Plugin documentation
```

## Example

For Uniswap v4:

```
uniswap-v4/
├── index.ts       # uniswapV4Plugin
├── commands.ts    # swap, addLiquidity, removeLiquidity, etc.
├── types.ts       # UniswapV4SwapArgs, PoolConfig, etc.
└── README.md
```

## Commands

All commands in a plugin must have:
- `scope: 'G_p'`
- `protocol: '<your-protocol-id>'`

Commands are automatically namespaced by protocol ID and can be accessed via:
- `<protocol>:command` (explicit)
- `command --protocol <protocol>` (flag-based)
- `command` (when protocol is active or preferred)

## Loading the Plugin

```typescript
import { pluginLoader } from '@/plugins'
import { yourProtocolPlugin } from '@/plugins/your-protocol'
import { createExecutionContext } from '@/core'

const context = createExecutionContext()
await pluginLoader.loadPlugin(yourProtocolPlugin, undefined, context)
```
