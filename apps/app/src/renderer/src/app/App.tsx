'use client'
import { useEffect, useState } from 'react'
import { AppRouter } from './AppRouter'
import { useAuth, AuthProvider } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'
import { LoginPage, Waitlist } from '../components/LoginPage'
import { LoadingPage } from '../components/LoadingPage'
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
  const [isAppLoading, setIsAppLoading] = useState(true) // New loading state for the entire app
  const [modelCheckComplete, setModelCheckComplete] = useState(false)
  const [hash] = useState(() => window.location.hash) // Get hash once
  const [windowResizeDebounce, setWindowResizeDebounce] = useState<NodeJS.Timeout | null>(null)

  const isPopover = hash.length > 1

  // Debounced window resize function to prevent rapid window size changes
  const debouncedWindowResize = (width: number, height: number, position: 'center' | 'bottom-left', alwaysOnTop: boolean) => {
    if (windowResizeDebounce) {
      clearTimeout(windowResizeDebounce)
    }

    const timeout = setTimeout(() => {
      console.log(`[App] Applying window changes: ${width}x${height} at ${position}, alwaysOnTop: ${alwaysOnTop}`)
      window.electronAPI.send('app:set-always-on-top', { alwaysOnTop })
      window.electronAPI.send('app:resize-window', { width, height })
      window.electronAPI.send('window:set-position', { position })
      setWindowResizeDebounce(null)
    }, 100) // 100ms debounce

    setWindowResizeDebounce(timeout)
  }

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

    // Don't resize during app loading - handled in performModelCheck
    if (isAppLoading) {
      return
    }

    if (isUserLoggedIn && !isWaitlisted && modelCheckComplete) {
      // Main App View
      if (!hasBeenPositioned) {
        console.log('[App] Transitioning to main app view')
        debouncedWindowResize(360, 50, 'bottom-left', true)
        setHasBeenPositioned(true)
      }
    } else {
      // Login, Waitlist, or Error View
      console.log('[App] Transitioning to login/waitlist view')
      debouncedWindowResize(320, 300, 'center', false)
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
    isAppLoading,
    modelCheckComplete
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

  // Handle app initialization and model checking (first priority)
  useEffect(() => {
    // Skip for popover windows - they should load immediately
    if (isPopover) {
      console.log('[App] Popover window detected, skipping model check')
      setIsAppLoading(false)
      setModelCheckComplete(true)
      return
    }

    // Start app loading process immediately
    if (isInitialLoad) {
      console.log('[App] Starting app initialization with model check')
      performModelCheck()
    }
  }, [isInitialLoad, isPopover])

  const performModelCheck = async () => {
    try {
      console.log('[App] Performing model check as first priority')

      // Set appropriate window size for loading (always centered for initial app load)
      window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
      window.electronAPI.send('app:resize-window', { width: 320, height: 300 })
      window.electronAPI.send('window:set-position', { position: 'center' })

      const { getWhisperClient } = await import('../services/whisperClient')
      const whisperClient = getWhisperClient()

      // Initialize and check models
      const initialized = await whisperClient.initialize()
      if (!initialized) {
        console.error('[App] Whisper initialization failed')
        setIsAppLoading(false)
        setModelCheckComplete(false)
        return
      }

      const isAvailable = await whisperClient.isAvailable()
      if (!isAvailable) {
        console.log('[App] Models not available, downloading...')
        const ensured = await whisperClient.ensureModelAvailable()
        if (!ensured) {
          console.error('[App] Failed to ensure models are available')
          setIsAppLoading(false)
          setModelCheckComplete(false)
          return
        }
      }

      console.log('[App] Model check completed successfully')
      // Use setTimeout to ensure state updates don't conflict with LoadingPage component
      setTimeout(() => {
        setModelCheckComplete(true)
        setIsAppLoading(false)
      }, 200) // Small delay to prevent race conditions
    } catch (error) {
      console.error('[App] Error during model check:', error)
      setTimeout(() => {
        setIsAppLoading(false)
        setModelCheckComplete(false)
      }, 200)
    }
  }

  const handleLoadingComplete = (success: boolean) => {
    console.log('[App] Loading completed:', success)
    // Consolidated state update to prevent conflicts with performModelCheck
    setTimeout(() => {
      setIsAppLoading(false)
      setModelCheckComplete(success)
    }, 100)
  }

  // Global error handler for model failures during runtime
  const handleModelError = () => {
    console.warn('[App] Model error detected during runtime, redirecting to loading page')
    setModelCheckComplete(false)
    setIsAppLoading(true)
    performModelCheck()
  }

  // Set up global error listener for model failures
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.on) {
      const unsubscribeModelError = window.electronAPI.on('transcription:model-error', handleModelError)

      return () => {
        if (unsubscribeModelError) {
          unsubscribeModelError()
        }
      }
    }
  }, [])

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (windowResizeDebounce) {
        clearTimeout(windowResizeDebounce)
      }
    }
  }, [])

  return (
    <AnimatePresence mode="wait">
      {/* App loading (model check) - first priority */}
      {isAppLoading || (!modelCheckComplete && !isPopover) ? (
        <motion.div
          key="app-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <LoadingPage
            onComplete={handleLoadingComplete}
            loadingMessage="Loading the app..."
          />
        </motion.div>
      ) : isInitialLoad || (isLoading && user && !sessionProfile) ? (
        /* Auth loading */
        <motion.div
          key="auth-loading"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center h-screen"
        >
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </motion.div>
      ) : (
        /* Main content */
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
