'use client'
import { useEffect, useState } from 'react'
import { AppRouter } from './AppRouter'
import { TranslationProvider } from '../context/TranslationContext'
import { LoadingPage } from '../components/LoadingPage'
import { motion, AnimatePresence } from 'motion'
import { getWhisperClient } from '../services/whisperClient'

/**
 * Main page component that serves as the entry point for the application.
 * Shows a loading spinner while models initialize, then renders the main application.
 * It also resizes the main window to fit the content.
 *
 * @component
 * @returns {JSX.Element} The rendered page.
 */
function AppContent() {
  const [hasBeenPositioned, setHasBeenPositioned] = useState(false)
  const [isUnifiedLoading, setIsUnifiedLoading] = useState(true) // Unified loading for all initialization
  const [hash] = useState(() => window.location.hash) // Get hash once
  const [windowResizeDebounce, setWindowResizeDebounce] = useState<NodeJS.Timeout | null>(null)

  const isPopover = hash.length > 1

  // Debounced window resize function to prevent rapid window size changes
  const debouncedWindowResize = (
    width: number,
    height: number,
    position: 'center' | 'bottom-left',
    alwaysOnTop: boolean
  ) => {
    if (windowResizeDebounce) {
      clearTimeout(windowResizeDebounce)
    }

    const timeout = setTimeout(() => {
      console.log(
        `[App] Applying window changes: ${width}x${height} at ${position}, alwaysOnTop: ${alwaysOnTop}`
      )
      window.electronAPI.send('app:set-always-on-top', { alwaysOnTop })
      window.electronAPI.send('app:resize-window', { width, height })
      window.electronAPI.send('window:set-position', { position })
      setWindowResizeDebounce(null)
    }, 100) // 100ms debounce

    setWindowResizeDebounce(timeout)
  }

  useEffect(() => {
    if (isPopover) return // Do not run this effect in popover windows

    // Don't resize during unified loading
    if (isUnifiedLoading) {
      return
    }

    if (!hasBeenPositioned) {
      debouncedWindowResize(360, 50, 'bottom-left', true)
      setHasBeenPositioned(true)
    }
  }, [isPopover, hasBeenPositioned, isUnifiedLoading])

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

  // Handle unified app initialization (model check)
  useEffect(() => {
    // Skip for popover windows - they should load immediately
    if (isPopover) {
      console.log('[App] Popover window detected, skipping initialization')
      setIsUnifiedLoading(false)
      return
    }

    // Start unified loading process on mount
    console.log('[App] Starting unified app initialization')
    // Set appropriate window size for loading (always centered for initial app load)
    window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
    window.electronAPI.send('app:resize-window', { width: 320, height: 300 })
    window.electronAPI.send('window:set-position', { position: 'center' })
  }, [])

  // Create loading phases configuration
  const createLoadingPhases = () => [
    {
      name: 'model-check',
      message: 'Preparing models...',
      weight: 1.0, // 100% of total progress
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

            // NOTE: Progress tracking is handled by LoadingPage component
            // which subscribes to whisperClient.onDownloadProgress() before
            // calling the phase executor
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
      const unsubscribeModelError = window.electronAPI.on(
        'transcription:model-error',
        handleModelError
      )

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
      {/* Unified loading (model check) - first priority */}
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
        <motion.div
          key="main"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <AppRouter />
        </motion.div>
      )}
    </AnimatePresence>
  )
}

export default function App() {
  return (
    <TranslationProvider>
      <AppContent />
    </TranslationProvider>
  )
}
