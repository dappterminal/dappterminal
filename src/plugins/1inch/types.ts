/**
 * 1inch Plugin Types
 */

// Swap Quote
export interface SwapQuoteParams {
  chainId: number
  src: string
  dst: string
  amount: string
  slippage?: number
}

export interface SwapQuoteResponse {
  dstAmount: string
  gas?: string
  srcToken: any
  dstToken: any
  protocols?: any
}

// Swap Execute
export interface SwapExecuteParams {
  chainId: number
  src: string
  dst: string
  amount: string
  from: string
  slippage?: number
}

export interface SwapExecuteResponse {
  tx: {
    from: string
    to: string
    data: string
    value: string
    gas: string
  }
  dstAmount: string
}

// Gas Price
export interface GasPriceParams {
  chainId: number
}

export interface GasPriceResponse {
  chainId: string
  baseFee?: string
  low?: {
    maxFeePerGas: string
    maxPriorityFeePerGas: string
  }
  medium?: {
    maxFeePerGas: string
    maxPriorityFeePerGas: string
  }
  high?: {
    maxFeePerGas: string
    maxPriorityFeePerGas: string
  }
  instant?: {
    maxFeePerGas: string
    maxPriorityFeePerGas: string
  }
}

// Token Price
export interface TokenPriceParams {
  chainId: number
  token: string
}

export interface TokenPriceResponse {
  [tokenAddress: string]: string
}
