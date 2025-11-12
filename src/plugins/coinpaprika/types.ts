/**
 * CoinPaprika Plugin Types
 */

/**
 * Coin entry from coins list API
 */
export interface CoinEntry {
  id: string        // 'btc-bitcoin'
  name: string      // 'Bitcoin'
  symbol: string    // 'BTC'
  rank: number      // Market cap rank (0 = unranked)
  is_new: boolean   // Recently added
  is_active: boolean // Active trading
  type: string      // 'coin' or 'token'
}

/**
 * Ticker response from CoinPaprika API
 */
export interface TickerResponse {
  id: string
  name: string
  symbol: string
  rank: number
  circulating_supply: number
  total_supply: number
  max_supply: number
  beta_value: number
  first_data_at: string
  last_updated: string
  quotes: {
    USD: {
      price: number
      volume_24h: number
      volume_24h_change_24h: number
      market_cap: number
      market_cap_change_24h: number
      percent_change_15m: number
      percent_change_30m: number
      percent_change_1h: number
      percent_change_6h: number
      percent_change_12h: number
      percent_change_24h: number
      percent_change_7d: number
      percent_change_30d: number
      percent_change_1y: number
      ath_price: number
      ath_date: string
      percent_from_price_ath: number
    }
  }
}

/**
 * OHLCV data point for charts
 */
export interface OHLCVDataPoint {
  time_open: string
  time_close: string
  open: number
  high: number
  low: number
  close: number
  volume: number
  market_cap: number
}

/**
 * Coin detailed information
 */
export interface CoinInfo {
  id: string
  name: string
  symbol: string
  rank: number
  is_new: boolean
  is_active: boolean
  type: string
  logo: string
  tags: Array<{
    id: string
    name: string
    coin_counter: number
    ico_counter: number
  }>
  team: Array<{
    id: string
    name: string
    position: string
  }>
  description: string
  message: string
  open_source: boolean
  started_at: string
  development_status: string
  hardware_wallet: boolean
  proof_type: string
  org_structure: string
  hash_algorithm: string
  links: {
    explorer: string[]
    facebook: string[]
    reddit: string[]
    source_code: string[]
    website: string[]
    youtube: string[]
  }
  links_extended: Array<{
    url: string
    type: string
    stats?: {
      subscribers?: number
      contributors?: number
      stars?: number
      followers?: number
    }
  }>
  whitepaper: {
    link: string
    thumbnail: string
  }
  first_data_at: string
  last_data_at: string
}

/**
 * Search options for coin registry
 */
export interface CoinSearchOptions {
  activeOnly?: boolean
  ranked?: boolean
  type?: 'coin' | 'token'
}
