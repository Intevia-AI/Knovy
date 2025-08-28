'use client'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

// Import the self-contained components for each view
import { MainBar } from './main/MainBar'
import ChatPanel from './main/ChatPanel'
import { FeaturesPopup } from './main/FeaturesPopup'
import { SettingsPopup } from './main/SettingsPopup'
import { ScreenPreviewPopup } from './main/ScreenPreviewPopup'

/**
 * This is the root component for all renderer windows.
 * It acts as a router, rendering the correct component based on the URL hash.
 * It contains no complex state management hooks itself to avoid cross-window conflicts
 * and to respect the Rules of Hooks.
 */
const getInitialView = () => {
  if (typeof window === 'undefined') return 'main'
  const hash = window.location.hash.substring(1)
  switch (hash) {
    case 'transcriptions':
    case 'features':
    case 'settings':
    case 'screen-preview':
      return hash
    default:
      return 'main'
  }
}

export function Main() {
  const { setTheme } = useTheme()
  const [view, setView] = useState(getInitialView)

  useEffect(() => {
    setTheme('dark')
    const handleHashChange = () => {
      setView(getInitialView())
    }

    window.addEventListener('hashchange', handleHashChange)

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [setTheme])

  // Render the correct component based on the view
  switch (view) {
    case 'main':
      return <MainBar />
    case 'transcriptions':
      return <ChatPanel />
    case 'features':
      return <FeaturesPopup />
    case 'settings':
      return <SettingsPopup />
    case 'screen-preview':
      return <ScreenPreviewPopup />
    default:
      // Render nothing or a loading indicator while the view is being determined
      return null
  }
}
