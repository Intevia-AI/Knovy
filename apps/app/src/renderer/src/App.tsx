'use client'
import { useEffect, useState } from 'react'
import { Main } from './components/main.js'
import { useAuth } from './context/AuthContext.js'
import { Loader2 } from 'lucide-react'
import { LoginPage } from './components/LoginPage.js'
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
export default function App() {
  const { user, isLoading } = useAuth()
  const [isInitialLoad, setIsInitialLoad] = useState(true)

  useEffect(() => {
    if (isInitialLoad && !isLoading) {
      setIsInitialLoad(false)
    }

    // While loading, ensure the window is not always on top so the user can interact
    // with the Google OAuth window.
    if (isLoading) {
      if (window.electronAPI) {
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
      }
      // On initial load, we want to show the loader and wait.
      // On subsequent loads (like during sign-in), we want to let the LoginPage render and show its own spinner.
      if (isInitialLoad) {
        return
      }
    }

    if (window.electronAPI) {
      if (user) {
        // User is logged in, make it always on top and move to corner
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: true })
        window.electronAPI.send('window:move-to-bottom-left')
      } else {
        // User is logged out, not always on top, resize and center
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
        window.electronAPI.send('app:resize-window', { width: 360, height: 300 })
        window.electronAPI.send('window:center')
      }
    }
  }, [user, isLoading, isInitialLoad])

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.on) {
      const unsubscribe = window.electronAPI.on('updater:log', (message, ...args) => {
        console.log(message, ...args)
      })

      return () => {
        if (unsubscribe) {
          unsubscribe()
        }
      }
    }
  }, [])

  return (
    <AnimatePresence mode="wait">
      {isInitialLoad ? (
        <motion.div
          key="loader"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center h-screen bg-background"
        >
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          {/* <p className="mt-4 text-muted-foreground">Loading application...</p> */}
        </motion.div>
      ) : (
        <motion.div
          key="content"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.2 }}
        >
          {user ? <Main /> : <LoginPage />}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
