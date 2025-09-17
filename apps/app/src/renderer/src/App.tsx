'use client'
import { useEffect, useState } from 'react'
import { Main } from './components/main.js'
import { useAuth } from './context/AuthContext.js'
import { Loader2 } from 'lucide-react'
import { LoginPage } from './components/LoginPage.js'
import { motion, AnimatePresence } from 'motion'
import { UpdateNotification } from './components/UpdateNotification.js'

function getPopoverComponent(hash: string): JSX.Element | null {
  switch (hash) {
    case '#update-notification':
      return <UpdateNotification />
    // Other popovers would be handled here
    default:
      return null
  }
}

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
  const [hasBeenPositioned, setHasBeenPositioned] = useState(false)
  const [hash] = useState(() => window.location.hash) // Get hash once

  const isPopover = hash.length > 1

  // Handle popover routes
  const popoverComponent = getPopoverComponent(hash)
  if (popoverComponent) {
    return popoverComponent
  }

  useEffect(() => {
    if (isInitialLoad && !isLoading) {
      setIsInitialLoad(false)
    }

    if (isPopover) return // Do not run this effect in popover windows

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
        // User is logged in, make always on top
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: true })
        // Only position the window once per session
        if (!hasBeenPositioned) {
          window.electronAPI.send('app:resize-window', { width: 360, height: 50 })
          window.electronAPI.send('window:set-position', {
            position: 'bottom-left',
            displayId: undefined
          })
          setHasBeenPositioned(true)
        }
      } else {
        // User is logged out, not always on top, center, and then resize
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
        window.electronAPI.send('app:resize-window', { width: 360, height: 300 })
        window.electronAPI.send('window:set-position', {
          position: 'center',
          displayId: undefined
        })
        // Reset the positioned flag when user logs out
        if (hasBeenPositioned) {
          setHasBeenPositioned(false)
        }
      }
    }
  }, [user, isLoading, isInitialLoad, isPopover, hasBeenPositioned])

  useEffect(() => {
    if (window.electronAPI && window.electronAPI.on) {
      const unsubscribeLog = window.electronAPI.on('updater:log', (message, ...args) => {
        console.log(message, ...args)
      })

      const unsubscribeUpdate = window.electronAPI.on('updater:update-downloaded', async () => {
        console.log('Update downloaded, creating popover.')
        const isScreenSharing = await window.electronAPI.invoke('get-screenshare-state')
        const width = isScreenSharing ? 440 : 360
        window.electronAPI.invoke('popover:create', {
          id: 'update-notification',
          hash: 'update-notification',
          width: width,
          height: 50
        })
      })

      return () => {
        if (unsubscribeLog) {
          unsubscribeLog()
        }
        if (unsubscribeUpdate) {
          unsubscribeUpdate()
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
          className="flex flex-col items-center justify-center h-screen"
        >
          <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        </motion.div>
      ) : (
        <div key="content">
          <AnimatePresence mode="wait">
            {user ? (
              <motion.div
                key="main"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
              >
                <Main />
              </motion.div>
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
