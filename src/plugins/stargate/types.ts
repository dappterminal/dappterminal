/**
 * Stargate Bridge Types
 */

/**
 * Transaction step from Stargate API
 */
export interface StargateStep {
  type: string
  transaction?: {
    to?: `0x${string}`
    data?: `0x${string}`
    value?: string
    gas?: string
    gasLimit?: string
  }
}

/**
 * Stargate quote response from their API
 */
export interface StargateQuoteResponse {
  quotes?: StargateQuote[]
  dstAmount?: string
  amountLD?: string
  steps?: StargateStep[]
}

/**
 * Individual quote within response
 */
export interface StargateQuote {
  dstAmount?: string
  amountLD?: string
  steps?: StargateStep[]
  srcChainId?: number
  dstChainId?: number
  srcToken?: string
  dstToken?: string
}

/**
 * Bridge request data returned from command
 */
export interface BridgeRequestData {
  bridgeRequest: true
  fromToken: string
  toToken: string
  fromChain: number
  toChain: number
  amount: string
  amountIn: string
  amountOut: string
  walletAddress: string
  stargateSteps: StargateStep[]
  slippage: number
}

/**
 * Quote API request parameters
 */
export interface QuoteRequestParams {
  fromChainId: number
  toChainId: number
  fromTokenAddress: string
  toTokenAddress: string
  fromAmount: string
  fromAddress: string
  toAddress: string
  slippage?: number
}
