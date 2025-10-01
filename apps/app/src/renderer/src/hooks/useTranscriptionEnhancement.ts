/**
 * @fileoverview Hook for managing transcription enhancement service
 * Handles initialization, token management, and event subscriptions
 */

import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import type { SegmentEnhancedEvent, EnhancementErrorEvent } from '../services/transcription'

interface UseTranscriptionEnhancementOptions {
  onSegmentEnhanced?: (data: SegmentEnhancedEvent) => void
  onEnhancementError?: (error: EnhancementErrorEvent) => void
}

export function useTranscriptionEnhancement({
  onSegmentEnhanced,
  onEnhancementError,
}: UseTranscriptionEnhancementOptions = {}) {
  const { session, sessionProfile, isLoading } = useAuth()
  const isInitialized = useRef(false)
  const cleanupFunctions = useRef<(() => void)[]>([])

  // Initialize enhancement service when user is authenticated
  useEffect(() => {
    const initializeEnhancement = async () => {
      if (!session?.access_token || !sessionProfile || isLoading || isInitialized.current) {
        return
      }

      try {
        // Get Supabase configuration from environment
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
        const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

        if (!supabaseUrl || !supabaseAnonKey) {
          console.error('[useTranscriptionEnhancement] Missing Supabase configuration')
          return
        }

        console.log('[useTranscriptionEnhancement] Initializing enhancement service...')

        // Setup enhancement service with Supabase config and user token
        const success = await window.electronAPI.transcriptionSetupEnhancement(
          supabaseUrl,
          supabaseAnonKey,
          session.access_token
        )

        if (success) {
          console.log('[useTranscriptionEnhancement] Enhancement service initialized successfully')
          isInitialized.current = true

          // Set up event listeners
          if (onSegmentEnhanced) {
            const cleanup1 = window.electronAPI.on('transcription:enhanced', onSegmentEnhanced)
            cleanupFunctions.current.push(cleanup1)
          }

          if (onEnhancementError) {
            const cleanup2 = window.electronAPI.on('transcription:enhancement-error', onEnhancementError)
            cleanupFunctions.current.push(cleanup2)
          }
        } else {
          console.error('[useTranscriptionEnhancement] Failed to initialize enhancement service')
        }
      } catch (error) {
        console.error('[useTranscriptionEnhancement] Error initializing enhancement service:', error)
      }
    }

    initializeEnhancement()
  }, [session?.access_token, sessionProfile, isLoading, onSegmentEnhanced, onEnhancementError])

  // Update token when session changes
  useEffect(() => {
    const updateToken = async () => {
      if (session?.access_token && isInitialized.current) {
        try {
          await window.electronAPI.transcriptionSetEnhancementToken(session.access_token)
          console.log('[useTranscriptionEnhancement] Updated enhancement token')
        } catch (error) {
          console.error('[useTranscriptionEnhancement] Error updating enhancement token:', error)
        }
      }
    }

    updateToken()
  }, [session?.access_token])

  // Cleanup on unmount or sign out
  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach((cleanup) => cleanup())
      cleanupFunctions.current = []
      isInitialized.current = false
    }
  }, [])

  // Reset when user signs out
  useEffect(() => {
    if (!session) {
      cleanupFunctions.current.forEach((cleanup) => cleanup())
      cleanupFunctions.current = []
      isInitialized.current = false
    }
  }, [session])

  return {
    isEnhancementReady: isInitialized.current && !!session?.access_token,
  }
}