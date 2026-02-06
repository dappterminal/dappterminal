 Security Findings

  - src/lib/auth.ts:95-104 logs both the supplied x-api-key header
    and the configured CLIENT_API_KEY on every authenticated
    request, so a single compromised log stream leaks the secret API
    key and the caller’s key/value pair; strip the key values from
    logs or wrap them in a debug flag and redact before emitting.
  - All analytics endpoints (src/app/api/analytics/user-history/
    route.ts:24-83, src/app/api/analytics/protocol-volume/
    route.ts:17-94, src/app/api/analytics/global-stats/route.ts:17-
    35) skip authenticateRequest, meaning anyone can scrape every
    user’s wallet history and protocol stats; protect them with the
    same API-key gate/rate limiting you use elsewhere or move the
    aggregation behind server-side-only RPCs.
  - Most 1inch proxy routes (src/app/api/1inch/orderbook/limit/
    create/route.ts:1-130, src/app/api/1inch/orderbook/limit/submit/
    route.ts:1-62, src/app/api/1inch/charts/candle/route.ts:1-67,
    src/app/api/1inch/charts/line/route.ts:1-66, src/app/api/1inch/
    swap/classic/quote/route.ts:1-35, src/app/api/1inch/tokens/
    search/route.ts:1-67) are unauthenticated GET/POST endpoints
    that forward requests with your ONEINCH_API_KEY, so any
    anonymous user can burn your quota or spam the limit-order API
    under your key; enforce API key checks and per-IP throttling, or
    proxy through an authenticated backend job instead of exposing
    the raw proxy.
  - The faucet endpoint trusts x-forwarded-for/x-real-ip headers
    directly (src/app/api/faucet/request/route.ts:61-70), so a
    caller can spoof any IP to bypass the rate limiter; rely on
    request.ip or a trusted proxy header provided by your hosting
    platform and reject user-controlled headers.
  - The generic rate limiter is process-local (src/lib/rate-
    limit.ts:15-107), so it resets whenever a serverless worker
    spins up and doesn’t coordinate across instances; in production
    you effectively have no rate limit and multiple dangling
    setIntervals. Move limits to a shared store (Redis/Upstash) or
    use your database as the source of truth.

  Performance / Reliability

  - Token balance formatting and Wormhole quotes cast bigint amounts
    to Number (src/hooks/useTokenBalances.ts:96-107, src/plugins/
    wormhole/handlers.ts:191-208), which overflows past 2^53 and
    silently misreports balances/fees for large positions; replace
    the conversions with formatUnits/viem helpers that operate on
    bigints to keep precision.
  - The CLI component ships dozens of unconditional console.log
    calls (src/components/cli.tsx:421-446, src/components/
    cli.tsx:713-1320) that leak user actions (protocol selection,
    tab names, wallet state) and slow the terminal on every
    keystroke; remove or guard them behind a development flag and
    rely on structured logging if you need analytics.
  - PriceChart caches every request in an ever-growing Map and logs
    full responses (src/components/charts/price-chart.tsx:105-158);
    switching tokens/time ranges for a while leaks memory in the
    browser and floods devtools. Add an LRU/size cap and remove the
    noisy logging once the API is stable.
  - package.json:6-13 forces next build --turbopack, which is still
    experimental for production bundles; the build can silently
    skip optimizations/features that the stable Rust compiler path
    supports. Unless you need a specific Turbopack feature, stick
    with next build for releases and keep Turbopack for dev (next
    dev --turbopack is fine).

  Next steps: 1) lock down the public APIs (analytics + 1inch proxy)
  behind proper auth/rate limits and fix the spoofable IP handling;
  2) correct the bigint math/logging/caching issues and swap back to
  the stable Next build pipeline, then rerun an end-to-end test pass
  once the fixes land.