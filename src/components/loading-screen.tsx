'use client'

/**
 * Loading Screen Component
 *
 * Displays a full-screen loading overlay with animated logo
 * Only shown in production or when explicitly enabled via environment variable
 */

import { useEffect, useState } from 'react'

interface LoadingScreenProps {
  isLoading: boolean
}

export function LoadingScreen({ isLoading }: LoadingScreenProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Don't render anything on server or if not loading
  if (!mounted || !isLoading) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0A0A0A] animate-fadeOut">
      <div className="flex flex-col items-center gap-6">
        {/* Logo */}
        <img
          src="/dappterminal-logo-horizontal-white.svg"
          alt="dappTerminal"
          className="h-10 md:h-12 animate-pulse"
        />

        {/* Loading indicator with terminal cursor effect */}
        <div className="flex items-center gap-2">
          <span className="text-[#737373] text-sm font-mono">Loading</span>
          <span className="text-white font-mono animate-blink">_</span>
        </div>
      </div>
    </div>
  )
}
