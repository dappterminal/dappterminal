/**
 * Aave v3 protocol commands
 */

import type { Command, CommandResult, ExecutionContext } from '@/core'
import type { AaveUserPosition, AaveHealthMetrics } from '@/lib/aave'

interface MarketsResponse {
  success?: boolean
  data?: {
    markets?: MarketSummary[]
    count?: number
  } | MarketSummary[]
  markets?: MarketSummary[]
}

interface MarketSummary {
  id: string
  name: string
  network?: string
  chainId?: number
  totalValueLockedUsd?: number
  totalBorrowsUsd?: number
  baseCurrencySymbol?: string
  activityScore?: number
}

interface RatesResponse {
  success?: boolean
  data?: {
    marketId?: string
    rates?: ReserveRate[]
  } | ReserveRate[]
  rates?: ReserveRate[]
}

interface ReserveRate {
  id: string
  symbol: string
  supplyApy?: number
  variableBorrowApy?: number
  stableBorrowApy?: number
  rewardApr?: number
}

interface PositionResponse {
  success?: boolean
  data?: {
    marketId?: string
    address?: string
    position?: AaveUserPosition
    health?: AaveHealthMetrics
  }
  position?: AaveUserPosition
}

interface HealthResponse {
  success?: boolean
  data?: {
    marketId?: string
    address?: string
    health?: AaveHealthMetrics
  }
  health?: AaveHealthMetrics
}

const DEFAULT_MARKET_ID = 'ethereum-v3'

/**
 * markets command — list all supported Aave markets
 */
export const marketsCommand: Command = {
  id: 'markets',
  scope: 'G_p',
  protocol: 'aave-v3',
  description: 'List available Aave v3 markets and high-level metrics',
  aliases: ['m'],

  async run(args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    try {
      const { limit } = parseCommonOptions(args)

      const response = await fetch('/api/aave-v3/markets', {
        method: 'GET',
        headers: {
          'accept': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          error: new Error(`Failed to fetch markets (status ${response.status})`),
        }
      }

      const payload: MarketsResponse = await response.json()
      const markets = extractMarkets(payload)

      if (!markets.length) {
        return {
          success: false,
          error: new Error('No markets returned from Aave data service'),
        }
      }

      const lines: string[] = ['Aave v3 Markets', '']
      const slice = markets.slice(0, limit ?? markets.length)

      slice.forEach((market) => {
        const tvl = formatUsd(market.totalValueLockedUsd)
        const debt = formatUsd(market.totalBorrowsUsd)
        const activity = market.activityScore !== undefined
          ? `${market.activityScore.toFixed(0)}`
          : '—'

        lines.push(`  ${market.name}`)
        lines.push(
          `    ID: ${market.id} | Network: ${market.network ?? '—'} | Chain ID: ${market.chainId ?? '—'}`
        )
        lines.push(`    TVL: ${tvl} | Borrows: ${debt} | Activity: ${activity}`)
        lines.push('')
      })

      lines.push(`Total markets: ${markets.length}`)
      if (limit && markets.length > limit) {
        lines.push(`Showing first ${limit}. Use --limit <n> to adjust.`)
      }

      return {
        success: true,
        value: lines.join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}


/**
 * rates command — display APY snapshot for a market
 *
 * Usage: rates [<marketId>] [--limit <n>]
 */
export const ratesCommand: Command = {
  id: 'rates',
  scope: 'G_p',
  protocol: 'aave-v3',
  description: 'Show supply and borrow APYs for an Aave market',
  aliases: ['apr'],

  async run(args: unknown, _context: ExecutionContext): Promise<CommandResult> {
    try {
      const { marketId, limit } = parseMarketOptions(args)

      const response = await fetch(`/api/aave-v3/rates?market=${encodeURIComponent(marketId)}`, {
        method: 'GET',
        headers: {
          'accept': 'application/json',
        },
      })

      if (!response.ok) {
        return {
          success: false,
          error: new Error(`Failed to fetch rates for ${marketId} (status ${response.status})`),
        }
      }

      const payload: RatesResponse = await response.json()
      const rates = extractRates(payload)

      if (!rates.length) {
        return {
          success: false,
          error: new Error(`No rates returned for market ${marketId}`),
        }
      }

      const sorted = [...rates].sort((a, b) => {
        const aSupply = a.supplyApy ?? 0
        const bSupply = b.supplyApy ?? 0
        return bSupply - aSupply
      })

      const slice = sorted.slice(0, limit ?? sorted.length)

      const lines: string[] = [`Aave v3 Rates — ${marketId}`, '']

      slice.forEach((reserve) => {
        const supply = formatPercent(reserve.supplyApy)
        const variable = formatPercent(reserve.variableBorrowApy)
        const stable = formatPercent(reserve.stableBorrowApy)
        const reward = formatPercent(reserve.rewardApr)

        lines.push(`  ${reserve.symbol}`)
        lines.push(`    Supply APY: ${supply}`)
        lines.push(`    Variable Borrow APY: ${variable}`)
        lines.push(`    Stable Borrow APY: ${stable}`)
        lines.push(`    Incentives APR: ${reward}`)
        lines.push('')
      })

      lines.push(`Total reserves with rates: ${rates.length}`)
      if (limit && rates.length > limit) {
        lines.push(`Showing top ${limit}. Use --limit <n> to adjust.`)
      }

      return {
        success: true,
        value: lines.join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}

/**
 * position command — display user balances for a market
 *
 * Usage: position [--network <name>] [--address 0x...] [--limit <n>]
 */
export const positionCommand: Command = {
  id: 'position',
  scope: 'G_p',
  protocol: 'aave-v3',
  description: 'Show supplied and borrowed balances for your Aave account',
  aliases: ['pos'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const { limit } = parseMarketOptions(args)
      const address = parseAddressOption(args, context.wallet.address)
      const network = parseNetworkOption(args, context.wallet.chainId)

      if (!address) {
        return {
          success: false,
          error: new Error('Wallet address required. Connect your wallet or pass --address 0x...'),
        }
      }

      const networkName = getNetworkName(network)
      const marketId = network ? `${networkName}-v3` : DEFAULT_MARKET_ID

      const response = await fetch(
        `/api/aave-v3/position?market=${encodeURIComponent(marketId)}&address=${encodeURIComponent(address)}`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        return {
          success: false,
          error: new Error(`Failed to fetch position for ${address} on ${networkName} (status ${response.status})`),
        }
      }

      const payload: PositionResponse = await response.json()
      const position = extractPosition(payload)
      const health = extractHealth(payload)

      if (!position) {
        return {
          success: false,
          error: new Error(`No position data returned for ${address} on ${networkName}`),
        }
      }

      const summary = position.summary
      const reserves = [...position.reserves].sort((a, b) => {
        const aTvl = (a.suppliedBalanceUsd ?? 0) + (a.borrowedBalanceUsd ?? 0)
        const bTvl = (b.suppliedBalanceUsd ?? 0) + (b.borrowedBalanceUsd ?? 0)
        return bTvl - aTvl
      })

      const slice = reserves.slice(0, limit ?? reserves.length)
      const lines: string[] = [
        `Aave v3 Position — ${networkName}`,
        `Address: ${shortAddress(address)}`,
        '',
        `Total Collateral: ${formatUsd(summary.totalCollateralUsd)}`,
        `Total Debt: ${formatUsd(summary.totalDebtUsd)}`,
        `Available Borrows: ${formatUsd(summary.availableBorrowsUsd)}`,
      ]

      if (health?.healthFactor !== undefined) {
        lines.push(
          `Health Factor: ${formatHealthValue(health.healthFactor)} (${formatHealthStatus(health.status)})`
        )
      }

      lines.push('')
      lines.push('Reserves:')
      lines.push('')

      if (!slice.length) {
        lines.push('  No active reserves')
      } else {
        slice.forEach((reserve) => {
          const suppliedUsd = formatUsd(reserve.suppliedBalanceUsd)
          const borrowedUsd = formatUsd(reserve.borrowedBalanceUsd)
          const supplied = formatTokenAmount(reserve.suppliedBalance)
          const borrowed = formatTokenAmount(reserve.borrowedBalance)
          const supplyApr = formatPercent(reserve.supplyApy)
          const borrowApr = formatPercent(reserve.borrowApy)
          const collateralFlag = reserve.usageAsCollateralEnabled ? '✅ Collateral' : '— Not collateral'

          lines.push(`  ${reserve.symbol}${reserve.name ? ` (${reserve.name})` : ''}`)
          lines.push(
            `    Supplied: ${suppliedUsd}${supplied ? ` (${supplied})` : ''} | Borrowed: ${borrowedUsd}${borrowed ? ` (${borrowed})` : ''}`
          )
          lines.push(`    ${collateralFlag} | Supply APY: ${supplyApr} | Borrow APY: ${borrowApr}`)
          lines.push('')
        })

        lines.push(`Reserves shown: ${slice.length} / ${position.reserves.length}`)
        if (limit && position.reserves.length > limit) {
          lines.push(`Use --limit <n> to adjust output.`)
        }
      }

      return {
        success: true,
        value: lines.join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}

/**
 * health command — display health factor and liquidation buffer
 *
 * Usage: health [<marketId>] [--address 0x...]
 */
export const healthCommand: Command = {
  id: 'health',
  scope: 'G_p',
  protocol: 'aave-v3',
  description: 'Show health factor, borrow limits, and liquidation buffer',
  aliases: ['hf'],

  async run(args: unknown, context: ExecutionContext): Promise<CommandResult> {
    try {
      const { marketId } = parseMarketOptions(args)
      const address = parseAddressOption(args, context.wallet.address)

      if (!address) {
        return {
          success: false,
          error: new Error('Wallet address required. Connect your wallet or pass --address 0x...'),
        }
      }

      const response = await fetch(
        `/api/aave-v3/health?market=${encodeURIComponent(marketId)}&address=${encodeURIComponent(address)}`,
        {
          method: 'GET',
          headers: {
            'accept': 'application/json',
          },
        }
      )

      if (!response.ok) {
        return {
          success: false,
          error: new Error(`Failed to fetch health metrics (status ${response.status})`),
        }
      }

      const payload: HealthResponse = await response.json()
      const health = extractHealth(payload)

      if (!health) {
        return {
          success: false,
          error: new Error('No health metrics returned by API'),
        }
      }

      const lines: string[] = [
        `Aave v3 Health — ${marketId}`,
        `Address: ${shortAddress(address)}`,
        '',
        `Health Factor: ${formatHealthValue(health.healthFactor)} (${formatHealthStatus(health.status)})`,
        `Total Collateral: ${formatUsd(health.totalCollateralUsd)}`,
        `Total Debt: ${formatUsd(health.totalDebtUsd)}`,
        `Available Borrows: ${formatUsd(health.availableBorrowsUsd)}`,
        `Max Borrow Allowed: ${formatUsd(health.maxBorrowUsd)}`,
        `Buffer Until Liquidation: ${formatUsd(health.bufferUntilLiquidationUsd)}`,
        `Loan-to-Value: ${formatPercent(health.loanToValue)}`,
        `Liquidation Threshold: ${formatPercent(health.liquidationThreshold)}`,
      ]

      return {
        success: true,
        value: lines.join('\n'),
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error : new Error(String(error)),
      }
    }
  },
}

/**
 * Helpers
 */

interface CommonOptions {
  marketId: string
  limit?: number
}

function parseCommonOptions(args: unknown): { limit?: number } {
  const tokens = tokenizeArgs(args)
  let limit: number | undefined

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === '--limit' && tokens[i + 1]) {
      limit = clampLimit(Number(tokens[i + 1]))
      i++
      continue
    }

    if (token.startsWith('--limit=')) {
      limit = clampLimit(Number(token.split('=')[1]))
      continue
    }
  }

  return { limit }
}

function parseMarketOptions(args: unknown): CommonOptions {
  const tokens = tokenizeArgs(args)
  let marketId: string | undefined
  let limit: number | undefined

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (!marketId && !token.startsWith('--')) {
      marketId = token
      continue
    }

    if (token === '--market' && tokens[i + 1]) {
      marketId = tokens[i + 1]
      i++
      continue
    }

    if (token.startsWith('--market=')) {
      marketId = token.split('=')[1]
      continue
    }

    if (token === '--limit' && tokens[i + 1]) {
      limit = clampLimit(Number(tokens[i + 1]))
      i++
      continue
    }

    if (token.startsWith('--limit=')) {
      limit = clampLimit(Number(token.split('=')[1]))
      continue
    }
  }

  return {
    marketId: marketId || DEFAULT_MARKET_ID,
    limit,
  }
}

function tokenizeArgs(args: unknown): string[] {
  if (typeof args !== 'string') {
    return []
  }
  return args
    .split(/\s+/)
    .map((token) => token.trim())
    .filter(Boolean)
}

function clampLimit(value: number): number | undefined {
  if (!Number.isFinite(value) || value <= 0) {
    return undefined
  }
  return Math.max(1, Math.min(50, Math.floor(value)))
}

function formatUsd(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—'
  }

  const abs = Math.abs(value)

  if (abs >= 1_000_000_000) {
    return `$${(value / 1_000_000_000).toFixed(2)}B`
  }

  if (abs >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(2)}M`
  }

  if (abs >= 1_000) {
    return `$${(value / 1_000).toFixed(2)}K`
  }

  return `$${value.toFixed(2)}`
}

function formatPercent(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—'
  }

  const numeric = value <= 1 ? value * 100 : value
  return `${numeric.toFixed(2)}%`
}

function formatTokenAmount(value?: number): string | undefined {
  if (value === undefined || Number.isNaN(value)) {
    return undefined
  }
  if (Math.abs(value) >= 1) {
    return value.toFixed(2)
  }
  if (Math.abs(value) >= 0.01) {
    return value.toFixed(4)
  }
  return value.toFixed(6)
}

function formatHealthValue(value?: number): string {
  if (value === undefined || Number.isNaN(value)) {
    return '—'
  }
  return value.toFixed(2)
}

function formatHealthStatus(status?: AaveHealthMetrics['status']): string {
  switch (status) {
    case 'healthy':
      return '✅ Healthy'
    case 'warning':
      return '⚠️ Warning'
    case 'critical':
      return '🔴 Critical'
    default:
      return '—'
  }
}

function parseAddressOption(args: unknown, defaultAddress?: string | null): string | undefined {
  const tokens = tokenizeArgs(args)
  let address: string | undefined

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === '--address' && tokens[i + 1]) {
      address = tokens[i + 1]
      i++
      continue
    }

    if (token === '-a' && tokens[i + 1]) {
      address = tokens[i + 1]
      i++
      continue
    }

    if (token.startsWith('--address=')) {
      address = token.split('=')[1]
      continue
    }
  }

  if (address) {
    return address
  }

  if (defaultAddress) {
    return defaultAddress
  }

  return undefined
}

function shortAddress(address: string): string {
  if (!address.startsWith('0x') || address.length <= 10) {
    return address
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`
}

function extractMarkets(payload: MarketsResponse): MarketSummary[] {
  if (!payload) {
    return []
  }

  const { data } = payload

  if (Array.isArray(data)) {
    return data
  }

  if (data && Array.isArray(data.markets)) {
    return data.markets
  }

  if (Array.isArray(payload.markets)) {
    return payload.markets
  }

  return []
}

function extractPosition(payload: PositionResponse): AaveUserPosition | undefined {
  if (!payload) {
    return undefined
  }

  if (payload.data?.position) {
    return payload.data.position
  }

  if (payload.position) {
    return payload.position
  }

  return undefined
}

function extractHealth(payload: PositionResponse | HealthResponse): AaveHealthMetrics | undefined {
  if (!payload) {
    return undefined
  }

  if ('data' in payload && payload.data && 'health' in payload.data) {
    return payload.data.health ?? undefined
  }

  if ('health' in payload && payload.health) {
    return payload.health
  }

  return undefined
}

function extractRates(payload: RatesResponse): ReserveRate[] {
  if (!payload) {
    return []
  }

  const { data } = payload

  if (Array.isArray(data)) {
    return data
  }

  if (data && Array.isArray(data.rates)) {
    return data.rates
  }

  if (Array.isArray(payload.rates)) {
    return payload.rates
  }

  return []
}

function parseNetworkOption(args: unknown, defaultChainId?: number | null): number | undefined {
  const tokens = tokenizeArgs(args)
  let network: string | undefined

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i]

    if (token === '--network' && tokens[i + 1]) {
      network = tokens[i + 1].toLowerCase()
      i++
      continue
    }

    if (token === '-n' && tokens[i + 1]) {
      network = tokens[i + 1].toLowerCase()
      i++
      continue
    }

    if (token.startsWith('--network=')) {
      network = token.split('=')[1].toLowerCase()
      continue
    }
  }

  if (network) {
    return networkNameToChainId(network)
  }

  if (defaultChainId) {
    return defaultChainId
  }

  return undefined
}

function networkNameToChainId(name: string): number | undefined {
  const normalized = name.toLowerCase()

  switch (normalized) {
    case 'ethereum':
    case 'eth':
    case 'mainnet':
      return 1
    case 'optimism':
    case 'op':
      return 10
    case 'base':
      return 8453
    case 'arbitrum':
    case 'arb':
      return 42161
    case 'polygon':
    case 'matic':
      return 137
    default:
      // Try to parse as number (chain ID)
      const chainId = Number(normalized)
      if (Number.isFinite(chainId)) {
        return chainId
      }
      return undefined
  }
}

function getNetworkName(chainId?: number): string {
  if (!chainId) {
    return 'ethereum'
  }

  switch (chainId) {
    case 1:
      return 'ethereum'
    case 10:
      return 'optimism'
    case 8453:
      return 'base'
    case 42161:
      return 'arbitrum'
    case 137:
      return 'polygon'
    default:
      return `chain-${chainId}`
  }
}
