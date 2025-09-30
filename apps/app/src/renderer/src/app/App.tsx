'use client'
import { useEffect, useState } from 'react'
import { AppRouter } from './AppRouter'
import { useAuth, AuthProvider } from '../context/AuthContext'
import { Loader2 } from 'lucide-react'
import { LoginPage, Waitlist } from '../components/LoginPage'
import { LoadingPage } from '../components/LoadingPage'
import { motion, AnimatePresence } from 'motion'
import { getWhisperClient } from '../services/whisperClient'

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
  const [isUnifiedLoading, setIsUnifiedLoading] = useState(true) // Unified loading for all initialization
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

    // Don't resize during unified loading
    if (isUnifiedLoading) {
      return
    }

    if (isUserLoggedIn && !isWaitlisted) {
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
    isUnifiedLoading
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

  // Handle unified app initialization (model + auth)
  useEffect(() => {
    // Skip for popover windows - they should load immediately
    if (isPopover) {
      console.log('[App] Popover window detected, skipping initialization')
      setIsUnifiedLoading(false)
      return
    }

    // Start unified loading process immediately
    if (isInitialLoad) {
      console.log('[App] Starting unified app initialization')
      // Set appropriate window size for loading (always centered for initial app load)
      window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
      window.electronAPI.send('app:resize-window', { width: 320, height: 300 })
      window.electronAPI.send('window:set-position', { position: 'center' })
    }
  }, [isInitialLoad, isPopover])

  // Create loading phases configuration
  const createLoadingPhases = () => [
    {
      name: 'model-check',
      message: 'Preparing transcription models...',
      weight: 0.6, // 60% of total progress
      executor: async () => {
        try {
          console.log('[App] Starting model preparation phase')
          const whisperClient = getWhisperClient()

          // Initialize and check models
          const initialized = await whisperClient.initialize()
          if (!initialized) {
            console.error('[App] Whisper initialization failed')
            return false
          }

          const isAvailable = await whisperClient.isAvailable()
          if (!isAvailable) {
            console.log('[App] Models not available, downloading...')
            const ensured = await whisperClient.ensureModelAvailable()
            if (!ensured) {
              console.error('[App] Failed to ensure models are available')
              return false
            }
          }

          console.log('[App] Model preparation completed successfully')
          return true
        } catch (error) {
          console.error('[App] Error during model preparation:', error)
          return false
        }
      }
    },
    {
      name: 'auth-check',
      message: 'Verifying authentication...',
      weight: 0.4, // 40% of total progress
      executor: async () => {
        try {
          console.log('[App] Starting authentication verification phase')

          // Wait for auth to complete if still loading
          while (isLoading) {
            await new Promise(resolve => setTimeout(resolve, 100))
          }

          // If we have a user, wait for session profile to load
          if (user && !sessionProfile) {
            console.log('[App] User found, waiting for session profile...')
            let attempts = 0
            const maxAttempts = 50 // 5 seconds max wait

            while (!sessionProfile && attempts < maxAttempts) {
              await new Promise(resolve => setTimeout(resolve, 100))
              attempts++
            }

            if (!sessionProfile) {
              console.warn('[App] Session profile loading timed out')
              return false
            }
          }

          console.log('[App] Authentication verification completed')
          return true
        } catch (error) {
          console.error('[App] Error during authentication verification:', error)
          return false
        }
      }
    }
  ]

  const handleUnifiedLoadingComplete = (success: boolean) => {
    console.log('[App] Unified loading completed:', success)
    setIsUnifiedLoading(false)
  }

  // Global error handler for model failures during runtime
  const handleModelError = () => {
    console.warn('[App] Model error detected during runtime, restarting initialization')
    setIsUnifiedLoading(true)
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
      {/* Unified loading (model + auth) - first priority */}
      {isUnifiedLoading && !isPopover ? (
        <motion.div
          key="unified-loading"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <LoadingPage
            onComplete={handleUnifiedLoadingComplete}
            loadingMessage="Initializing Knovy..."
            phases={createLoadingPhases()}
          />
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
