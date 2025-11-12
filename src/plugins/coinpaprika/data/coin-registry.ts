/**
 * JSON File Coin Registry
 *
 * Loads coins from coins.json and provides fast indexed lookups
 */

import type { CoinEntry, CoinSearchOptions } from '../types'
import type { ICoinRegistry } from './coin-registry.interface'
import coinsData from './coins.json'

/**
 * JSON-based implementation of ICoinRegistry
 * Loads data from coins.json and builds in-memory indexes
 */
export class JsonFileCoinRegistry implements ICoinRegistry {
  private coins: CoinEntry[] = []
  private symbolIndex: Map<string, CoinEntry[]> = new Map()
  private idIndex: Map<string, CoinEntry> = new Map()
  private initialized = false
  private lastLoadTime = 0
  private readonly CACHE_TTL = 24 * 60 * 60 * 1000 // 24 hours

  async initialize(): Promise<void> {
    // Check if we need to reload
    const now = Date.now()
    if (this.initialized && now - this.lastLoadTime < this.CACHE_TTL) {
      return // Cache is still valid
    }

    console.log('[CoinRegistry] Loading coins data...')
    const startTime = Date.now()

    // Load coins from JSON
    this.coins = coinsData as CoinEntry[]

    // Build indexes
    this.buildIndexes()

    this.initialized = true
    this.lastLoadTime = now

    const loadTime = Date.now() - startTime
    console.log(`[CoinRegistry] Loaded ${this.coins.length} coins in ${loadTime}ms`)
    console.log(`[CoinRegistry] Symbol index size: ${this.symbolIndex.size}`)
  }

  private buildIndexes(): void {
    this.symbolIndex.clear()
    this.idIndex.clear()

    for (const coin of this.coins) {
      // Build symbol index (one symbol can have multiple coins)
      const symbol = coin.symbol.toUpperCase()
      const existing = this.symbolIndex.get(symbol) || []
      this.symbolIndex.set(symbol, [...existing, coin])

      // Build ID index (unique)
      this.idIndex.set(coin.id, coin)
    }
  }

  async resolveSymbol(symbol: string): Promise<string | null> {
    await this.ensureInitialized()

    const normalized = symbol.toUpperCase()
    const matches = this.symbolIndex.get(normalized) || []

    if (matches.length === 0) {
      return null
    }

    // Smart ranking algorithm:
    // 1. Filter to active coins with rank > 0
    // 2. Sort by rank (lower = better)
    // 3. Prefer 'coin' type over 'token'
    // 4. Return the best match

    const activeRanked = matches.filter(c => c.is_active && c.rank > 0)

    if (activeRanked.length === 0) {
      // No active ranked coins, try any active coin
      const anyActive = matches.filter(c => c.is_active)
      if (anyActive.length === 0) {
        // No active coins at all, just return the first one
        return matches[0].id
      }
      return anyActive[0].id
    }

    // Sort by rank and type preference
    const best = activeRanked.sort((a, b) => {
      // Primary: rank (lower is better)
      if (a.rank !== b.rank) {
        return a.rank - b.rank
      }
      // Secondary: prefer 'coin' over 'token'
      if (a.type === 'coin' && b.type !== 'coin') {
        return -1
      }
      if (a.type !== 'coin' && b.type === 'coin') {
        return 1
      }
      return 0
    })[0]

    return best.id
  }

  async searchBySymbol(
    symbol: string,
    options: CoinSearchOptions = {}
  ): Promise<CoinEntry[]> {
    await this.ensureInitialized()

    const normalized = symbol.toUpperCase()
    let matches = this.symbolIndex.get(normalized) || []

    // Apply filters
    if (options.activeOnly) {
      matches = matches.filter(c => c.is_active)
    }

    if (options.ranked) {
      matches = matches.filter(c => c.rank > 0)
    }

    if (options.type) {
      matches = matches.filter(c => c.type === options.type)
    }

    // Sort by rank
    return matches.sort((a, b) => {
      if (a.rank === 0 && b.rank === 0) return 0
      if (a.rank === 0) return 1
      if (b.rank === 0) return -1
      return a.rank - b.rank
    })
  }

  async fuzzySearch(query: string, limit = 20): Promise<CoinEntry[]> {
    await this.ensureInitialized()

    const lowerQuery = query.toLowerCase()

    // Search in both symbol and name
    const matches = this.coins.filter(coin => {
      const symbolMatch = coin.symbol.toLowerCase().includes(lowerQuery)
      const nameMatch = coin.name.toLowerCase().includes(lowerQuery)
      return (symbolMatch || nameMatch) && coin.is_active
    })

    // Sort by relevance:
    // 1. Exact symbol match first
    // 2. Symbol starts with query
    // 3. Name starts with query
    // 4. Rank (lower is better)
    const sorted = matches.sort((a, b) => {
      const aSymbol = a.symbol.toLowerCase()
      const bSymbol = b.symbol.toLowerCase()
      const aName = a.name.toLowerCase()
      const bName = b.name.toLowerCase()

      // Exact symbol match
      if (aSymbol === lowerQuery && bSymbol !== lowerQuery) return -1
      if (bSymbol === lowerQuery && aSymbol !== lowerQuery) return 1

      // Symbol starts with query
      if (aSymbol.startsWith(lowerQuery) && !bSymbol.startsWith(lowerQuery))
        return -1
      if (bSymbol.startsWith(lowerQuery) && !aSymbol.startsWith(lowerQuery))
        return 1

      // Name starts with query
      if (aName.startsWith(lowerQuery) && !bName.startsWith(lowerQuery))
        return -1
      if (bName.startsWith(lowerQuery) && !aName.startsWith(lowerQuery)) return 1

      // Rank (lower is better)
      if (a.rank === 0 && b.rank === 0) return 0
      if (a.rank === 0) return 1
      if (b.rank === 0) return -1
      return a.rank - b.rank
    })

    return sorted.slice(0, limit)
  }

  async getById(id: string): Promise<CoinEntry | null> {
    await this.ensureInitialized()
    return this.idIndex.get(id) || null
  }

  async getAllActive(): Promise<CoinEntry[]> {
    await this.ensureInitialized()
    return this.coins.filter(c => c.is_active)
  }

  async getStats(): Promise<{
    total: number
    active: number
    inactive: number
    coins: number
    tokens: number
  }> {
    await this.ensureInitialized()

    const stats = {
      total: this.coins.length,
      active: 0,
      inactive: 0,
      coins: 0,
      tokens: 0,
    }

    for (const coin of this.coins) {
      if (coin.is_active) stats.active++
      else stats.inactive++

      if (coin.type === 'coin') stats.coins++
      else if (coin.type === 'token') stats.tokens++
    }

    return stats
  }

  private async ensureInitialized(): Promise<void> {
    if (!this.initialized) {
      await this.initialize()
    }
  }
}

// Export singleton instance
export const coinRegistry = new JsonFileCoinRegistry()
