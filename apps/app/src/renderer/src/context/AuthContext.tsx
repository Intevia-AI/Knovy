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
 * @property {string[]} permissions - List of permissions for the current user
 * @property {boolean} isLoading - Loading state during auth operations
 * @property {(permission: string) => boolean} hasPermission - Function to check for a permission
 * @property {Function} signInWithProvider - OAuth sign-in function
 * @property {Function} signOut - Sign-out function
 */
interface AuthContextType {
  session: Session | null
  user: User | null
  permissions: string[]
  isLoading: boolean
  hasPermission: (permission: string) => boolean
  signInWithProvider: (provider: 'google' | 'github') => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [permissions, setPermissions] = useState<string[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    setIsLoading(true)
    // Check for an existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        const { access_token } = session
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api/me/permissions`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
            },
          }
        )
        .then(res => res.json())
        .then(data => {
          setPermissions(data?.permissions || [])
          console.log('[AuthContext] Permissions fetched on initial session:', data?.permissions)
        })
        .catch(error => {
            console.error('[AuthContext] Error fetching permissions on initial session:', error)
            setPermissions([])
        })
        .finally(() => setIsLoading(false));
      } else {
        setIsLoading(false);
      }
    })

    // Listen for auth state changes
    const { data: authListenerData } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      setIsLoading(false)

      if (session?.user && (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED')) {
        const { access_token } = session
        fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-api/me/permissions`,
          {
            headers: {
              Authorization: `Bearer ${access_token}`,
              apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!,
            },
          }
        )
        .then(res => res.json())
        .then(data => {
          setPermissions(data?.permissions || [])
          console.log('[AuthContext] Permissions fetched on auth state change:', data?.permissions)
        })
        .catch(error => {
            console.error('[AuthContext] Error fetching permissions on auth state change:', error)
            setPermissions([])
        });
      } else if (_event === 'SIGNED_OUT') {
        setPermissions([])
      }
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
        setTimeout(() => {
          setIsLoading(false) // Release the lock
        }, 500)
      }
    }

    let unsubscribeOAuthListener: (() => void) | undefined
    let unsubscribeSignOutListener: (() => void) | undefined

    if (window.electronAPI) {
      // Listener for OAuth callback
      unsubscribeOAuthListener = window.electronAPI.on(
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

      // Listener for sign-out command from main process
      unsubscribeSignOutListener = window.electronAPI.on('auth:execute-sign-out', () => {
        console.log('[AuthContext] Received auth:execute-sign-out from main process.')
        signOut()
      })
      console.log('[AuthContext] Subscribed to auth:execute-sign-out from Electron.')

      // Signal to the main process that the renderer is ready to handle the auth callback
      window.electronAPI.send('renderer-auth-ready')
      console.log('[AuthContext] Sent renderer-auth-ready signal to main process.')
    } else {
      console.warn('[AuthContext] window.electronAPI not available. OAuth callback might not work.')
    }

    return () => {
      authListenerData.subscription?.unsubscribe()
      if (unsubscribeOAuthListener) {
        unsubscribeOAuthListener()
        console.log('[AuthContext] Unsubscribed from oauth-callback.')
      }
      if (unsubscribeSignOutListener) {
        unsubscribeSignOutListener()
        console.log('[AuthContext] Unsubscribed from auth:execute-sign-out.')
      }
    }
  }, [])

  const signInWithProvider = async (provider: 'google' | 'github') => {
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          skipBrowserRedirect: true,
          redirectTo: import.meta.env.DEV
            ? 'http://localhost:3000/auth/callback'
            : 'https://intevia.app/auth/callback',
          queryParams: { access_type: 'offline', prompt: 'consent' } // Example for Google
        }
      })

      if (error) throw error

      if (data.url) {
        console.log(`[AuthContext] Initiating ${provider} OAuth. Opening URL: ${data.url}`)
        if (
          window.electronAPI &&
          typeof window.electronAPI.supabaseSignInWithOAuth === 'function'
        ) {
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
      setIsLoading(false)
    }
  }

  const signOut = async (): Promise<void> => {
    setIsLoading(true)
    await supabase.auth.signOut()
    setPermissions([]) // Clear permissions
  }

  const hasPermission = (permission: string): boolean => {
    return permissions.includes(permission);
  };

  const value = {
    session,
    user,
    permissions,
    isLoading,
    hasPermission,
    signInWithProvider,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}