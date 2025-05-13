"use client";
import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { supabase } from '../lib/supabaseClient'; // Adjust path as necessary
import type { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signInWithProvider: (provider: 'google' | 'github') => Promise<void>; // Add more providers as needed
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

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
    const handleOAuthCallback = (url: string) => {
      console.log('[AuthContext] Received OAuth callback URL:', url);
      try {
        // The URL from Electron will be like: intevia-ai://auth/callback#access_token=XXX&refresh_token=YYY&...
        const hash = new URL(url.replace('intevia-ai://', 'http://localhost/')).hash;
        if (hash) {
          const params = new URLSearchParams(hash.substring(1)); // remove #
          const accessToken = params.get('access_token');
          const refreshToken = params.get('refresh_token');
          // We might also get 'provider_token' and 'provider_refresh_token' for some providers

          if (accessToken && refreshToken) {
            console.log('[AuthContext] Extracted tokens, setting session.');
            supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            }).then(({ error }) => {
              if (error) {
                console.error('[AuthContext] Error setting session from callback:', error);
              } else {
                console.log('[AuthContext] Session set successfully from callback.');
                // onAuthStateChange should handle updating user and session state
              }
            });
          } else {
            console.warn('[AuthContext] Could not extract tokens from callback URL fragment.');
          }
        } else {
          console.warn('[AuthContext] No hash fragment found in callback URL.');
        }
      } catch (e) {
        console.error('[AuthContext] Error processing OAuth callback URL:', e);
      }
    };

    let unsubscribeElectronListener: (() => void) | undefined;
    if (window.electronAPI && typeof window.electronAPI.on === 'function') {
      unsubscribeElectronListener = window.electronAPI.on('oauth-callback', handleOAuthCallback);
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

  const signInWithProvider = async (provider: 'google' | 'github') => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: 'intevia-ai://auth/callback', // Must match main.js and Supabase dashboard config
          // For PKCE flow, skipBrowserRedirect might be an option if not automatically handled
          // queryParams: { access_type: 'offline', prompt: 'consent' }, // Example for Google
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

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// The global declaration for window.electronAPI is now in apps/app/types/electron.d.ts
// Ensure that file is included in your tsconfig.json and recognized by TypeScript. 