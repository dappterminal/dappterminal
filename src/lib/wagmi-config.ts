/**
 * Wagmi and RainbowKit configuration
 */

import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import {
  metaMaskWallet,
  rainbowWallet,
  walletConnectWallet,
  safeWallet,
} from '@rainbow-me/rainbowkit/wallets'
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
 * Note: Base Account wallet removed to avoid telemetry inline script CSP errors in Next.js 15
 */
export const config = getDefaultConfig({
  appName: 'dappterminal.com',
  projectId,
  wallets: [
    {
      groupName: 'Popular',
      wallets: [
        safeWallet,
        rainbowWallet,
        metaMaskWallet,
       walletConnectWallet,
      ],
    },
  ],
  chains: [
    mainnet,
    arbitrum,
    base,
    optimism,
    polygon,
  ],
  ssr: true, // Enable for Next.js
})
