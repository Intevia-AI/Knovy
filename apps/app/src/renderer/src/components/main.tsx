'use client'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

// Import the self-contained components for each view
import { MainBar } from './main/MainBar'
import ChatPanel from './main/ChatPanel'
import { FeaturesPopup } from './main/FeaturesPopup'
import { SettingsPopup } from './main/SettingsPopup'
import { ScreenPreviewPopup } from './main/ScreenPreviewPopup'

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

/**
 * This component now holds the state and logic for the application.
 * It calls the necessary hooks and passes props down to the view components.
 */
function AppContainer() {
  const [view, setView] = useState(getInitialView)

  useEffect(() => {
    const handleHashChange = () => {
      setView(getInitialView())
    }
    window.addEventListener('hashchange', handleHashChange)
    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  // Render the correct component based on the view, passing necessary props
  switch (view) {
    case 'main':
      return <MainBar />
    case 'screen-preview':
      // ScreenPreviewPopup might need props in the future
      return <ScreenPreviewPopup />
    case 'transcriptions':
      // ChatPanel might need props in the future
      return <ChatPanel />
    case 'features':
      // Pass the required props to FeaturesPopup
      return <FeaturesPopup />
    case 'settings':
      // SettingsPopup might need props in the future
      return <SettingsPopup />
    default:
      return null
  }
}

/**
 * This is the root component for all renderer windows.
 * It sets up global providers like Theme and delegates rendering to AppContainer.
 */
export function Main() {
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme('light')
  }, [setTheme])

  return <AppContainer />
}
