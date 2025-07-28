/**
 * @fileoverview Authentication context provider for Supabase OAuth integration.
 * Manages user authentication state, OAuth flows, and session persistence
 * in the Electron environment with custom protocol handling.
 */

"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient'; // Adjust path as necessary
import type { Session, User } from '@supabase/supabase-js';

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
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithProvider: (provider: 'google' | 'github') => Promise<void>; // Add more providers as needed
  signOut: () => Promise<void>;
}

/** @type {React.Context} Authentication context instance */
const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Props for the AuthProvider component.
 * 
 * @interface AuthProviderProps
 * @property {ReactNode} children - Child components to wrap with auth context
 */
interface AuthProviderProps {
  children: ReactNode;
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
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setIsLoading(true);
    // Check for an existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for auth state changes
    const { data: authListenerData } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    // Listen for the OAuth callback from the main Electron process
    const handleOAuthCallback = async (url: string) => {
      console.log('[AuthContext] Received OAuth callback URL from main process:', url);
      try {
        const urlObj = new URL(url.replace('intevia-ai://', 'http://localhost/')); // Make it a parseable URL
        const code = urlObj.searchParams.get('code');
        const errorParam = urlObj.searchParams.get('error');
        const errorDescription = urlObj.searchParams.get('error_description');

        if (errorParam) {
          console.error(`[AuthContext] OAuth Error in callback URL: ${errorParam} - ${errorDescription}`);
          setIsLoading(false); // Stop loading, show error to user potentially
          return;
        }

        if (code) {
          console.log('[AuthContext] Authorization code found in URL:', code);
          console.log('[AuthContext] Attempting to exchange code for session...');
          try {
            const { data, error } = await supabase.auth.exchangeCodeForSession(code);

            if (error) {
              console.error('[AuthContext] Error exchanging code for session:', error.message);
              // Handle error: maybe set an error state, setIsLoading(false)
              setIsLoading(false);
            } else {
              console.log('[AuthContext] Successfully exchanged code for session. Session data:', data.session);
              // The onAuthStateChange listener should now take over and update the
              // user and session state in the context.
              // setIsLoading(false); // onAuthStateChange should handle this if it reliably fires quickly
            }
          } catch (exchangeError) {
            console.error('[AuthContext] Exception during code exchange:', exchangeError);
            setIsLoading(false);
          }
        } else {
          console.warn('[AuthContext] No authorization code found in callback URL. URL was:', url);
          // Fallback to old logic if it's a hash-based token URL (less likely now)
          const hash = urlObj.hash;
          if (hash) {
            const params = new URLSearchParams(hash.substring(1)); // remove #
            const accessToken = params.get('access_token');
            const refreshToken = params.get('refresh_token');

            if (accessToken && refreshToken) {
              console.log('[AuthContext] Extracted tokens from HASH, setting session.');
              const { error: setError } = await supabase.auth.setSession({
                access_token: accessToken,
                refresh_token: refreshToken,
              });
              if (setError) {
                console.error('[AuthContext] Error setting session from HASH callback:', setError);
              } else {
                console.log('[AuthContext] Session set successfully from HASH callback.');
              }
            } else {
              console.warn('[AuthContext] Could not extract tokens from HASH callback URL fragment.');
            }
          } else {
            console.warn('[AuthContext] No hash fragment and no code found in callback URL.');
          }
          setIsLoading(false);
        }
      } catch (e) {
        console.error('[AuthContext] Error processing OAuth callback URL:', e);
        setIsLoading(false);
      }
    };

    let unsubscribeElectronListener: (() => void) | undefined;
    if (window.electronAPI && typeof window.electronAPI.on === 'function') {
      unsubscribeElectronListener = window.electronAPI.on('oauth-callback', (url: string) => {
        console.log('[AuthContext] Received oauth-callback event from main process with URL:', url);
        handleOAuthCallback(url);
      });
      console.log('[AuthContext] Subscribed to oauth-callback from Electron.');
    } else {
      console.warn('[AuthContext] window.electronAPI.on not available. OAuth callback might not work.');
    }

    return () => {
      authListenerData.subscription?.unsubscribe();
      if (unsubscribeElectronListener) {
        unsubscribeElectronListener();
        console.log('[AuthContext] Unsubscribed from oauth-callback.');
      }
    };
  }, []);

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
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          skipBrowserRedirect: true,
          redirectTo: 'intevia-ai://auth/callback', // Must match main.js and Supabase dashboard config
          // For PKCE flow, skipBrowserRedirect might be an option if not automatically handled
          queryParams: { access_type: 'offline', prompt: 'consent' }, // Example for Google
        },
      });

      if (error) throw error;

      if (data.url) {
        console.log(`[AuthContext] Initiating ${provider} OAuth. Opening URL: ${data.url}`);
        // @ts-ignore
        if (window.electronAPI && typeof window.electronAPI.supabaseSignInWithOAuth === 'function') {
          // @ts-ignore
          const mainProcessResponse = await window.electronAPI.supabaseSignInWithOAuth({ urlToOpen: data.url });
          if (mainProcessResponse?.error) {
            console.error(`[AuthContext] Error from main process opening OAuth URL: ${mainProcessResponse.error}`);
            throw new Error(`Main process error: ${mainProcessResponse.error}`);
          }
        } else {
          console.error('[AuthContext] window.electronAPI.supabaseSignInWithOAuth is not available.');
          throw new Error('Electron API for OAuth not available.');
        }
      } else {
        console.error(`[AuthContext] No URL returned from Supabase for ${provider} OAuth.`);
        throw new Error('No URL returned from Supabase for OAuth.');
      }
    } catch (error) {
      console.error(`[AuthContext] Error during ${provider} sign-in:`, error);
      // Potentially set an error state here to show to the user
      setIsLoading(false);
    }
    // setIsLoading(false) will be handled by onAuthStateChange or if an error occurs
  };

  /**
   * Signs out the current user and clears the session.
   * Updates the authentication state through the onAuthStateChange listener.
   * 
   * @async
   * @function signOut
   * @returns {Promise<void>}
   */
  const signOut = async () => {
    setIsLoading(true);
    await supabase.auth.signOut();
    // onAuthStateChange will set user and session to null, and isLoading to false
  };

  const value = {
    session,
    user,
    isLoading,
    signInWithProvider,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Custom hook to access the authentication context.
 * Must be used within an AuthProvider component tree.
 * 
 * @hook useAuth
 * @returns {AuthContextType} Authentication context value
 * @throws {Error} When used outside of AuthProvider
 */
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// The global declaration for window.electronAPI is now in apps/app/types/electron.d.ts
// Ensure that file is included in your tsconfig.json and recognized by TypeScript. 