/**
 * @fileoverview Authentication context provider for Supabase OAuth integration.
 * Manages user authentication state, OAuth flows, and session persistence
 * in the Electron environment with custom protocol handling.
 */

'use client'
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { supabase } from '../lib/supabaseClient.js' // Adjust path as necessary
import type { Session, User } from '@supabase/supabase-js'

/**
 * Authentication context type definition.
 *
 * @interface AuthContextType
 * @property {Session | null} session - Current Supabase session
 * @property {User | null} user - Current authenticated user
 * @property {boolean} isLoading - Loading state during auth operations
 * @property {Function} signInWithProvider - OAuth sign-in function
 * @property {Function} signOut - Sign-out function
 */
interface AuthContextType {
  session: Session | null
  user: User | null
  isLoading: boolean
  signInWithProvider: (provider: 'google' | 'github') => Promise<void> // Add more providers as needed
  signOut: () => Promise<void>
}

/** @type {React.Context} Authentication context instance */
const AuthContext = createContext<AuthContextType | undefined>(undefined)

/**
 * Props for the AuthProvider component.
 *
 * @interface AuthProviderProps
 * @property {ReactNode} children - Child components to wrap with auth context
 */
interface AuthProviderProps {
  children: ReactNode
}

/**
 * Authentication provider component that manages OAuth authentication state.
 * Handles Supabase session management, OAuth callbacks via Electron's custom protocol,
 * and provides authentication methods to child components.
 *
 * @component
 * @param {AuthProviderProps} props - Component props
 * @returns {JSX.Element} Provider component wrapping children with auth context
 */
export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    // Check for an existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for auth state changes
    const { data: authListenerData } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)
    })

    // Listen for the OAuth callback from the main Electron process
    const handleOAuthCallback = async (url: string) => {
      console.log('[AuthContext] Received OAuth callback URL from main process:', url)
      try {
        const hash = new URL(url.replace('intevia://', 'http://localhost/')).hash
        if (!hash) {
          console.error('[AuthContext] No hash fragment found in callback URL.')
          setIsLoading(false)
          return
        }

        const params = new URLSearchParams(hash.substring(1))
        const code = params.get('code')
        const error = params.get('error')
        const errorDescription = params.get('error_description')

        if (error) {
          console.error(`[AuthContext] OAuth Error in callback URL: ${error} - ${errorDescription}`)
          setIsLoading(false)
          return
        }

        if (code) {
          console.log('[AuthContext] Extracted authorization code, exchanging for session.')
          const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

          if (exchangeError) {
            console.error('[AuthContext] Error exchanging code for session:', exchangeError)
          } else {
            console.log('[AuthContext] Session exchanged successfully.', data)
            setSession(data.session)
            setUser(data.user)
          }
        } else {
          console.warn(
            '[AuthContext] Could not extract authorization code from callback URL fragment.'
          )
        }
      } catch (e) {
        console.error('[AuthContext] Error processing OAuth callback URL:', e)
      } finally {
        setTimeout(() => setIsLoading(false), 500)
      }
    }

    let unsubscribeElectronListener: (() => void) | undefined
    if (window.electronAPI) {
      unsubscribeElectronListener = window.electronAPI.on(
        'electronAPI:oauth-callback',
        (url: string) => {
          console.log(
            '[AuthContext] Received oauth-callback event from main process with URL:',
            url
          )
          handleOAuthCallback(url)
        }
      )
      console.log('[AuthContext] Subscribed to oauth-callback from Electron.')

      // Signal to the main process that the renderer is ready to handle the auth callback
      window.electronAPI.send('renderer-auth-ready')
      console.log('[AuthContext] Sent renderer-auth-ready signal to main process.')
    } else {
      console.warn('[AuthContext] window.electronAPI not available. OAuth callback might not work.')
    }

    return () => {
      authListenerData.subscription?.unsubscribe()
      if (unsubscribeElectronListener) {
        unsubscribeElectronListener()
        console.log('[AuthContext] Unsubscribed from oauth-callback.')
      }
    }
  }, [])

  /**
   * Initiates OAuth sign-in flow with the specified provider.
   * Opens external browser for authentication and handles the callback
   * through Electron's custom protocol system.
   *
   * @async
   * @function signInWithProvider
   * @param {'google' | 'github'} provider - OAuth provider to use for authentication
   * @returns {Promise<void>}
   * @throws {Error} When OAuth URL is not available or Electron API is missing
   */
  const signInWithProvider = async (provider: 'google' | 'github') => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          skipBrowserRedirect: true,
          redirectTo: 'https://intevia.app/auth/callback', // Redirect to the web app's callback page
          // For PKCE flow, skipBrowserRedirect might be an option if not automatically handled
          queryParams: { access_type: 'offline', prompt: 'consent' } // Example for Google
        }
      })

      if (error) throw error

      if (data.url) {
        console.log(`[AuthContext] Initiating ${provider} OAuth. Opening URL: ${data.url}`)
        // @ts-ignore
        if (
          window.electronAPI &&
          typeof window.electronAPI.supabaseSignInWithOAuth === 'function'
        ) {
          // @ts-ignore
          const mainProcessResponse = await window.electronAPI.supabaseSignInWithOAuth({
            urlToOpen: data.url
          })
          if (mainProcessResponse?.error) {
            console.error(
              `[AuthContext] Error from main process opening OAuth URL: ${mainProcessResponse.error}`
            )
            throw new Error(`Main process error: ${mainProcessResponse.error}`)
          }
        } else {
          console.error(
            '[AuthContext] window.electronAPI.supabaseSignInWithOAuth is not available.'
          )
          throw new Error('Electron API for OAuth not available.')
        }
      } else {
        console.error(`[AuthContext] No URL returned from Supabase for ${provider} OAuth.`)
        throw new Error('No URL returned from Supabase for OAuth.')
      }
    } catch (error) {
      console.error(`[AuthContext] Error during ${provider} sign-in:`, error)
      // Potentially set an error state here to show to the user
      setIsLoading(false)
    }
    // setIsLoading(false) will be handled by onAuthStateChange or if an error occurs
  }

  /**
   * Signs out the current user and clears the session.
   * Updates the authentication state through the onAuthStateChange listener.
   *
   * @async
   * @function signOut
   * @returns {Promise<void>}
   */
  const signOut = async () => {
    setIsLoading(true)
    await supabase.auth.signOut()
    // onAuthStateChange will set user and session to null, and isLoading to false
  }

  const value = {
    session,
    user,
    isLoading,
    signInWithProvider,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Custom hook to access the authentication context.
 * Must be used within an AuthProvider component tree.
 *
 * @hook useAuth
 * @returns {AuthContextType} Authentication context value
 * @throws {Error} When used outside of AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// The global declaration for window.electronAPI is now in apps/app/types/electron.d.ts
// Ensure that file is included in your tsconfig.json and recognized by TypeScript.
