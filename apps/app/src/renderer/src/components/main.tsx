/* eslint-disable @typescript-eslint/no-unused-vars */
'use client'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

// Import the self-contained components for each view
import { MainController } from './main/MainController'
import ChatPanel from './main/ChatPanel'
import { ActionsPanel } from './main/ActionsPanel'
import { SettingsModal } from './main/SettingsModal'
import { ScreenPreview } from './main/ScreenPreview'

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

  // Render the correct component based on the view
  switch (view) {
    case 'main':
      return <MainController />
    case 'screen-preview':
      // This will be rendered in a popover window.
      // The necessary props will be passed from the main process if needed.
      return <ScreenPreview systemAnalyserNode={null} />
    case 'transcriptions':
      return <ChatPanel />
    case 'features':
      return <ActionsPanel />
    case 'settings':
      // The modal is controlled from MainController, so this view is likely for a dedicated settings window if ever needed.
      // For now, we can render it closed, or not at all.
      return <SettingsModal isOpen={true} onClose={() => window.close()} />
    default:
      return null
  }
}

export function Main() {
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme('light')
  }, [setTheme])

  return <AppContainer />
}