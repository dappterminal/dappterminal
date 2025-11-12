'use client'

import { useState, useEffect } from 'react'
import { AppLayout } from "@/components/app-layout"
import { LoadingScreen } from "@/components/loading-screen"
import { useAppLoading } from "./providers"

export default function Home() {
  const isLoading = useAppLoading()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  // Avoid hydration mismatch by not rendering until client-side
  if (!mounted) {
    return null
  }

  return (
    <>
      <LoadingScreen isLoading={isLoading} />
      <div className={`transition-opacity duration-500 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
        <AppLayout />
      </div>
    </>
  )
}
