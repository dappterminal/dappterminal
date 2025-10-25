# Uniswap v4 Plugin Architecture (WIP)

## Goals
- expose a fiber-local `swap` command that can execute a single-hop Uniswap v4 trade from the CLI
- reuse the proven `singleHopSwap.ts` pipeline (`dev/uniswapv4-nextjs/src/lib/uniswap/singleHopSwap.ts`) to assemble Universal Router calldata
- keep wallet signing on the client (wagmi) while quotes/metadata are fetched server-side via Next.js API routes

## Command Surface (initial)
- `swap <amount> <tokenIn> <tokenOut> [--slippage bps] [--deadline seconds]`
  - resolves to protocol command `uniswap-v4:swap`
  - returns `{ swapRequest: true, params: SingleHopSwapParams }` so the CLI handler can prompt + send the transaction
- `quote <amount> <tokenIn> <tokenOut>` (optional P1) for dry-run output

## Execution Flow
```
CLI input → registry.ρ → plugins/uniswap-v4/commands.ts::swapCommand
        → validate args, fetch token metadata, build SingleHopSwapParams
        → call singleHopSwap.prepareSingleHopSwap(params)
        → command returns swapRequest payload
        → CLI handler (plugins/uniswap-v4/handlers.ts) uses wagmi sendTransaction with returned calldata
        → handler updates terminal history with tx hash / explorer link
```

## Core Modules
- `singleHopSwap.ts` (ported directly from dev app)
  - exports `prepareSingleHopSwap`, `executeSingleHopSwap`, `validateSingleHopSwapParams`
  - depends only on `@uniswap/v4-sdk`, `viem`, local `poolUtils`, `contracts`, `tokens`
- `poolUtils.ts`
  - helper to construct `PoolKey`, resolve directionality, tick spacing
- `tokens.ts`
  - chain-aware token registry + native token helpers (WETH/ETH handling)
- `contracts.ts`
  - Universal Router, PoolManager, Permit2 addresses per chain
- `commands.ts`
  - defines fiber commands (`swap`, later `quote`, `addLiquidity`)
  - transforms CLI args into strongly typed params, pulls env-configured defaults (slippage, deadline)
- `handlers.ts`
  - maps `swap` responses to CLI UI: confirmation prompt, allowance helpers, `sendTransaction`
- `types.ts`
  - shared types (`SingleHopSwapParams`, `SwapRequestPayload`)

## Dependencies
- `@uniswap/v4-sdk` (Planner + Actions enum)
- `@uniswap/sdk-core` for token math if needed
- `viem` for `encodeFunctionData`, unit parsing, address guards
- CLI already provides wagmi config for signing

## Validation & Safety
- enforce same-chain tokens, positive amounts, future deadlines via `validateSingleHopSwapParams`
- require wallet connection (checked in command before constructing payload)
- slippage defaults to 50 bps, bounded between 1–500 via command flags
- on-chain errors bubbled to history output for user awareness

## Testing Plan
- unit: mock `prepareSingleHopSwap` inputs → assert calldata matches snapshots
- unit: command arg parser (swap) handles ETH/USDC, slippage, deadline overrides
- integration: load plugin in registry test harness, execute swap with mocked wagmi `sendTransaction`
- e2e (future): Playwright script that runs CLI command in browser, intercepts transaction submission

## Next Steps
1. Port `singleHopSwap.ts` and supporting utilities into `plugins/uniswap-v4/lib`
2. Scaffold `swap` command + CLI handler with fake signer for development
3. Implement `/api/uniswap-v4/quote` route for quote previews (optional but recommended before mainnet)
4. Extend plugin to support Permit2 approvals and multi-hop routes after single-hop stabilizes
