  ┌──────────┬────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┬────────┐
  │ Priority │                                                        Improvement                                                         │ Effort │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P0       │ Add server-side caching (even simple in-memory TTL cache) to the chart API routes so you don't hammer upstream APIs        │ Small  │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P0       │ Apply rate limiting to chart API routes — the rate limiter exists but isn't wired up                                       │ Small  │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P0       │ Show a clear indicator when displaying mock data vs real data (badge, border color, etc.)                                  │ Small  │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P1       │ Remove fake data sources (Coinbase, Kraken) from the UI or implement them                                                  │ Small  │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P1       │ Use CoinGecko's market_chart endpoint instead of (or alongside) OHLC to get volume data — the client method already exists │ Medium │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P1       │ Replace hardcoded symbol map with CoinGecko's /search or /coins/list endpoint for dynamic resolution                       │ Medium │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P2       │ Add auto-refresh/polling for price charts (the config field exists but is unused)                                          │ Medium │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P2       │ Wire up the PerformanceChart with real protocol analytics data instead of always-mock                                      │ Medium │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P3       │ Add DexScreener API as a data source — free, no API key needed, great for DEX token pairs                                  │ Medium │
  ├──────────┼────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┼────────┤
  │ P3       │ Finish Coinpaprika integration or remove it                                                                                │ Medium │
  └──────────┴────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┴────────┘