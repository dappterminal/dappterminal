/**
 * Simple in-memory TTL cache for server-side API route responses.
 *
 * Keeps upstream API calls (CoinGecko, 1inch, etc.) from being repeated
 * on every request.  Each entry expires after `defaultTTL` milliseconds.
 * A background sweep runs every 60 s to evict stale entries so the Map
 * doesn't grow unbounded.
 */

interface CacheEntry<T> {
  data: T
  expiresAt: number
}

export class TTLCache<T = unknown> {
  private store = new Map<string, CacheEntry<T>>()
  private cleanupTimer: NodeJS.Timeout

  constructor(private defaultTTL: number) {
    // Evict expired entries every 60 s
    this.cleanupTimer = setInterval(() => {
      const now = Date.now()
      for (const [key, entry] of this.store.entries()) {
        if (entry.expiresAt < now) {
          this.store.delete(key)
        }
      }
    }, 60_000)
  }

  /** Return cached value or `undefined` if missing / expired. */
  get(key: string): T | undefined {
    const entry = this.store.get(key)
    if (!entry) return undefined
    if (entry.expiresAt < Date.now()) {
      this.store.delete(key)
      return undefined
    }
    return entry.data
  }

  /** Store a value with an optional per-key TTL override. */
  set(key: string, data: T, ttl?: number): void {
    this.store.set(key, {
      data,
      expiresAt: Date.now() + (ttl ?? this.defaultTTL),
    })
  }

  /** Number of (possibly stale) entries — useful for logging. */
  get size(): number {
    return this.store.size
  }

  destroy(): void {
    clearInterval(this.cleanupTimer)
    this.store.clear()
  }
}

/**
 * Pre-built cache instances for chart data.
 *
 * TTLs are tuned per-source:
 *  - CoinGecko free tier: 30 req/min  ->  cache 2 min
 *  - 1inch charts: generous limits     ->  cache 1 min
 */
export const chartCache = {
  coingecko: new TTLCache(2 * 60_000),   // 2 minutes
  oneInchCandle: new TTLCache(60_000),    // 1 minute
  oneInchLine: new TTLCache(60_000),      // 1 minute
}
