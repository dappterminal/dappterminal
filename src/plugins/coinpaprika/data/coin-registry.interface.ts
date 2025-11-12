/**
 * Coin Registry Interface
 *
 * Abstraction layer for coin data access.
 * Implementations can use JSON files, databases, or APIs.
 */

import type { CoinEntry, CoinSearchOptions } from '../types'

export interface ICoinRegistry {
  /**
   * Initialize the registry (load data, build indexes, etc.)
   */
  initialize(): Promise<void>

  /**
   * Resolve a symbol to a CoinPaprika coin ID
   * Uses smart ranking to pick the best match
   *
   * @param symbol - Coin symbol (e.g., 'BTC', 'ETH')
   * @returns CoinPaprika ID (e.g., 'btc-bitcoin') or null if not found
   */
  resolveSymbol(symbol: string): Promise<string | null>

  /**
   * Search for coins by symbol
   * Returns all matches, sorted by rank
   *
   * @param symbol - Coin symbol to search for
   * @param options - Search filters
   * @returns Array of matching coins
   */
  searchBySymbol(
    symbol: string,
    options?: CoinSearchOptions
  ): Promise<CoinEntry[]>

  /**
   * Fuzzy search coins by name or symbol
   *
   * @param query - Search query
   * @param limit - Maximum number of results (default: 20)
   * @returns Array of matching coins
   */
  fuzzySearch(query: string, limit?: number): Promise<CoinEntry[]>

  /**
   * Get coin by CoinPaprika ID
   *
   * @param id - CoinPaprika coin ID (e.g., 'btc-bitcoin')
   * @returns Coin entry or null if not found
   */
  getById(id: string): Promise<CoinEntry | null>

  /**
   * Get all active coins
   *
   * @returns Array of active coins
   */
  getAllActive(): Promise<CoinEntry[]>

  /**
   * Get registry statistics
   */
  getStats(): Promise<{
    total: number
    active: number
    inactive: number
    coins: number
    tokens: number
  }>
}
