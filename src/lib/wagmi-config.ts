/**
 * Wagmi and RainbowKit configuration
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  mainnet,
  arbitrum,
  base,
  optimism,
  polygon,
} from 'wagmi/chains'

// Get WalletConnect project ID from environment
const projectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || 'demo-project-id'

/**
 * Wagmi configuration with RainbowKit
 */
export const config = getDefaultConfig({
  appName: 'The DeFi Terminal',
  projectId,
  chains: [
    mainnet,
    arbitrum,
    base,
    optimism,
    polygon,
  ],
  ssr: true, // Enable for Next.js
})
