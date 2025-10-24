/**
 * 1inch Orderbook and Limit Order Utilities
 */

/**
 * Convert native token addresses to wrapped token addresses for 1inch limit orders
 * Native token placeholder (0xEee...) needs to be converted to wrapped token (WETH, WMATIC, etc.)
 */
export const getProperTokenAddress = (token: { address: string }, chainId: number): string => {
  if (token.address === '0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE') {
    const wethAddresses: Record<number, string> = {
      1: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // Ethereum - WETH
      10: '0x4200000000000000000000000000000000000006', // Optimism - WETH
      42161: '0x82aF49447D8a07e3bd95BD0d56f35241523fBab1', // Arbitrum - WETH
      137: '0x0d500B1d8E8eF31E21C99d1Db9A6444d3ADf1270', // Polygon - WMATIC
      56: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', // BSC - WBNB
      8453: '0x4200000000000000000000000000000000000006', // Base - WETH
      43114: '0xB31f66AA3C1e785363F0875A1B74E27b85FD66c7', // Avalanche - WAVAX
    }
    return wethAddresses[chainId] || wethAddresses[1]
  }
  return token.address
}
