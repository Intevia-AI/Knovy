/**
 * @fileoverview Screen Sharing and Recording Hook
 * @module useScreenShare
 * @description React hook for capturing and recording screen content with audio
 */

import { useState, useRef, useCallback, useEffect } from 'react'
import { cleanupStream, cleanupRecorder } from '@/lib/utils'
import { useSegmentRecorder, SEGMENT_MS } from '@/hooks/useSegmentRecorder' // Import SEGMENT_MS
import type { Segment } from '@/types'
import { supabase } from '@/lib/supabaseClient'

/**
 * @constant {number} SYSTEM_AUDIO_SEGMENT_MS - Duration of each system audio segment in milliseconds
 * @description Controls how frequently complete system audio segments are created
 */
const SYSTEM_AUDIO_SEGMENT_MS = SEGMENT_MS

/**
 * @constant {number} SYSTEM_AUDIO_CHUNK_MS - Internal timeslice for system audio MediaRecorder in milliseconds
 * @description Controls how frequently the system audio MediaRecorder provides data chunks
 */
const SYSTEM_AUDIO_CHUNK_MS = 1000 // Internal chunk collection interval

/**
 * React hook for screen sharing and recording with audio
 *
 * @returns {Object} Screen sharing controls and state
 * @returns {boolean} isScreenSharing - Whether screen sharing is active
 * @returns {number} recordingDuration - Current recording duration in seconds
 * @returns {MediaStream|null} micStream - Current microphone MediaStream
 * @returns {MediaStream|null} currentSystemAudioStream - Current system audio MediaStream
 * @returns {Segment[]} micSegments - Array of recorded microphone audio segments
 * @returns {Segment[]} systemAudioSegments - Array of recorded system audio segments
 * @returns {string} micMimeType - MIME type of the recorded microphone audio
 * @returns {string} systemAudioMimeType - MIME type of the recorded system audio
 * @returns {React.RefObject<MediaStream|null>} screenStreamRef - Reference to the screen MediaStream
 * @returns {React.RefObject<HTMLVideoElement>} screenPreviewRef - Reference to the video preview element
 * @returns {function} toggleScreenShare - Function to toggle screen sharing on/off
 *
 * @example
 * ```tsx
 * const {
 *   isScreenSharing,
 *   recordingDuration,
 *   screenPreviewRef,
 *   toggleScreenShare
 * } = useScreenShare();
 *
 * return (
 *   <div>
 *     <video ref={screenPreviewRef} />
 *     <button onClick={toggleScreenShare}>
 *       {isScreenSharing ? 'Stop' : 'Start'} Screen Share
 *     </button>
 *     {isScreenSharing && <div>Recording: {recordingDuration}s</div>}
 *   </div>
 * );
 * ```
 */
export function useScreenShare() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [restartRequested, setRestartRequested] = useState(false)
  const [recordingDuration, setRecordingDuration] = useState(0)
  const [currentSystemAudioStream, setCurrentSystemAudioStream] = useState<MediaStream | null>(null)
  const [systemAudioSegments, setSystemAudioSegments] = useState<Segment[]>([])
  const [systemAudioMimeType, setSystemAudioMimeType] = useState<string>('')

  const screenStreamRef = useRef<MediaStream | null>(null)
  const screenPreviewRef = useRef<HTMLVideoElement>(null)
  const systemAudioRecorderRef = useRef<MediaRecorder | null>(null)
  const systemAudioChunksRef = useRef<Blob[]>([]) // Ref for current system audio chunks
  const systemAudioTimerRef = useRef<NodeJS.Timeout | null>(null) // Timer for system audio segmentation
  const isStoppingSystemAudioRef = useRef<boolean>(false) // Flag for intentional stop

  const {
    start: startMicRecording,
    stop: stopMicRecording,
    micStream,
    mimeType: micMimeType,
    currentMicChunksRef // Get ref to current mic chunks
  } = useSegmentRecorder()

  // --- System Audio Blob Creation and Dispatch ---
  const makeSystemAudioBlobAndDispatch = useCallback(() => {
    if (systemAudioChunksRef.current.length === 0) return
    try {
      const blob = new Blob(systemAudioChunksRef.current, {
        type: systemAudioMimeType
      })
      systemAudioChunksRef.current = [] // Clear chunks
      if (blob.size > 0) {
        console.log(`[ScreenShare] Creating system audio segment, size: ${blob.size}`)
        setSystemAudioSegments((prev) => [...prev, { blob, timestamp: Date.now() }])
      } else {
        console.warn('[ScreenShare] System audio blob created but size is 0.')
      }
    } catch (error) {
      console.error('[ScreenShare] Error creating/dispatching system audio blob:', error)
      systemAudioChunksRef.current = []
    }
  }, [systemAudioMimeType])

  const stopScreenShare = useCallback(async () => {
    console.log('[ScreenShare] Stopping screen share and recordings...')
    stopMicRecording()

    // Stop system audio recording process
    isStoppingSystemAudioRef.current = true
    if (systemAudioTimerRef.current) {
      clearInterval(systemAudioTimerRef.current)
      systemAudioTimerRef.current = null
    }
    if (systemAudioRecorderRef.current && systemAudioRecorderRef.current.state !== 'inactive') {
      try {
        systemAudioRecorderRef.current.stop() // Trigger final onstop
      } catch (e) {
        console.warn('[ScreenShare] Error stopping system recorder:', e)
        makeSystemAudioBlobAndDispatch() // Manual dispatch if stop fails
        systemAudioRecorderRef.current = null
      }
    } else {
      makeSystemAudioBlobAndDispatch() // Dispatch remaining if inactive
    }

    // Log duration before cleaning up
    if (sessionId && recordingDuration > 0) {
      const { error: logError } = await supabase.functions.invoke('session-manager', {
        body: {
          log_type: 'duration',
          session_id: sessionId,
          duration_seconds: Math.round(recordingDuration)
        }
      })
      if (logError) {
        console.error('[ScreenShare] Failed to log session duration:', logError)
      }
    }

    // Cleanup screen stream
    cleanupStream(screenStreamRef)
    if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null

    setCurrentSystemAudioStream(null)
    setIsScreenSharing(false)
    setRecordingDuration(0)
    setSessionId(null) // Reset session ID
    // Reset states
    setSystemAudioMimeType('')

    console.log('[ScreenShare] Screen share stopped.')
  }, [stopMicRecording, makeSystemAudioBlobAndDispatch, sessionId, recordingDuration])

  // --- Start System Audio Recorder (Internal) ---
  const startSystemAudioRecorderInternal = useCallback(
    (stream: MediaStream) => {
      if (!stream || !MediaRecorder) {
        console.error(
          '[ScreenShare] Cannot start system audio recorder: No stream or MediaRecorder support.'
        )
        return
      }
      isStoppingSystemAudioRef.current = false
      cleanupRecorder(systemAudioRecorderRef)
      systemAudioChunksRef.current = []

      try {
        // Determine mime type (same logic as mic)
        const potentialMimeTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm']
        let supportedMimeType = ''
        for (const mime of potentialMimeTypes) {
          if (MediaRecorder.isTypeSupported(mime)) {
            supportedMimeType = mime
            break
          }
        }
        console.log(`[ScreenShare] Using system audio MIME type: ${supportedMimeType || 'default'}`)
        setSystemAudioMimeType(supportedMimeType)

        const recorder = new MediaRecorder(stream, {
          mimeType: supportedMimeType || undefined
        })
        systemAudioRecorderRef.current = recorder

        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) {
            systemAudioChunksRef.current.push(e.data)
          }
        }

        recorder.onstop = () => {
          console.log('[ScreenShare] System audio recorder stopped.')
          makeSystemAudioBlobAndDispatch()
          // Use the 'stream' from the closure for restarting, not currentSystemAudioStream from state
          if (!isStoppingSystemAudioRef.current && stream.active) {
            // Check stream.active instead of currentSystemAudioStream
            console.log('[ScreenShare] Restarting system audio recorder...')
            recorder.start(SYSTEM_AUDIO_CHUNK_MS) // Restart the same recorder instance
          } else {
            console.log('[ScreenShare] Not restarting system audio recorder.')
            systemAudioRecorderRef.current = null
          }
        }

        recorder.onerror = (event) => {
          console.error('[ScreenShare] System MediaRecorder error:', event)
          stopScreenShare() // Stop everything on error
        }

        console.log(
          `[ScreenShare] Starting system audio recorder with timeslice: ${SYSTEM_AUDIO_CHUNK_MS}ms`
        )
        recorder.start(SYSTEM_AUDIO_CHUNK_MS)

        if (systemAudioTimerRef.current) {
          clearInterval(systemAudioTimerRef.current)
        }
        systemAudioTimerRef.current = setInterval(() => {
          if (systemAudioRecorderRef.current?.state === 'recording') {
            console.log(
              '[ScreenShare] Interval: Stopping system audio recorder to finalize segment.'
            )
            systemAudioRecorderRef.current.stop()
          }
        }, SYSTEM_AUDIO_SEGMENT_MS)
      } catch (recorderError) {
        console.error('[ScreenShare] Failed to create/start system MediaRecorder:', recorderError)
        alert(
          `無法建立系統音訊錄製器: ${recorderError instanceof Error ? recorderError.message : String(recorderError)}`
        )
        stopScreenShare()
      }
    },
    [makeSystemAudioBlobAndDispatch, currentSystemAudioStream, stopScreenShare]
  )

  useEffect(() => {
    console.log('[useScreenShare Timer Effect] Running effect...', { isScreenSharing, sessionId })

    // Only the main window (no hash) should broadcast its state.
    if (window.location.hash === '' && window.electronAPI) {
      console.log(
        `[useScreenShare] Sending state to main process: isScreenSharing = ${isScreenSharing}`
      )
      window.electronAPI.send('set-screenshare-state', isScreenSharing)
    }

    let timer: NodeJS.Timeout | null = null

    if (isScreenSharing && sessionId) {
      console.log('[useScreenShare Timer Effect] Condition MET. Starting timer.')
      setRecordingDuration(0)

      timer = setInterval(() => {
        setRecordingDuration((prevDuration) => {
          const newDuration = prevDuration + 1

          // Send IPC event for real-time UI updates
          window.electronAPI.send('session:duration-update', newDuration)

          // Log every 60 seconds
          if (newDuration > 0 && newDuration % 60 === 0) {
            console.log(
              `[ScreenShare] Periodically logging session ${sessionId} with duration ${newDuration}s`
            )
            supabase.functions
              .invoke('session-manager', {
                body: {
                  log_type: 'duration',
                  session_id: sessionId,
                  duration_seconds: newDuration
                }
              })
              .then(({ error }) => {
                if (error) {
                  console.error('[ScreenShare] Failed to periodically log session duration:', error)
                }
              })
          }
          return newDuration
        })
      }, 1000)
    } else {
      console.log(
        '[useScreenShare Timer Effect] Condition FAILED. Clearing timer and resetting duration.'
      )
      setRecordingDuration(0)
      // If stopping, send a final zero-duration update, but only from the main controller
      if (window.location.hash === '') {
        window.electronAPI.send('session:duration-update', 0)
      }
    }

    return () => {
      console.log('[useScreenShare Timer Effect] Cleanup function running.')
      if (timer) clearInterval(timer)
    }
  }, [isScreenSharing, sessionId])

  // Screen preview effect
  useEffect(() => {
    console.log('[ScreenShare] Screen preview effect triggered:', {
      isScreenSharing,
      hasVideoTracks: screenStreamRef.current?.getVideoTracks().length,
      screenPreviewRef: screenPreviewRef.current
    })

    if (
      isScreenSharing &&
      screenPreviewRef.current &&
      screenStreamRef.current?.getVideoTracks().length
    ) {
      console.log('[ScreenShare] Setting up video preview...')
      const videoStream = new MediaStream(screenStreamRef.current.getVideoTracks())
      console.log('[ScreenShare] Created video stream:', videoStream)

      // Ensure the video element is ready
      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = videoStream
        screenPreviewRef.current.muted = true

        // Add event listeners for debugging
        screenPreviewRef.current.onloadedmetadata = () => {
          console.log('[ScreenShare] Video metadata loaded')
        }

        screenPreviewRef.current.onerror = (e) => {
          console.error('[ScreenShare] Video error:', e)
        }

        screenPreviewRef.current
          .play()
          .then(() => console.log('[ScreenShare] Video started playing'))
          .catch((e) => console.error('[ScreenShare] Video play error:', e))
      }
    } else if (!isScreenSharing && screenPreviewRef.current) {
      console.log('[ScreenShare] Clearing video preview')
      screenPreviewRef.current.srcObject = null
    }

    // Cleanup function
    return () => {
      console.log('[ScreenShare] Cleaning up video preview')
      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = null
      }
    }
  }, [isScreenSharing])

  const startScreenShare = useCallback(async () => {
    console.log('[ScreenShare] Attempting to start screen share...')
    // Reset previous state
    const newSessionId = crypto.randomUUID()
    setSessionId(newSessionId)
    console.log(`[ScreenShare] New session started: ${newSessionId}`)

    setSystemAudioMimeType('')
    setRecordingDuration(0)
    setCurrentSystemAudioStream(null)
    cleanupRecorder(systemAudioRecorderRef)
    systemAudioChunksRef.current = []
    if (systemAudioTimerRef.current) clearInterval(systemAudioTimerRef.current)

    try {
      // This will trigger the custom source picker in the main process
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true
      })

      // --- Mic Recording ---
      await startMicRecording()

      // --- System Audio Recording ---
      const systemAudioTracks = stream.getAudioTracks()
      if (systemAudioTracks.length > 0) {
        const systemAudioStream = new MediaStream(systemAudioTracks)
        setCurrentSystemAudioStream(systemAudioStream)
        startSystemAudioRecorderInternal(systemAudioStream)
      } else {
        console.warn('[ScreenShare] No system audio track found in the selected source.')
      }

      screenStreamRef.current = stream
      setIsScreenSharing(true)

      // Handle when the user stops sharing via the browser/OS UI
      stream.getVideoTracks()[0].onended = () => {
        console.log('[ScreenShare] Screen sharing stopped by user via OS/browser UI.')
        stopScreenShare()
      }
    } catch (err) {
      console.error('[ScreenShare] Error starting screen share:', err)
      if (err instanceof DOMException) {
        console.error(`[ScreenShare] DOMException: name=${err.name}, message=${err.message}`)
      }
      // User might have cancelled the picker
      stopScreenShare() // Clean up everything if it fails
    }
  }, [startMicRecording, stopScreenShare, startSystemAudioRecorderInternal])

  const cancelScreenShare = useCallback(() => {
    // This function can be called if the user cancels the source picker
    console.log('[ScreenShare] User cancelled the process during source selection.')
    // No need to call stopScreenShare, as nothing has been started yet.
    // We just need to ensure any UI state is reset, which is handled by the component using the hook.
  }, [])

  const toggleScreenShare = useCallback(async () => {
    if (isScreenSharing) {
      await stopScreenShare()
    } else {
      await startScreenShare()
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare])

  const restartScreenShare = useCallback(() => {
    if (isScreenSharing) {
      setRestartRequested(true)
      stopScreenShare()
    }
  }, [isScreenSharing, stopScreenShare])

  useEffect(() => {
    if (restartRequested && !isScreenSharing) {
      setRestartRequested(false)
      startScreenShare()
    }
  }, [restartRequested, isScreenSharing, startScreenShare])

  return {
    isScreenSharing,
    recordingDuration,
    micStream,
    currentSystemAudioStream,
    micMimeType,
    systemAudioMimeType,
    screenStreamRef, // Ref for the video element
    screenPreviewRef,
    toggleScreenShare,
    restartScreenShare,
    cancelScreenShare // Expose the cancel function
  }
}
