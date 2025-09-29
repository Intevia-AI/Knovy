'use client'
import { useEffect, useState } from 'react'
import { AppRouter } from './AppRouter'
import { useAuth, AuthProvider } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'
import { LoginPage, Waitlist } from '../components/LoginPage'
import { ModelPreparationLoader } from '../components/ModelPreparationLoader'
import { motion, AnimatePresence } from 'motion'

/**
 * Main page component that serves as the entry point for the application.
 * Shows a loading spinner during authentication, then renders either the
 * login page or the main application based on user authentication state.
 * It also resizes the main window to fit the content.
 *
 * @component
 * @returns {JSX.Element} The rendered page.
 */
function AppContent() {
  const { user, isLoading, sessionProfile } = useAuth()
  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [hasBeenPositioned, setHasBeenPositioned] = useState(false)
  const [isModelPreparationComplete, setIsModelPreparationComplete] = useState(false)
  const [modelPreparationStarted, setModelPreparationStarted] = useState(false)
  const [hash] = useState(() => window.location.hash) // Get hash once

  const isPopover = hash.length > 1

  useEffect(() => {
    if (isInitialLoad && !isLoading) {
      setIsInitialLoad(false)
    }

    if (isPopover) return // Do not run this effect in popover windows

    const isUserLoggedIn = user && sessionProfile
    const isWaitlisted =
      isUserLoggedIn &&
      sessionProfile.role === 'free' &&
      sessionProfile.app_settings.free_tier_experience?.mode === 'non-access'

    if (isUserLoggedIn && !isWaitlisted) {
      // Check if we're showing model preparation
      const showingModelPreparation = modelPreparationStarted && !isModelPreparationComplete

      if (showingModelPreparation) {
        // Model Preparation View (same as login)
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
        window.electronAPI.send('app:resize-window', { width: 320, height: 300 })
        window.electronAPI.send('window:set-position', { position: 'center' })
      } else {
        // Main App View
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: true })
        if (!hasBeenPositioned) {
          window.electronAPI.send('app:resize-window', { width: 360, height: 50 })
          window.electronAPI.send('window:set-position', { position: 'bottom-left' })
          setHasBeenPositioned(true)
        }
      }
    } else {
      // Login or Waitlist View
      window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
      window.electronAPI.send('app:resize-window', { width: 320, height: 300 })
      window.electronAPI.send('window:set-position', { position: 'center' })
      if (hasBeenPositioned) {
        setHasBeenPositioned(false)
      }
    }
  }, [
    user,
    isLoading,
    isInitialLoad,
    isPopover,
    hasBeenPositioned,
    sessionProfile,
    modelPreparationStarted,
    isModelPreparationComplete
  ])

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.on) {
      const unsubscribeLog = window.electronAPI.on('updater:log', (message, ...args) => {
        console.log(message, ...args)
      })

      return () => {
        if (unsubscribeLog) {
          unsubscribeLog()
        }
      }
    }
  }, [])

  // Handle model preparation for authenticated users (only in main window, not popovers)
  useEffect(() => {
    // Skip model preparation for popover windows
    if (isPopover) {
      console.log('[App] Skipping model preparation for popover window')
      setIsModelPreparationComplete(true) // Mark as complete to skip the preparation screen
      return
    }

    const isUserLoggedIn = user && sessionProfile
    const isWaitlisted =
      isUserLoggedIn &&
      sessionProfile.role === 'free' &&
      sessionProfile.app_settings.free_tier_experience?.mode === 'non-access'

    // Start model preparation when user is logged in and not waitlisted
    if (isUserLoggedIn && !isWaitlisted && !modelPreparationStarted && !isInitialLoad) {
      console.log('[App] Starting model preparation for authenticated user in main window')

      // Check if models are already available before showing preparation UI
      checkExistingModels()
    }
  }, [user, sessionProfile, isInitialLoad, modelPreparationStarted, isPopover])

  const checkExistingModels = async () => {
    try {
      // Quick check if models are already available
      const { getLocalTranscriptionClient } = await import('../services/localTranscriptionClient')
      const localClient = getLocalTranscriptionClient()

      const isAvailable = await localClient.isAvailable()

      if (isAvailable) {
        console.log('[App] Models already available, skipping preparation UI')
        setIsModelPreparationComplete(true)
      } else {
        console.log('[App] Models not available, showing preparation UI')
        setModelPreparationStarted(true)
      }
    } catch (error) {
      console.error('[App] Error checking existing models:', error)
      // If check fails, proceed with preparation to be safe
      setModelPreparationStarted(true)
    }
  }

  const handleModelPreparationComplete = (success: boolean) => {
    console.log('[App] Model preparation completed:', success)
    setIsModelPreparationComplete(true)

    // Force window to resize to main app view after model preparation
    // We need to ensure the window transitions properly
    setTimeout(() => {
      if (!isPopover) {
        console.log('[App] Transitioning to main app view after model preparation')
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: true })
        window.electronAPI.send('app:resize-window', { width: 360, height: 50 })
        window.electronAPI.send('window:set-position', { position: 'bottom-left' })
        setHasBeenPositioned(true)
      }
    }, 500) // Small delay to ensure state has updated
  }

  return (
    <AnimatePresence mode="wait">
      {isInitialLoad || (isLoading && user && !sessionProfile) ? (
        <motion.div
          key="loader"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center h-screen"
        >
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </motion.div>
      ) : (
        <div key="content">
          <AnimatePresence mode="wait">
            {user && sessionProfile ? (
              sessionProfile.app_settings.free_tier_experience?.mode === 'non-access' &&
              sessionProfile.role === 'free' ? (
                <motion.div
                  key="waitlist"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Waitlist />
                </motion.div>
              ) : modelPreparationStarted && !isModelPreparationComplete ? (
                <motion.div
                  key="model-preparation"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ModelPreparationLoader onComplete={handleModelPreparationComplete} />
                </motion.div>
              ) : (
                <motion.div
                  key="main"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <AppRouter />
                </motion.div>
              )
            ) : (
              <motion.div
                key="login"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <LoginPage />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
