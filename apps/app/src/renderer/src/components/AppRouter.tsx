'use client'
import { useEffect, useState } from 'react'
import { useTheme } from 'next-themes'

// Import the self-contained components for each view
import { MainController } from './main/MainController'
import ChatPanel from './main/ChatPanel'
import ActionsPanel from './main/ActionsPanel'
import { SettingsPanel } from './main/SettingsPanel'
import { PreviewPanel } from './main/PreviewPanel'
import { UpdaterPanel } from './main/UpdaterPanel'

const getInitialView = () => {
  if (typeof window === 'undefined') return 'main'
  const hash = window.location.hash.substring(1)
  switch (hash) {
    case 'transcriptions':
    case 'actions':
    case 'settings':
    case 'screen-preview':
    case 'updater':
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

  // Render the correct component based on the view hash
  switch (view) {
    case 'main':
      return <MainController />
    case 'screen-preview':
      return <PreviewPanel />
    case 'transcriptions':
      return <ChatPanel />
    case 'actions':
      return <ActionsPanel />
    case 'settings':
      return <SettingsPanel />
    case 'updater':
      return <UpdaterPanel />
    default:
      return null
  }
}

export function AppRouter() {
  const { setTheme } = useTheme()

  useEffect(() => {
    setTheme('light')
  }, [setTheme])

  return <AppContainer />
}
