/**
 * Aave v3 data helpers
 *
 * Provides lightweight wrappers around the public Aave market data endpoints
 * with safe fallbacks so commands keep working even when the upstream API is
 * unavailable during development.
 */

export interface AaveMarketSummary {
  id: string
  name: string
  network?: string
  chainId?: number
  totalValueLockedUsd?: number
  totalBorrowsUsd?: number
  baseCurrencySymbol?: string
  activityScore?: number
}

export interface AaveReserveSnapshot {
  id: string
  symbol: string
  name?: string
  underlyingAsset?: string
  totalLiquidityUsd?: number
  availableLiquidityUsd?: number
  utilization?: number
  supplyApy?: number
  variableBorrowApy?: number
  stableBorrowApy?: number
  rewardApr?: number
  priceUsd?: number
}

export interface AaveUserReservePosition {
  id: string
  symbol: string
  name?: string
  suppliedBalanceUsd?: number
  suppliedBalance?: number
  borrowedBalanceUsd?: number
  borrowedBalance?: number
  usageAsCollateralEnabled?: boolean
  supplyApy?: number
  borrowApy?: number
}

export interface AaveUserPositionSummary {
  totalCollateralUsd?: number
  totalDebtUsd?: number
  availableBorrowsUsd?: number
  healthFactor?: number
  loanToValue?: number
  currentLiquidationThreshold?: number
}

export interface AaveUserPosition {
  summary: AaveUserPositionSummary
  reserves: AaveUserReservePosition[]
}

export interface AaveHealthMetrics {
  healthFactor?: number
  liquidationThreshold?: number
  loanToValue?: number
  totalCollateralUsd?: number
  totalDebtUsd?: number
  availableBorrowsUsd?: number
  status: 'healthy' | 'warning' | 'critical'
  maxBorrowUsd?: number
  bufferUntilLiquidationUsd?: number
}

interface AaveApiResponse<T> {
  data?: T
  markets?: T
  reserves?: T
  result?: T
}

const DEFAULT_BASE_URL = `https://api.v3.aave.com/`
const DEFAULT_GRAPHQL_ENDPOINT = 'https://api.v3.aave.com/graphql'
const DEFAULT_MARKET_CHAIN_IDS = [1, 10, 8453, 42161, 137] // Ethereum mainnet, optimism, base, arbitrum, and polygon as default.

const MARKETS_QUERY = `
  query Markets($request: MarketsRequest!) {
    markets(request: $request) {
      name
      chain {
        name
        chainId
      }
      address
      icon
      totalMarketSize
      totalAvailableLiquidity
    }
  }
`

const USER_SUPPLIES_QUERY = `
  query UserSupplies($request: UserSuppliesRequest!) {
    userSupplies(request: $request) {
      market {
        name
        chain {
          chainId
        }
      }
      currency {
        symbol
        name
      }
      balance {
        amount {
          value
        }
        usd
      }
      apy {
        raw
        decimals
        value
        formatted
      }
      isCollateral
      canBeCollateral
    }
  }
`

const USER_BORROWS_QUERY = `
  query UserBorrows($request: UserBorrowsRequest!) {
    userBorrows(request: $request) {
      market {
        name
        chain {
          chainId
        }
      }
      currency {
        symbol
        name
      }
      debt {
        amount {
          value
        }
        usd
      }
      apy {
        raw
        decimals
        value
        formatted
      }
    }
  }
`

interface FetchMarketsOptions {
  chainIds?: number[]
  userAddress?: string
}

/**
 * GraphQL response structure from Aave API
 */
interface AaveGraphQLMarket {
  name: string
  chain: {
    name: string
    chainId: number
  }
  address: string
  icon?: string
  totalMarketSize: number | string
  totalAvailableLiquidity: number | string
}

interface AaveGraphQLMarketsResponse {
  data?: {
    markets?: AaveGraphQLMarket[]
  }
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
  }>
}

/**
 * GraphQL response structures for user positions
 */
interface AaveGraphQLUserSupply {
  market: {
    name: string
    chain: {
      chainId: number
    }
  }
  currency: {
    symbol: string
    name: string
  }
  balance: {
    amount: {
      value: string
    }
    usd: string
  }
  apy: {
    raw: string
    decimals: number
    value: string
    formatted: string
  }
  isCollateral: boolean
  canBeCollateral: boolean
}

interface AaveGraphQLUserBorrow {
  market: {
    name: string
    chain: {
      chainId: number
    }
  }
  currency: {
    symbol: string
    name: string
  }
  debt: {
    amount: {
      value: string
    }
    usd: string
  }
  apy: {
    raw: string
    decimals: number
    value: string
    formatted: string
  }
}

interface AaveGraphQLUserSuppliesResponse {
  data?: {
    userSupplies?: AaveGraphQLUserSupply[]
  }
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
  }>
}

interface AaveGraphQLUserBorrowsResponse {
  data?: {
    userBorrows?: AaveGraphQLUserBorrow[]
  }
  errors?: Array<{
    message: string
    locations?: Array<{ line: number; column: number }>
    path?: string[]
  }>
}

/**
 * Known market addresses for each chain
 */
const KNOWN_MARKETS: Record<number, string> = {
  1: '0x87870Bca3F3fD6335C3F4ce8392D69350B4fA4E2',      // Ethereum
  10: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',     // Optimism
  8453: '0xA238Dd80C259a72e81d7e4664a9801593F98d1c5',   // Base
  42161: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',  // Arbitrum
  137: '0x794a61358D6845594F94dc1DB02A252b5b4814aD',    // Polygon
}

const FALLBACK_MARKETS: AaveMarketSummary[] = [
  {
    id: 'ethereum-v3',
    name: 'Aave v3 Ethereum',
    network: 'ethereum',
    chainId: 1,
    totalValueLockedUsd: 6200000000,
    totalBorrowsUsd: 2600000000,
    baseCurrencySymbol: 'ETH',
    activityScore: 98,
  },
  {
    id: 'polygon-v3',
    name: 'Aave v3 Polygon',
    network: 'polygon',
    chainId: 137,
    totalValueLockedUsd: 2100000000,
    totalBorrowsUsd: 830000000,
    baseCurrencySymbol: 'MATIC',
    activityScore: 82,
  },
  {
    id: 'optimism-v3',
    name: 'Aave v3 Optimism',
    network: 'optimism',
    chainId: 10,
    totalValueLockedUsd: 850000000,
    totalBorrowsUsd: 340000000,
    baseCurrencySymbol: 'ETH',
    activityScore: 74,
  },
  {
    id: 'base-v3',
    name: 'Aave v3 Base',
    network: 'base',
    chainId: 8453,
    totalValueLockedUsd: 690000000,
    totalBorrowsUsd: 280000000,
    baseCurrencySymbol: 'ETH',
    activityScore: 69,
  },
]

const FALLBACK_RESERVES: Record<string, AaveReserveSnapshot[]> = {
  'ethereum-v3': [
    {
      id: 'ETH',
      symbol: 'ETH',
      name: 'Ether',
      underlyingAsset: '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE',
      totalLiquidityUsd: 2100000000,
      availableLiquidityUsd: 480000000,
      utilization: 0.77,
      supplyApy: 2.31,
      variableBorrowApy: 3.98,
      stableBorrowApy: 4.22,
      rewardApr: 0.12,
      priceUsd: 3300,
    },
    {
      id: 'USDC',
      symbol: 'USDC',
      name: 'USD Coin',
      underlyingAsset: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
      totalLiquidityUsd: 1700000000,
      availableLiquidityUsd: 610000000,
      utilization: 0.64,
      supplyApy: 4.12,
      variableBorrowApy: 6.35,
      stableBorrowApy: 7.08,
      rewardApr: 1.05,
      priceUsd: 1,
    },
    {
      id: 'WBTC',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      underlyingAsset: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      totalLiquidityUsd: 430000000,
      availableLiquidityUsd: 92000000,
      utilization: 0.79,
      supplyApy: 1.82,
      variableBorrowApy: 3.47,
      stableBorrowApy: 4.01,
      rewardApr: 0.0,
      priceUsd: 65000,
    },
  ],
  'polygon-v3': [
    {
      id: 'USDC',
      symbol: 'USDC',
      name: 'USD Coin',
      underlyingAsset: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174',
      totalLiquidityUsd: 620000000,
      availableLiquidityUsd: 270000000,
      utilization: 0.56,
      supplyApy: 4.56,
      variableBorrowApy: 6.91,
      stableBorrowApy: 7.45,
      rewardApr: 0.92,
      priceUsd: 1,
    },
    {
      id: 'WMATIC',
      symbol: 'MATIC',
      name: 'Wrapped MATIC',
      underlyingAsset: '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270',
      totalLiquidityUsd: 320000000,
      availableLiquidityUsd: 82000000,
      utilization: 0.74,
      supplyApy: 2.12,
      variableBorrowApy: 4.01,
      stableBorrowApy: 4.87,
      rewardApr: 0.0,
      priceUsd: 0.58,
    },
  ],
}

const FALLBACK_POSITION: AaveUserPosition = {
  summary: {
    totalCollateralUsd: 12500,
    totalDebtUsd: 4200,
    availableBorrowsUsd: 3200,
    healthFactor: 2.35,
    loanToValue: 0.34,
    currentLiquidationThreshold: 0.8,
  },
  reserves: [
    {
      id: 'ETH',
      symbol: 'ETH',
      name: 'Ether',
      suppliedBalanceUsd: 7000,
      suppliedBalance: 2.1,
      borrowedBalanceUsd: 0,
      borrowedBalance: 0,
      usageAsCollateralEnabled: true,
      supplyApy: 2.31,
      borrowApy: undefined,
    },
    {
      id: 'USDC',
      symbol: 'USDC',
      name: 'USD Coin',
      suppliedBalanceUsd: 4500,
      suppliedBalance: 4500,
      borrowedBalanceUsd: 1500,
      borrowedBalance: 1499,
      usageAsCollateralEnabled: true,
      supplyApy: 4.12,
      borrowApy: 6.35,
    },
    {
      id: 'WBTC',
      symbol: 'WBTC',
      name: 'Wrapped Bitcoin',
      suppliedBalanceUsd: 1000,
      suppliedBalance: 0.015,
      borrowedBalanceUsd: 2700,
      borrowedBalance: 0.041,
      usageAsCollateralEnabled: false,
      supplyApy: 1.82,
      borrowApy: 3.47,
    },
  ],
}

/**
 * Fetch helper that gracefully handles upstream failures and malformed payloads.
 */
async function fetchFromAave<T>(
  path: string,
  params?: Record<string, string | number | undefined>
): Promise<T> {
  const baseUrl = DEFAULT_BASE_URL
  const url = new URL(`${baseUrl}${path.startsWith('/') ? path : `/${path}`}`)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') {
        url.searchParams.set(key, String(value))
      }
    }
  }

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'accept': 'application/json',
    },
    cache: 'no-store',
  })

  if (!response.ok) {
    throw new Error(`Aave API request failed (${response.status})`)
  }

  const payload = (await response.json()) as AaveApiResponse<T> | T

  if (Array.isArray(payload)) {
    return payload as T
  }

  if (isAaveApiResponse<T>(payload)) {
    return (
      payload.data ||
      payload.markets ||
      payload.reserves ||
      payload.result ||
      ([] as unknown as T)
    )
  }

  return payload as T
}

function isAaveApiResponse<T>(payload: unknown): payload is AaveApiResponse<T> {
  if (!payload || typeof payload !== 'object') {
    return false
  }
  if ('data' in payload || 'markets' in payload || 'reserves' in payload || 'result' in payload) {
    return true
  }
  return false
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
  }
  return undefined
}

function normalizeRate(value: unknown): number | undefined {
  const numeric = toNumber(value)
  if (numeric === undefined) {
    return undefined
  }

  if (numeric > 1_000_000) {
    // Assume Ray (1e27) precision
    return Number((numeric / 1_000_000_000_000_000_000_000_000_000) * 100)
  }

  if (numeric > 1000) {
    // Assume already scaled percentage but in basis points
    return numeric / 100
  }

  if (numeric <= 1) {
    // Decimal representation (e.g. 0.034)
    return numeric * 100
  }

  return numeric
}

function normalizeUtilization(value: unknown): number | undefined {
  const numeric = toNumber(value)
  if (numeric === undefined) {
    return undefined
  }

  if (numeric > 1 && numeric <= 100) {
    return numeric / 100
  }

  if (numeric > 100) {
    return numeric / 10_000
  }

  return numeric
}

function pickString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === 'string' && value.trim().length > 0) {
      return value
    }
  }
  return undefined
}

/**
 * Fetch all markets with graceful fallback.
 */
export async function fetchMarkets(options?: FetchMarketsOptions): Promise<AaveMarketSummary[]> {
  const opts: FetchMarketsOptions = options ?? {}

  try {
    const markets = await fetchMarketsViaGraphql(opts)
    if (markets.length > 0) {
      return markets
    }
  } catch (error) {
    console.warn('[Aave] GraphQL markets fetch failed, using fallback data:', error)
  }

  return FALLBACK_MARKETS
}

async function fetchMarketsViaGraphql(options: FetchMarketsOptions): Promise<AaveMarketSummary[]> {
  const chainIds =
    options.chainIds && options.chainIds.length > 0
      ? options.chainIds
      : DEFAULT_MARKET_CHAIN_IDS

  const body = {
    query: MARKETS_QUERY,
    variables: {
      request: {
        chainIds,
        ...(options.userAddress ? { user: options.userAddress } : {}),
      },
    },
  }

  const response = await fetch(DEFAULT_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Aave GraphQL markets request failed (${response.status})`)
  }

  const payload: AaveGraphQLMarketsResponse = await response.json()

  if (payload.errors && Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message ?? 'Aave GraphQL markets error')
  }

  const markets = payload?.data?.markets

  if (!Array.isArray(markets) || markets.length === 0) {
    return []
  }

  return markets
    .map((market: AaveGraphQLMarket) => {
      const id = pickString(market.address, market.name)
      
      const name = pickString(market.name)

      if (!id || !name) {
        return undefined
      }

      const totalMarketSize = toNumber(market.totalMarketSize)
      const totalAvailableLiquidity = toNumber(market.totalAvailableLiquidity)

      return {
        id,
        name,
        network: pickString(market.chain?.name),
        chainId: toNumber(market.chain?.chainId),
        totalValueLockedUsd: totalMarketSize ?? undefined,
        totalBorrowsUsd:
          totalMarketSize !== undefined && totalAvailableLiquidity !== undefined
            ? Math.max(totalMarketSize - totalAvailableLiquidity, 0)
            : undefined,
        baseCurrencySymbol: undefined,
        activityScore: undefined,
      } as AaveMarketSummary
    })
    .filter((market): market is AaveMarketSummary => Boolean(market))
}

/**
 * Fetch reserve snapshots for a specific market with graceful fallback.
 */
export async function fetchReserves(marketId: string): Promise<AaveReserveSnapshot[]> {
  const fallback = FALLBACK_RESERVES[marketId] ?? []

  try {
    const reserves = await fetchFromAave<any[]>('/reserves', { marketId, market: marketId })

    if (!Array.isArray(reserves) || reserves.length === 0) {
      return fallback
    }

    return reserves
      .map((reserve) => {
        const symbol = pickString(reserve.symbol, reserve.underlyingSymbol, reserve.assetSymbol)

        if (!symbol) {
          return undefined
        }

        return {
          id: pickString(reserve.id, reserve.underlyingAsset, reserve.address) ?? symbol,
          symbol,
          name: pickString(reserve.name, reserve.assetName, reserve.underlyingName),
          underlyingAsset: pickString(reserve.underlyingAsset, reserve.address),
          totalLiquidityUsd:
            toNumber(reserve.totalLiquidityUsd) ??
            toNumber(reserve.totalLiquidityUSD) ??
            toNumber(reserve.totalLiquidity),
          availableLiquidityUsd:
            toNumber(reserve.availableLiquidityUsd) ??
            toNumber(reserve.availableLiquidityUSD) ??
            toNumber(reserve.availableLiquidity),
          utilization:
            normalizeUtilization(reserve.utilization) ??
            normalizeUtilization(reserve.utilizationRate),
          supplyApy:
            normalizeRate(reserve.supplyAPY) ??
            normalizeRate(reserve.supplyRate) ??
            normalizeRate(reserve.liquidityRate),
          variableBorrowApy:
            normalizeRate(reserve.variableBorrowAPY) ??
            normalizeRate(reserve.variableBorrowRate),
          stableBorrowApy:
            normalizeRate(reserve.stableBorrowAPY) ??
            normalizeRate(reserve.stableBorrowRate),
          rewardApr:
            normalizeRate(reserve.rewardAPR) ??
            normalizeRate(reserve.incentiveAPR) ??
            normalizeRate(reserve.aEmissionAPR),
          priceUsd:
            toNumber(reserve.priceInUsd) ??
            toNumber(reserve.priceUsd) ??
            toNumber(reserve.price) ??
            toNumber(reserve.marketPriceUsd),
        } as AaveReserveSnapshot
      })
      .filter((reserve): reserve is AaveReserveSnapshot => Boolean(reserve))
  } catch (error) {
    console.warn(`[Aave] Reserves fetch failed for ${marketId}, using fallback:`, error)
    return fallback
  }
}

/**
 * Convenience helper returning the same payload used by the rates command.
 */
export async function fetchReserveRates(marketId: string): Promise<AaveReserveSnapshot[]> {
  return fetchReserves(marketId)
}

export async function fetchUserPosition(
  marketId: string,
  userAddress: string,
  options?: { type?: 'supplies' | 'borrows' | 'both' }
): Promise<AaveUserPosition> {
  const fallback = FALLBACK_POSITION
  const type = options?.type || 'both'

  if (!userAddress) {
    return fallback
  }

  try {
    const [supplies, borrows] = await Promise.all([
      type === 'supplies' || type === 'both'
        ? fetchUserSuppliesViaGraphQL(userAddress)
        : Promise.resolve([]),
      type === 'borrows' || type === 'both'
        ? fetchUserBorrowsViaGraphQL(userAddress)
        : Promise.resolve([]),
    ])

    return combineUserPositionData(supplies, borrows)
  } catch (error) {
    console.warn(`[Aave] GraphQL position fetch failed for ${userAddress}, using fallback:`, error)
    return fallback
  }
}

async function fetchUserSuppliesViaGraphQL(
  userAddress: string
): Promise<AaveGraphQLUserSupply[]> {
  const markets = DEFAULT_MARKET_CHAIN_IDS.map(chainId => ({
    address: KNOWN_MARKETS[chainId],
    chainId,
  })).filter(m => m.address) // Filter out any undefined addresses

  const body = {
    query: USER_SUPPLIES_QUERY,
    variables: {
      request: {
        markets,
        user: userAddress,
      },
    },
  }

  const response = await fetch(DEFAULT_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Aave GraphQL userSupplies request failed (${response.status})`)
  }

  const payload: AaveGraphQLUserSuppliesResponse = await response.json()

  if (payload.errors && Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message ?? 'Aave GraphQL userSupplies error')
  }

  return payload?.data?.userSupplies || []
}

async function fetchUserBorrowsViaGraphQL(
  userAddress: string
): Promise<AaveGraphQLUserBorrow[]> {
  const markets = DEFAULT_MARKET_CHAIN_IDS.map(chainId => ({
    address: KNOWN_MARKETS[chainId],
    chainId,
  })).filter(m => m.address) // Filter out any undefined addresses

  const body = {
    query: USER_BORROWS_QUERY,
    variables: {
      request: {
        markets,
        user: userAddress,
      },
    },
  }

  const response = await fetch(DEFAULT_GRAPHQL_ENDPOINT, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'accept': 'application/json',
    },
    cache: 'no-store',
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    throw new Error(`Aave GraphQL userBorrows request failed (${response.status})`)
  }

  const payload: AaveGraphQLUserBorrowsResponse = await response.json()

  if (payload.errors && Array.isArray(payload.errors) && payload.errors.length > 0) {
    throw new Error(payload.errors[0]?.message ?? 'Aave GraphQL userBorrows error')
  }

  return payload?.data?.userBorrows || []
}

function combineUserPositionData(
  supplies: AaveGraphQLUserSupply[],
  borrows: AaveGraphQLUserBorrow[]
): AaveUserPosition {
  const reserves: AaveUserReservePosition[] = []

  // Process supplies
  const supplyMap = new Map<string, AaveGraphQLUserSupply>()
  supplies.forEach(supply => {
    supplyMap.set(supply.currency.symbol, supply)
  })

  // Process borrows
  const borrowMap = new Map<string, AaveGraphQLUserBorrow>()
  borrows.forEach(borrow => {
    borrowMap.set(borrow.currency.symbol, borrow)
  })

  // Combine into reserves
  const allSymbols = new Set([...supplyMap.keys(), ...borrowMap.keys()])

  allSymbols.forEach(symbol => {
    const supply = supplyMap.get(symbol)
    const borrow = borrowMap.get(symbol)

    reserves.push({
      id: symbol,
      symbol,
      name: supply?.currency.name || borrow?.currency.name || symbol,
      suppliedBalanceUsd: supply ? toNumber(supply.balance.usd) : undefined,
      suppliedBalance: supply ? toNumber(supply.balance.amount.value) : undefined,
      borrowedBalanceUsd: borrow ? toNumber(borrow.debt.usd) : undefined,
      borrowedBalance: borrow ? toNumber(borrow.debt.amount.value) : undefined,
      usageAsCollateralEnabled: supply?.isCollateral || false,
      supplyApy: supply ? toNumber(supply.apy.value) : undefined,
      borrowApy: borrow ? toNumber(borrow.apy.value) : undefined,
    })
  })

  // Calculate summary
  const totalCollateralUsd = reserves
    .filter(r => r.usageAsCollateralEnabled)
    .reduce((acc, r) => acc + (r.suppliedBalanceUsd || 0), 0)

  const totalDebtUsd = reserves.reduce((acc, r) => acc + (r.borrowedBalanceUsd || 0), 0)

  // Simple health factor calculation (collateral / debt)
  const healthFactor = totalDebtUsd > 0 ? (totalCollateralUsd * 0.8) / totalDebtUsd : undefined

  return {
    summary: {
      totalCollateralUsd,
      totalDebtUsd,
      availableBorrowsUsd: totalCollateralUsd * 0.8 - totalDebtUsd,
      healthFactor,
      loanToValue: totalCollateralUsd > 0 ? totalDebtUsd / totalCollateralUsd : undefined,
      currentLiquidationThreshold: 0.8,
    },
    reserves,
  }
}

export function calculateHealthMetrics(
  summary: AaveUserPositionSummary
): AaveHealthMetrics {
  const collateral = summary.totalCollateralUsd ?? 0
  const debt = summary.totalDebtUsd ?? 0
  const available = summary.availableBorrowsUsd ?? 0
  const liquidationThreshold = summary.currentLiquidationThreshold ?? 0
  const ltv = summary.loanToValue ?? 0

  let healthFactor = summary.healthFactor
  if ((healthFactor === undefined || Number.isNaN(healthFactor)) && debt > 0) {
    const effectiveCollateral = collateral * liquidationThreshold
    healthFactor = debt > 0 ? effectiveCollateral / debt : undefined
  }

  let status: AaveHealthMetrics['status'] = 'healthy'
  if (healthFactor !== undefined) {
    if (healthFactor < 1.05) {
      status = 'critical'
    } else if (healthFactor < 1.5) {
      status = 'warning'
    } else {
      status = 'healthy'
    }
  }

  const maxBorrowUsd = liquidationThreshold > 0 ? collateral * liquidationThreshold : undefined
  const bufferUntilLiquidationUsd =
    maxBorrowUsd !== undefined ? Math.max(0, maxBorrowUsd - debt) : undefined

  return {
    healthFactor,
    liquidationThreshold,
    loanToValue: ltv,
    totalCollateralUsd: collateral,
    totalDebtUsd: debt,
    availableBorrowsUsd: available,
    status,
    maxBorrowUsd,
    bufferUntilLiquidationUsd,
  }
}

function normalizeUserPositionResponse(payload: any): AaveUserPosition | undefined {
  if (!payload) {
    return undefined
  }

  const root = unwrapDataContainer(payload)

  if (!root) {
    return undefined
  }

  let summarySource: any
  let reservesSource: any

  if (Array.isArray(root)) {
    reservesSource = root
  } else if (root && typeof root === 'object') {
    summarySource =
      root.summary ||
      root.userSummary ||
      root.positionSummary ||
      root.overview ||
      root.accountSummary

    reservesSource =
      root.reserves ||
      root.userReserves ||
      root.assets ||
      root.positions ||
      root.userAssets ||
      (Array.isArray(root.data) ? root.data : undefined)

    if (!summarySource && root.positions && typeof root.positions === 'object') {
      const nested = root.positions
      summarySource =
        nested.summary ||
        nested.userSummary ||
        nested.overview
      reservesSource =
        reservesSource ||
        nested.reserves ||
        nested.userReserves ||
        nested.assets
    }

    if (!reservesSource && Array.isArray(root.positions)) {
      reservesSource = root.positions
    }
  }

  const reserves = normalizeReservePositions(reservesSource)
  const summary = normalizeUserSummary(summarySource, reserves)

  if (!summary && reserves.length === 0) {
    return undefined
  }

  return {
    summary: summary ?? {
      totalCollateralUsd: reserves.reduce((acc, reserve) => acc + (reserve.suppliedBalanceUsd ?? 0), 0),
      totalDebtUsd: reserves.reduce((acc, reserve) => acc + (reserve.borrowedBalanceUsd ?? 0), 0),
      availableBorrowsUsd: undefined,
      healthFactor: undefined,
      loanToValue: undefined,
      currentLiquidationThreshold: undefined,
    },
    reserves,
  }
}

function unwrapDataContainer(payload: any): any {
  if (!payload) {
    return payload
  }

  if (payload.data) {
    return payload.data
  }

  if (payload.result) {
    return payload.result
  }

  if (payload.positions) {
    return payload.positions
  }

  return payload
}

function normalizeUserSummary(
  source: any,
  reserves: AaveUserReservePosition[]
): AaveUserPositionSummary | undefined {
  if (!source || typeof source !== 'object') {
    if (!reserves.length) {
      return undefined
    }

    const collateral = reserves.reduce((acc, reserve) => acc + (reserve.suppliedBalanceUsd ?? 0), 0)
    const debt = reserves.reduce((acc, reserve) => acc + (reserve.borrowedBalanceUsd ?? 0), 0)

    return {
      totalCollateralUsd: collateral,
      totalDebtUsd: debt,
      availableBorrowsUsd: undefined,
      healthFactor: debt > 0 ? (collateral > 0 ? (collateral * 0.8) / debt : undefined) : undefined,
      loanToValue: collateral > 0 ? debt / collateral : undefined,
      currentLiquidationThreshold: 0.8,
    }
  }

  return {
    totalCollateralUsd:
      toNumber(source.totalCollateralUsd) ??
      toNumber(source.totalCollateralUSD) ??
      toNumber(source.totalCollateralInUsd),
    totalDebtUsd:
      toNumber(source.totalDebtUsd) ??
      toNumber(source.totalDebtUSD) ??
      toNumber(source.totalBorrowsUsd) ??
      toNumber(source.totalBorrowsUSD),
    availableBorrowsUsd:
      toNumber(source.availableBorrowsUsd) ??
      toNumber(source.availableBorrowsUSD) ??
      toNumber(source.availableBorrows) ??
      toNumber(source.availableBorrowsBase),
    healthFactor:
      toNumber(source.healthFactor) ??
      toNumber(source.healthfactor) ??
      toNumber(source.currentHealthFactor),
    loanToValue:
      toNumber(source.loanToValue) ??
      toNumber(source.ltv),
    currentLiquidationThreshold:
      toNumber(source.currentLiquidationThreshold) ??
      toNumber(source.liquidationThreshold) ??
      toNumber(source.maxLiquidationThreshold),
  }
}

function normalizeReservePositions(source: any): AaveUserReservePosition[] {
  if (!source) {
    return []
  }

  const reservesArray = Array.isArray(source) ? source : Array.isArray(source.positions) ? source.positions : []

  return reservesArray
    .map((item: any) => {
      const symbol = pickString(
        item.symbol,
        item.reserveSymbol,
        item.assetSymbol,
        item.underlyingSymbol
      )

      if (!symbol) {
        return undefined
      }

      return {
        id: pickString(item.id, item.reserveId, item.assetId, item.underlyingAsset) ?? symbol,
        symbol,
        name: pickString(item.name, item.reserveName, item.assetName),
        suppliedBalanceUsd:
          toNumber(item.supplyBalanceUsd) ??
          toNumber(item.suppliedBalanceUsd) ??
          toNumber(item.underlyingBalanceUsd) ??
          toNumber(item.suppliedUsd),
        suppliedBalance:
          toNumber(item.supplyBalance) ??
          toNumber(item.underlyingBalance) ??
          toNumber(item.supplied),
        borrowedBalanceUsd:
          toNumber(item.borrowBalanceUsd) ??
          toNumber(item.borrowedBalanceUsd) ??
          toNumber(item.variableBorrowBalanceUsd) ??
          toNumber(item.borrowedUsd),
        borrowedBalance:
          toNumber(item.borrowBalance) ??
          toNumber(item.borrowedBalance) ??
          toNumber(item.variableBorrowBalance) ??
          toNumber(item.borrowed),
        usageAsCollateralEnabled:
          Boolean(item.usageAsCollateralEnabledOnUser ?? item.usageAsCollateralEnabled ?? item.isCollateral),
        supplyApy:
          normalizeRate(item.supplyAPY) ??
          normalizeRate(item.supplyRate) ??
          normalizeRate(item.liquidityRate),
        borrowApy:
          normalizeRate(item.borrowAPY) ??
          normalizeRate(item.borrowRate) ??
          normalizeRate(item.variableBorrowRate),
      } as AaveUserReservePosition
    })
    .filter((reserve: AaveUserReservePosition | undefined): reserve is AaveUserReservePosition => Boolean(reserve))
}
