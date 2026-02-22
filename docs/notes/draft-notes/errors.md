## snapshot_012 error report  
  
  Critical

  - None found.

  High

  - Wormhole bridge uses the wallet’s current chain ID for execution without validating that it matches the user‑supplied fromChain, so a user can request fromChain=base
    while their wallet is on mainnet and the handler will still attempt to bridge from the wallet chain, leading to wrong‑chain execution or confusing failures. src/plugins/
    wormhole/commands.ts:100 src/plugins/wormhole/commands.ts:161
  - 1inch API key is read from process.env.ONEINCH_API_KEY in client‑loaded plugin code; if set, it can be bundled into the client and exposed in the browser, which is a key
    leak risk. src/plugins/1inch/index.ts:26 src/plugins/1inch/index.ts:80 src/plugins/1inch/api.ts:6

  Medium

  - Wormhole quote and routes are stubbed but return success: true, so users can interpret “pending” responses as valid data and proceed with wrong expectations; any
    workflow that relies on these commands will be misleading. src/plugins/wormhole/commands.ts:34 src/plugins/wormhole/commands.ts:63
  - Uniswap v4 remove‑liquidity handler is not implemented and uses an empty RPC URL; invoking it will never build a real transaction, yet the UI implies progress. src/
    plugins/uniswap-v4/handlers.ts:920 src/plugins/uniswap-v4/handlers.ts:976
  - Stargate bridge command never checks that the connected wallet chain matches fromChain, so it can generate a quote for one chain and then attempt to submit on another.
    src/plugins/stargate/commands.ts:24 src/plugins/stargate/commands.ts:107

  Low

  - 1inch swap handler forces gas to 0 when missing, which can cause immediate tx failures or wallet rejection instead of letting the wallet estimate. src/plugins/1inch/
    handlers.ts:141

  Open questions / assumptions:

  - I assumed plugins are executed in the browser (client components) and therefore any process.env.* values are potentially exposed in the bundle. If these plugins are
    server‑only, the key‑exposure risk reduces.
  - Do you want strict chain enforcement (auto‑prompt switch) for all bridge/swap commands, or just warnings when fromChain mismatches the wallet?

  Change summary (no code changes made):

  - Audit focused on Wormhole, 1inch, Uniswap v4, and Stargate plugins for execution correctness and security risks.

  Suggested next steps:

  1. Decide whether to gate commands on context.wallet.chainId === fromChainId (hard error vs soft warning).
  2. Move any protocol API keys behind server routes and keep client plugins calling /api/* only.
