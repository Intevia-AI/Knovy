'use client'
import { useEffect } from 'react'
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

  useEffect(() => {
    if (isLoading) return // Wait until the auth state is resolved

    if (window.electronAPI) {
      if (user) {
        // User is logged in, move to bottom-left
        window.electronAPI.send('window:move-to-bottom-left')
      } else {
        // User is logged out, resize and move to center
        window.electronAPI.send('app:resize-window', { width: 360, height: 300 })
        window.electronAPI.send('window:center')
      }
    }
  }, [user, isLoading])

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
      {isLoading ? (
        <motion.div
          key="loader"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col items-center justify-center h-screen"
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
