/**
 * @fileoverview Hook for managing transcription enhancement service
 * Handles initialization and event subscriptions for local Ollama enhancement
 */

import { useEffect, useRef } from 'react'
import type { SegmentEnhancedEvent, EnhancementErrorEvent } from '../services/transcription'

interface UseTranscriptionEnhancementOptions {
  onSegmentEnhanced?: (data: SegmentEnhancedEvent) => void
  onEnhancementError?: (error: EnhancementErrorEvent) => void
}

export function useTranscriptionEnhancement({
  onSegmentEnhanced,
  onEnhancementError,
}: UseTranscriptionEnhancementOptions = {}) {
  const isInitialized = useRef(false)
  const cleanupFunctions = useRef<(() => void)[]>([])

  // Initialize enhancement service (local Ollama - no auth required)
  useEffect(() => {
    const initializeEnhancement = async () => {
      if (isInitialized.current) {
        return
      }

      try {
        console.log('[useTranscriptionEnhancement] Initializing local enhancement service...')

        const result = await window.electronAPI.transcriptionSetupEnhancement()

        if (result?.success) {
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
  }, [onSegmentEnhanced, onEnhancementError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanupFunctions.current.forEach((cleanup) => cleanup())
      cleanupFunctions.current = []
      isInitialized.current = false
    }
  }, [])

  return {
    isEnhancementReady: isInitialized.current,
  }
}
