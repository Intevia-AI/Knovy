'use client'
import { useEffect } from 'react'
import { Main } from './components/main.js'
import { useAuth } from './context/AuthContext.js'
import { Loader2 } from 'lucide-react'
import { LoginPage } from './components/LoginPage.js'

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

  // Show a loading spinner while the auth state is being determined
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
        <p className="mt-4 text-muted-foreground">Loading application...</p>
      </div>
    )
  }

  // If the user is authenticated, show the main app; otherwise, show the login page.
  return user ? <Main /> : <LoginPage />
}
