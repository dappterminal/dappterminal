/**
 * LiFi Plugin Types
 *
 * Type definitions for the LiFi bridge aggregator integration
 */

// ============================================================================
// LiFi API Types (subset of official SDK types)
// ============================================================================

export interface LiFiRoute {
  integrator: string | undefined
  id: string
  fromChainId: number
  toChainId: number
  fromTokenAddress: string
  toTokenAddress: string
  fromToken?: LiFiToken
  toToken?: LiFiToken
  fromAmount: string
  toAmount: string
  toAmountMin: string
  steps: LiFiStep[]
  gasCostUSD?: string
  insurance?: {
    state: string
    feeAmountUsd: string
  }
}

export interface LiFiStep {
  id: string
  type: 'lifi' | 'cross' | 'swap' | 'protocol'
  action: LiFiAction
  estimate: LiFiEstimate
  integrator?: string
  execution?: LiFiExecution
  tool?: string
  toolDetails?: {
    key: string
    name: string
    logoURI: string
  }
  includedSteps?: LiFiStep[]
  transactionRequest?: {
    to: string
    from?: string
    data: string
    value: string
    gasLimit?: string
    gasPrice?: string
    chainId: number
  }
  executionType?: string
  transactionId?: string
}

export interface LiFiAction {
  fromChainId: number
  toChainId: number
  fromToken: LiFiToken
  toToken: LiFiToken
  fromAmount: string
  toAmount: string
  slippage: number
  fromAddress: string
  toAddress: string
}

export interface LiFiToken {
  address: string
  chainId: number
  symbol: string
  decimals: number
  name: string
  coinKey?: string
  logoURI?: string
  priceUSD?: string
}

export interface LiFiEstimate {
  fromAmount: string
  toAmount: string
  toAmountMin: string
  approvalAddress: string
  gasCosts?: Array<{
    type: string
    price: string
    estimate: string
    limit: string
    amount: string
    amountUSD: string
    token: LiFiToken
  }>
  feeCosts?: Array<{
    name: string
    description: string
    percentage: string
    token: LiFiToken
    amount: string
    amountUSD: string
    included: boolean
  }>
  executionDuration: number
}

export interface LiFiExecution {
  status: 'NOT_STARTED' | 'PENDING' | 'DONE' | 'FAILED'
  process: Array<{
    type: string
    status: string
    txHash?: string
    txLink?: string
    message?: string
    timestamp?: number
  }>
}

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface LiFiQuoteRequest {
  fromChain: string | number
  toChain: string | number
  fromToken: string
  toToken: string
  fromAmount: string
  fromAddress?: string
  toAddress?: string
  slippage?: number
  allowBridges?: string[]
  denyBridges?: string[]
  allowExchanges?: string[]
  denyExchanges?: string[]
}

export interface LiFiQuoteResponse {
  success: boolean
  data?: {
    routes: LiFiRoute[]
    selectedRoute?: LiFiRoute
  }
  error?: string
}

export interface LiFiStepTransactionRequest {
  route: LiFiRoute
  stepIndex: number
}

export interface LiFiStepTransactionResponse {
  success: boolean
  data?: {
    transactionRequest: {
      to: string
      from: string
      data: string
      value: string
      gasLimit: string
      chainId: number
    }
  }
  error?: string
}

export interface LiFiStatusRequest {
  bridge: string
  fromChain: number
  toChain: number
  txHash: string
}

export interface LiFiStatusResponse {
  success: boolean
  data?: {
    status: 'PENDING' | 'DONE' | 'FAILED'
    substatus?: string
    sending?: {
      txHash: string
      txLink: string
      amount: string
      token: LiFiToken
      chainId: number
    }
    receiving?: {
      txHash: string
      txLink: string
      amount: string
      token: LiFiToken
      chainId: number
    }
    lifiExplorerLink?: string
  }
  error?: string
}

export interface LiFiHealthResponse {
  success: boolean
  data?: {
    valid: boolean
    message?: string
  }
  error?: string
}

// ============================================================================
// Plugin State Types
// ============================================================================

export interface LiFiPluginState extends Record<string, unknown> {
  lastQuote?: {
    routes: LiFiRoute[]
    selectedRoute: LiFiRoute
    timestamp: number
  }
  execution?: {
    routeId: string
    currentStep: number
    txHashes: string[]
    status: 'idle' | 'executing' | 'completed' | 'failed'
    lastUpdated: number
  }
  tokenCache?: Record<string, LiFiToken>
}

// ============================================================================
// Command Result Types
// ============================================================================

export interface LiFiRouteSummary {
  routeId: string
  fromChain: string
  toChain: string
  fromToken: string
  toToken: string
  fromAmount: string
  toAmount: string
  toAmountMin: string
  steps: Array<{
    type: string
    bridge?: string
    dex?: string
    estimatedTime: number
  }>
  totalGasUSD?: string
  totalFeeUSD?: string
  estimatedDuration: number
}
