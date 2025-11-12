'use client'

/**
 * Client-side providers for wagmi and RainbowKit
 */

import { useState, useEffect } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit'
import { config } from '@/lib/wagmi-config'
import '@rainbow-me/rainbowkit/styles.css'

const queryClient = new QueryClient()

// Custom RainbowKit theme matching terminal design
const customTheme = darkTheme({
  accentColor: '#262626',
  accentColorForeground: 'white',
  borderRadius: 'medium',
  fontStack: 'system',
  overlayBlur: 'none', // Changed from 'small' to 'none'
})

// Override only essential theme properties - don't touch wallet icon backgrounds
customTheme.colors.modalBackground = '#0A0A0A'
customTheme.colors.modalBorder = '#262626'
customTheme.colors.modalText = '#E5E5E5'
customTheme.colors.modalTextDim = '#737373'
customTheme.colors.modalTextSecondary = '#A3A3A3'
customTheme.colors.profileForeground = '#141414'
customTheme.colors.actionButtonBorder = '#262626'
customTheme.colors.actionButtonBorderMobile = '#262626'
customTheme.colors.closeButton = '#737373'
customTheme.colors.closeButtonBackground = '#141414'
customTheme.colors.connectButtonBackground = '#141414'
customTheme.colors.connectButtonText = 'white'
customTheme.colors.connectButtonTextError = '#EF4444'

export function Providers({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true)
  const [isClient, setIsClient] = useState(false)

  // Check if we should show loading screen (production or explicitly enabled)
  const shouldShowLoading =
    process.env.NODE_ENV === 'production' ||
    process.env.NEXT_PUBLIC_SHOW_LOADING_SCREEN === 'true'

  useEffect(() => {
    // Mark as client-side rendered
    setIsClient(true)

    // Only show loading screen if enabled
    if (shouldShowLoading) {
      // Simulate loading time for smooth transition
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 800) // 800ms loading duration

      return () => clearTimeout(timer)
    } else {
      // In development, skip loading screen
      setIsLoading(false)
    }
  }, [shouldShowLoading])

  // Pass loading state to children through context
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={customTheme}>
          {typeof window !== 'undefined' && children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  )
}

// Export loading state for use in page.tsx
export function useAppLoading() {
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const shouldShowLoading =
      process.env.NODE_ENV === 'production' ||
      process.env.NEXT_PUBLIC_SHOW_LOADING_SCREEN === 'true'

    if (shouldShowLoading) {
      const timer = setTimeout(() => {
        setIsLoading(false)
      }, 800)

      return () => clearTimeout(timer)
    } else {
      setIsLoading(false)
    }
  }, [])

  return isLoading
}
