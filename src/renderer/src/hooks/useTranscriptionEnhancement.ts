/**
 * @fileoverview Hook for initializing transcription enhancement service
 * Triggers Ollama connection setup and IntentionProcessor initialization.
 * Enhancement itself happens in the main process (transcription:data handler).
 */

import { useEffect, useRef } from 'react'

export function useTranscriptionEnhancement() {
  const isInitialized = useRef(false)

  useEffect(() => {
    const initializeEnhancement = async () => {
      if (isInitialized.current) {
        return
      }

      try {
        console.log('[useTranscriptionEnhancement] Initializing Ollama and IntentionProcessor...')

        const result = await window.electronAPI.transcriptionSetupEnhancement()

        if (result?.success) {
          console.log('[useTranscriptionEnhancement] Enhancement service initialized successfully')
          isInitialized.current = true
        } else {
          console.error('[useTranscriptionEnhancement] Failed to initialize enhancement service')
        }
      } catch (error) {
        console.error(
          '[useTranscriptionEnhancement] Error initializing enhancement service:',
          error
        )
      }
    }

    initializeEnhancement()
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isInitialized.current = false
    }
  }, [])

  return {
    isEnhancementReady: isInitialized.current
  }
}
