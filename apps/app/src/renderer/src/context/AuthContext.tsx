/**
 * @fileoverview Centralized authentication context for managing auth state across the application.
 * Eliminates excessive network requests by providing a single source of truth for auth data.
 */

'use client'
import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  ReactNode,
  useCallback
} from 'react'
import { supabase } from '../services/supabaseClient.js'
import type { Session, User } from '@supabase/supabase-js'

interface SessionProfile {
  user_id: string
  role: string
  app_settings: Record<string, any>
  entitlements: Record<string, any>
  quotas: Record<string, { limit: number; used: number }>
}

interface AuthContextType {
  session: Session | null
  user: User | null
  sessionProfile: SessionProfile | null
  isLoading: boolean
  hasEntitlement: (entitlement: string) => boolean
  refreshSessionProfile: () => Promise<void>
  signInWithProvider: (provider: 'google') => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

interface AuthProviderProps {
  children: ReactNode
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [session, setSession] = useState<Session | null>(null)
  const [user, setUser] = useState<User | null>(null)
  const [sessionProfile, setSessionProfile] = useState<SessionProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const isHandlingCallback = useRef(false)

  const fetchSessionProfile = async (authToken: string) => {
    // Popovers are identified by having a URL hash. The main window does not.
    const isPopover = window.location.hash.length > 1

    try {
      // Always try to get from main process cache first (faster, avoids redundant calls)
      if (window.electronAPI) {
        const cachedProfile = await window.electronAPI.invoke('session:get-profile')
        if (cachedProfile) {
          setSessionProfile(cachedProfile)
          console.log('[AuthContext] Session profile loaded from main process cache.')
          return
        }
      }

      // If no cache available, fetch from Supabase (only happens once per session)
      console.log('[AuthContext] No cached profile found, fetching from Supabase...')
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-session-profile`,
        {
          headers: {
            Authorization: `Bearer ${authToken}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!
          }
        }
      )

      if (response.ok) {
        const profile = await response.json()
        setSessionProfile(profile)
        // Cache the newly fetched profile in the main process for other windows/components
        if (window.electronAPI) {
          await window.electronAPI.invoke('session:set-profile', profile)
        }
        console.log('[AuthContext] Session profile fetched and cached:', profile)
      } else {
        if (response.status === 401) {
          console.log('[AuthContext] No active session or token expired. Needs login.')
        } else {
          throw new Error(`Failed to fetch session profile: ${response.statusText}`)
        }
        setSessionProfile(null)
        // Clear cache on error to prevent stale data
        if (window.electronAPI) {
          await window.electronAPI.invoke('session:clear-profile')
        }
      }
    } catch (error) {
      console.error('[AuthContext] Error fetching session profile:', error)
      setSessionProfile(null)
      // Clear cache on error
      if (window.electronAPI) {
        await window.electronAPI.invoke('session:clear-profile')
      }
    }
  }

  useEffect(() => {
    const getInitialSession = async () => {
      setIsLoading(true)
      const {
        data: { session }
      } = await supabase.auth.getSession()
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user) {
        await fetchSessionProfile(session.access_token)
      }
      setIsLoading(false)
    }

    getInitialSession()

    const { data: authListenerData } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)

      if (session?.user && (_event === 'SIGNED_IN' || _event === 'TOKEN_REFRESHED')) {
        setIsLoading(true)
        await fetchSessionProfile(session.access_token)
        setIsLoading(false)
      } else if (_event === 'SIGNED_OUT') {
        setSessionProfile(null)
        if (window.electronAPI) {
          window.electronAPI.invoke('session:clear-profile')
        }
        setIsLoading(false)
      }
    })

    const handleOAuthCallback = async (url: string) => {
      if (isHandlingCallback.current) {
        console.log('[AuthContext] OAuth callback is already being handled. Ignoring duplicate call.')
        return
      }
      isHandlingCallback.current = true

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
            // The onAuthStateChange listener will handle setting session and fetching the profile
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
          setIsLoading(false)
          isHandlingCallback.current = false
        }, 500)
      }
    }

    let unsubscribeOAuthListener: (() => void) | undefined
    let unsubscribeSignOutListener: (() => void) | undefined

    if (window.electronAPI) {
      unsubscribeOAuthListener = window.electronAPI.on(
        'electronAPI:oauth-callback',
        (url: string) => {
          handleOAuthCallback(url)
        }
      )
      unsubscribeSignOutListener = window.electronAPI.on('auth:execute-sign-out', () => {
        signOut()
      })
      window.electronAPI.send('renderer-auth-ready')
    }

    return () => {
      authListenerData.subscription?.unsubscribe()
      if (unsubscribeOAuthListener) unsubscribeOAuthListener()
      if (unsubscribeSignOutListener) unsubscribeSignOutListener()
    }
  }, [])

  const signInWithProvider = async (provider: 'google' | 'github') => {
    isHandlingCallback.current = false
    setIsLoading(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          skipBrowserRedirect: true,
          redirectTo: import.meta.env.DEV
            ? 'http://localhost:3000/auth/callback'
            : 'https://intevia.app/auth/callback',
          queryParams: { access_type: 'offline', prompt: 'consent' }
        }
      })

      if (error) throw error

      if (data.url && window.electronAPI) {
        await window.electronAPI.supabaseSignInWithOAuth({ urlToOpen: data.url })
      } else {
        throw new Error('OAuth URL or Electron API not available.')
      }
    } catch (error) {
      console.error(`[AuthContext] Error during ${provider} sign-in:`, error)
      setIsLoading(false)
    }
  }

  const signOut = async (): Promise<void> => {
    setIsLoading(true)
    try {
      await supabase.auth.signOut()
      // isLoading is set to false by the onAuthStateChange listener
    } catch (error) {
      console.error('[AuthContext] Error during sign out:', error)
      setIsLoading(false)
    }
  }

  const hasEntitlement = (entitlement: string): boolean => {
    return sessionProfile?.entitlements[entitlement] === true
  }

  const refreshSessionProfile = useCallback(async (): Promise<void> => {
    if (!session?.access_token) {
      console.warn('[AuthContext] Cannot refresh session profile: no active session')
      return
    }

    try {
      console.log('[AuthContext] Refreshing session profile...')
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-session-profile`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY!
          }
        }
      )

      if (response.ok) {
        const profile = await response.json()
        setSessionProfile(profile)
        // Update cache in main process
        if (window.electronAPI) {
          await window.electronAPI.invoke('session:set-profile', profile)
        }
        console.log('[AuthContext] Session profile refreshed successfully')
      } else {
        console.error('[AuthContext] Failed to refresh session profile:', response.status)
      }
    } catch (error) {
      console.error('[AuthContext] Error refreshing session profile:', error)
    }
  }, [session?.access_token])

  const value: AuthContextType = {
    session,
    user,
    sessionProfile,
    isLoading,
    hasEntitlement,
    refreshSessionProfile,
    signInWithProvider,
    signOut
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}