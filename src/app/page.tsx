'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from "@/components/app-layout"
import { LoadingScreen } from "@/components/loading-screen"
import { TermsOfServiceModal } from "@/components/terms-of-service-modal"
import { useAppLoading } from "./providers"

const TOS_STORAGE_KEY = 'dappterminal-tos-accepted'

export default function Home() {
  const isLoading = useAppLoading()
  const [mounted, setMounted] = useState(false)
  const [hasAcceptedTOS, setHasAcceptedTOS] = useState(true) // Default true to avoid flash

  useEffect(() => {
    setMounted(true)
    // Check localStorage for TOS acceptance
    const accepted = localStorage.getItem(TOS_STORAGE_KEY)
    setHasAcceptedTOS(accepted === 'true')
  }, [])

  const handleAcceptTOS = () => {
    localStorage.setItem(TOS_STORAGE_KEY, 'true')
    setHasAcceptedTOS(true)
  }

  // Avoid hydration mismatch by not rendering until client-side
  if (!mounted) {
    return null
  }

  // Show TOS modal after loading completes if not yet accepted
  const showTOSModal = !isLoading && !hasAcceptedTOS

  return (
    <>
      <LoadingScreen isLoading={isLoading} />
      <div className={`transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        <AppLayout />
      </div>
      <TermsOfServiceModal isOpen={showTOSModal} onAccept={handleAcceptTOS} />
    </>
  )
}
