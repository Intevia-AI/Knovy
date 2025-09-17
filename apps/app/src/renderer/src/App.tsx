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
  const { user, isLoading, sessionProfile } = useAuth()
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

    if (isLoading) {
      if (window.electronAPI) {
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: false })
      }
      if (isInitialLoad) {
        return
      }
    }

    if (window.electronAPI) {
      if (user && sessionProfile) {
        // User is logged in, make always on top
        window.electronAPI.send('app:set-always-on-top', { alwaysOnTop: true })
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
        if (hasBeenPositioned) {
          setHasBeenPositioned(false)
        }
      }
    }
  }, [user, isLoading, isInitialLoad, isPopover, hasBeenPositioned, sessionProfile])

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

  const Waitlist = () => (
  <div className="flex flex-col items-center justify-center h-screen text-center">
    <h1 className="text-2xl font-bold">You're on the Waitlist!</h1>
    <p className="text-muted-foreground">We'll notify you when you have access.</p>
  </div>
);

  return (
    <AnimatePresence mode="wait">
      {isInitialLoad || (isLoading && !sessionProfile) ? (
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
              sessionProfile.app_settings.free_tier_experience?.mode === 'non-access' && sessionProfile.role === 'free' ? (
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
                  <Main />
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
