/**
 * 1inch API Client
 */

export class OneInchAPI {
  private apiKey: string
  private baseUrl = 'https://api.1inch.dev'

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private ensureApiKey(): void {
    if (!this.apiKey) {
      throw new Error('1inch API key is required. Please set ONEINCH_API_KEY environment variable.')
    }
  }

  private async makeRequest(endpoint: string, params?: any): Promise<any> {
    this.ensureApiKey()

    const url = new URL(`${this.baseUrl}${endpoint}`)

    if (params) {
      Object.keys(params).forEach(key => {
        if (params[key] !== undefined) {
          url.searchParams.append(key, params[key])
        }
      })
    }

    const response = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      }
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.description || `1inch API error: ${response.status}`)
    }

    return response.json()
  }

  /**
   * Get swap quote
   */
  async getSwapQuote(params: {
    chainId: number
    src: string
    dst: string
    amount: string
    slippage?: number
  }): Promise<any> {
    const { chainId, src, dst, amount, slippage = 1 } = params

    const data = await this.makeRequest(`/swap/v6.0/${chainId}/quote`, {
      src,
      dst,
      amount,
      includeGas: true,
      includeProtocols: true,
      includeTokensInfo: true,
      slippage,
    })

    return {
      dstAmount: data.dstAmount,
      gas: data.gas,
      srcToken: data.srcToken,
      dstToken: data.dstToken,
      protocols: data.protocols,
    }
  }

  /**
   * Execute swap
   */
  async executeSwap(params: {
    chainId: number
    src: string
    dst: string
    amount: string
    from: string
    slippage?: number
  }): Promise<any> {
    const { chainId, src, dst, amount, from, slippage = 1 } = params

    const data = await this.makeRequest(`/swap/v6.0/${chainId}/swap`, {
      src,
      dst,
      amount,
      from,
      slippage,
      disableEstimate: false,
      allowPartialFill: false,
      includeGas: true,
      includeProtocols: true,
      includeTokensInfo: true,
    })

    return {
      tx: data.tx,
      dstAmount: data.dstAmount,
    }
  }

  /**
   * Get gas price
   */
  async getGasPrice(params: { chainId: number }): Promise<any> {
    const { chainId } = params
    const data = await this.makeRequest(`/gas-price/v1.6/${chainId}`)

    return {
      chainId: chainId.toString(),
      baseFee: data.baseFee,
      low: data.low,
      medium: data.medium,
      high: data.high,
      instant: data.instant,
    }
  }

  /**
   * Get token price in USD
   * Uses the price API with currency=USD parameter
   */
  async getTokenPrice(params: {
    chainId: number
    token: string
  }): Promise<any> {
    const { chainId, token } = params

    // Use the price API with USD currency
    const data = await this.makeRequest(`/price/v1.1/${chainId}`, {
      tokens: token,
      currency: 'USD',
    })

    return data
  }

  /**
   * Get token allowance
   */
  async getAllowance(params: {
    chainId: number
    tokenAddress: string
    walletAddress: string
  }): Promise<any> {
    const { chainId, tokenAddress, walletAddress } = params
    const data = await this.makeRequest(
      `/swap/v6.0/${chainId}/approve/allowance`,
      {
        tokenAddress,
        walletAddress,
      }
    )
    return data
  }

  /**
   * Get approve transaction
   */
  async getApproveTransaction(params: {
    chainId: number
    tokenAddress: string
    amount?: string
  }): Promise<any> {
    const { chainId, tokenAddress, amount } = params
    const data = await this.makeRequest(
      `/swap/v6.0/${chainId}/approve/transaction`,
      {
        tokenAddress,
        ...(amount && { amount }),
      }
    )
    return data
  }
}
