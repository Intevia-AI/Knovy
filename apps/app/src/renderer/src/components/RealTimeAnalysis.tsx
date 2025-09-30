'use client'

import { useEffect, useRef } from 'react'
import { TranscriptionFactory, TranscriptionProcessor } from '@/services/transcription'
import { useAuth } from '@/hooks/useAuth'

// Configuration: Change this to set the real-time transcription model size
// Options: 'tiny' (75MB, fastest), 'base' (142MB, better), 'small' (466MB, good+), 'medium' (1.5GB, best)
// Note: For real-time use, 'tiny' or 'base' are recommended for performance
const REALTIME_MODEL_SIZE: 'tiny' | 'base' | 'small' | 'medium' = 'base'

interface RealTimeAnalysisProps {
  onTextResponse?: (
    text: string,
    turnComplete: boolean,
    sourceType?: 'microphone' | 'system'
  ) => void // 當收到文字回應時的回呼
  systemAudioStream?: MediaStream
  isScreenSharing: boolean
  customPrompt?: string
  language?: string
}

export default function RealTimeAnalysis({
  onTextResponse,
  systemAudioStream,
  isScreenSharing,
  customPrompt,
  language
}: RealTimeAnalysisProps) {
  const { hasEntitlement } = useAuth()
  const canUseKeywordSearch = hasEntitlement('allow_ai_action:keyword-search')
  const micTextBufferRef = useRef('')
  const systemTextBufferRef = useRef('')
  const animationFrameId = useRef<number | null>(null)

  // Refs to track current audio processing instances
  const audioContextRef = useRef<AudioContext | null>(null)
  const systemAudioWorkletNodeRef = useRef<AudioWorkletNode | null>(null)
  const systemAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const systemAnalyserRef = useRef<AnalyserNode | null>(null)

  // Refs for transcription factory and processors
  const transcriptionFactoryRef = useRef<TranscriptionFactory | null>(null)
  const micProcessorRef = useRef<TranscriptionProcessor | null>(null)
  const systemProcessorRef = useRef<TranscriptionProcessor | null>(null)

  useEffect(() => {
    if (!isScreenSharing) {
      return
    }

    // Set up error handling for transcription issues
    const handleTranscriptionError = (errorData: { error: string; code: string }) => {
      console.error(`[RealTimeAnalysis] Transcription error (${errorData.code}):`, errorData.error)
      // Could show user notification here in the future
    }

    const handleTranscriptionWarning = (warningData: { warning: string; transcriptId: string }) => {
      console.warn(
        `[RealTimeAnalysis] Transcription warning for ${warningData.transcriptId}:`,
        warningData.warning
      )
    }

    const handleTranscriptionProcessed = (processedData: {
      transcriptId: string
      broadcastCount: number
      totalWindows: number
    }) => {
      console.log(
        `[RealTimeAnalysis] Transcript ${processedData.transcriptId} processed successfully: ${processedData.broadcastCount}/${processedData.totalWindows} windows`
      )
    }

    const unsubscribeError = (window as any).electronAPI?.on(
      'transcription:error',
      handleTranscriptionError
    )
    const unsubscribeWarning = (window as any).electronAPI?.on(
      'transcription:warning',
      handleTranscriptionWarning
    )
    const unsubscribeProcessed = (window as any).electronAPI?.on(
      'transcription:processed',
      handleTranscriptionProcessed
    )

    let transcriptionFactory: TranscriptionFactory | null = null
    let micProcessor: TranscriptionProcessor | null = null
    let systemProcessor: TranscriptionProcessor | null = null
    let audioContext: AudioContext | null = null
    let micAudioWorkletNode: AudioWorkletNode | null = null
    let systemAudioWorkletNode: AudioWorkletNode | null = null
    let mediaStream: MediaStream | null = null
    let micAudioSource: MediaStreamAudioSourceNode | null = null
    let systemAudioSource: MediaStreamAudioSourceNode | null = null
    let shouldSendAudio = false

    const processTranscriptionResponse = (
      text: string,
      textBufferRef: React.MutableRefObject<string>,
      sourceType: 'microphone' | 'system',
      canHighlightKeywords: boolean
    ) => {
      textBufferRef.current += text

      while (true) {
        const buffer = textBufferRef.current
        const transIndex = buffer.indexOf('TRANSCRIPTION:')

        // If no transcription marker found, break and wait for more data
        if (transIndex === -1) {
          break
        }

        const keyIndex = buffer.indexOf('KEYWORDS:', transIndex)
        const nextTransIndex = buffer.indexOf('TRANSCRIPTION:', transIndex + 1)

        let currentBlock: string
        let remainingBuffer: string
        let hasCompleteBlock = false

        if (keyIndex !== -1 && (nextTransIndex === -1 || keyIndex < nextTransIndex)) {
          // We have a complete TRANSCRIPTION + KEYWORDS block
          if (nextTransIndex !== -1) {
            currentBlock = buffer.substring(transIndex, nextTransIndex)
            remainingBuffer = buffer.substring(nextTransIndex)
          } else {
            currentBlock = buffer.substring(transIndex)
            remainingBuffer = ''
          }
          hasCompleteBlock = true
        } else if (nextTransIndex !== -1) {
          // We have a TRANSCRIPTION block but no KEYWORDS, but there's a next TRANSCRIPTION
          // Process the incomplete block without KEYWORDS
          currentBlock = buffer.substring(transIndex, nextTransIndex)
          remainingBuffer = buffer.substring(nextTransIndex)
          hasCompleteBlock = true
        } else {
          // We have a TRANSCRIPTION but no KEYWORDS and no next TRANSCRIPTION
          // Check if the buffer is long enough or if we should wait for more data
          const partialBlock = buffer.substring(transIndex)
          if (partialBlock.length > 200 || partialBlock.includes('\n\n')) {
            // Process what we have - it's likely a complete transcription without keywords
            currentBlock = partialBlock
            remainingBuffer = ''
            hasCompleteBlock = true
          } else {
            // Buffer is short, wait for more data
            break
          }
        }

        if (hasCompleteBlock) {
          // Try to extract transcription with keywords first
          let transcriptionMatch = currentBlock.match(/TRANSCRIPTION:\s*([\s\S]*?)KEYWORDS:/s)
          let keywordsMatch = currentBlock.match(/KEYWORDS:\s*([\s\S]*)/s)

          // If no keywords section, try to extract just the transcription
          if (!transcriptionMatch) {
            transcriptionMatch = currentBlock.match(/TRANSCRIPTION:\s*([\s\S]*)/s)
          }

          if (transcriptionMatch) {
            const transcription = transcriptionMatch[1].replace(/search web/g, '').trim()

            if (transcription && onTextResponse) {
              const keywordsStr = keywordsMatch ? keywordsMatch[1].trim() : ''
              let keywords: string[] = []
              if (keywordsStr) {
                keywords = keywordsStr
                  .split(',')
                  .map((k) => k.trim())
                  .filter((k) => k)
              }

              // Split transcription into individual sentences
              const splitIntoSentences = (text: string): string[] => {
                // Chinese sentence endings: 。？！
                // Also handle edge cases like ellipsis ... or multiple punctuation
                const sentences = text.split(/([。？！]+)/).filter((part) => part.trim())

                const result: string[] = []
                for (let i = 0; i < sentences.length; i += 2) {
                  const sentence = sentences[i]?.trim()
                  const punctuation = sentences[i + 1] || ''

                  if (sentence) {
                    result.push(sentence + punctuation)
                  }
                }

                // If no clear sentence boundaries found, return original as single sentence
                return result.length > 0 ? result : [text]
              }

              const sentences = splitIntoSentences(transcription)

              sentences.forEach((sentence, index) => {
                if (sentence.trim()) {
                  let highlightedSentence = sentence
                  if (canHighlightKeywords && keywords.length > 0) {
                    const regex = new RegExp(`(${keywords.join('|')})`, 'gi')
                    highlightedSentence = sentence.replace(regex, '`$1`')
                  }

                  console.log(
                    `[RealTimeAnalysis] Sending sentence ${index + 1}/${sentences.length} to main process:`,
                    {
                      sourceType,
                      sentence: `"${sentence}"`,
                      highlighted: `"${highlightedSentence}"`,
                      hasKeywords: keywords.length > 0,
                      keywords: keywords,
                      blockType: keywordsMatch ? 'complete' : 'transcription-only'
                    }
                  )

                  onTextResponse(highlightedSentence, false, sourceType)
                }
              })
            }
          }

          textBufferRef.current = remainingBuffer
        } else {
          // No complete block available, wait for more data
          break
        }
      }
    }

    const startAudioProcessing = async () => {
      console.log('[RealTimeAnalysis] Starting dual audio processing with language:', language)

      // Initialize transcription factory with local transcription only
      transcriptionFactory = new TranscriptionFactory({
        modelSize: REALTIME_MODEL_SIZE, // Configurable model size for real-time performance
        enableNoiseFiltering: true, // Enable comprehensive noise filtering
        energyThreshold: 0.01 // Default energy threshold for microphone
      })

      transcriptionFactoryRef.current = transcriptionFactory

      // Initialize the factory
      const factoryInitialized = await transcriptionFactory.initialize()
      if (!factoryInitialized) {
        console.error('[RealTimeAnalysis] Failed to initialize transcription factory')

        // Check if it's a model availability issue and notify the app
        try {
          const localClient = transcriptionFactory.getLocalClient()
          const isAvailable = await localClient.isAvailable()
          if (!isAvailable) {
            console.error('[RealTimeAnalysis] Models not available, triggering model error handler')
            // Notify the main app about the model error
            if ((window as any).electronAPI?.send) {
              ;(window as any).electronAPI.send('transcription:model-error', {
                sourceType: 'session-start',
                error: 'No whisper models available during session start'
              })
            }
          }
        } catch (error) {
          console.error('[RealTimeAnalysis] Error checking model availability:', error)
        }

        return
      }

      // Create transcription processors for both audio sources
      micProcessor = await transcriptionFactory.createTranscriptionProcessor(
        'microphone',
        (text, turnComplete, sourceType) =>
          processTranscriptionResponse(text, micTextBufferRef, sourceType, canUseKeywordSearch),
        () => {
          console.log('[RealTimeAnalysis] Microphone transcription processor setup complete')
          shouldSendAudio = true
        },
        language
      )

      systemProcessor = await transcriptionFactory.createTranscriptionProcessor(
        'system',
        (text, turnComplete, sourceType) =>
          processTranscriptionResponse(text, systemTextBufferRef, sourceType, canUseKeywordSearch),
        () => {
          console.log('[RealTimeAnalysis] System audio transcription processor setup complete')
        },
        language
      )

      // Store refs for cleanup
      micProcessorRef.current = micProcessor
      systemProcessorRef.current = systemProcessor

      // Connect both processors
      await Promise.all([micProcessor.connect(), systemProcessor.connect()])

      try {
        audioContext = new AudioContext({ sampleRate: 16000 })
        audioContextRef.current = audioContext

        await Promise.all([
          audioContext.audioWorklet.addModule('worklets/mic-audio-processor.js'),
          audioContext.audioWorklet.addModule('worklets/system-audio-processor.js')
        ])

        micAudioWorkletNode = new AudioWorkletNode(audioContext, 'mic-audio-processor', {
          processorOptions: {
            bufferSize: 8192
          }
        })

        systemAudioWorkletNode = new AudioWorkletNode(audioContext, 'system-audio-processor', {
          processorOptions: {
            bufferSize: 8192
          }
        })
        systemAudioWorkletNodeRef.current = systemAudioWorkletNode

        micAudioWorkletNode.port.onmessage = (event) => {
          const { pcmData, sourceType } = event.data
          if (micProcessor && shouldSendAudio && sourceType === 'microphone') {
            try {
              const pcmArray = new Uint8Array(pcmData)
              const b64Data = btoa(String.fromCharCode.apply(null, Array.from(pcmArray)))
              micProcessor.sendAudioChunk(b64Data, 'audio/pcm')
            } catch (error) {
              console.error('[RealTimeAnalysis] Error sending microphone audio chunk:', error)
            }
          }
        }

        systemAudioWorkletNode.port.onmessage = (event) => {
          const { pcmData, sourceType } = event.data
          if (systemProcessor && shouldSendAudio && sourceType === 'system') {
            try {
              const pcmArray = new Uint8Array(pcmData)
              const b64Data = btoa(String.fromCharCode.apply(null, Array.from(pcmArray)))
              systemProcessor.sendAudioChunk(b64Data, 'audio/pcm')
            } catch (error) {
              console.error('[RealTimeAnalysis] Error sending system audio chunk:', error)
            }
          }
        }

        const micAnalyser = audioContext.createAnalyser()
        micAnalyser.fftSize = 256

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micAudioSource = audioContext.createMediaStreamSource(mediaStream)
        micAudioSource.connect(micAnalyser)
        micAnalyser.connect(micAudioWorkletNode)

        // Function to connect system audio stream
        const connectSystemAudio = (stream: MediaStream | null) => {
          if (stream && audioContext && systemAudioWorkletNode) {
            // Disconnect previous system audio source
            if (systemAudioSource) {
              systemAudioSource.disconnect()
            }

            const systemAnalyser = audioContext.createAnalyser()
            systemAnalyser.fftSize = 256
            systemAnalyserRef.current = systemAnalyser

            systemAudioSource = audioContext.createMediaStreamSource(stream)
            systemAudioSourceRef.current = systemAudioSource
            systemAudioSource.connect(systemAnalyser)
            systemAnalyser.connect(systemAudioWorkletNode)
            console.log('[RealTimeAnalysis] System audio source connected')
          }
        }

        // Connect initial system audio stream
        connectSystemAudio(systemAudioStream)

        const draw = () => {
          const micDataArray = new Uint8Array(micAnalyser.frequencyBinCount)
          micAnalyser.getByteFrequencyData(micDataArray)
          const micLevel = micDataArray.reduce((sum, value) => sum + value, 0) / micDataArray.length

          let systemLevel = 0
          if (systemAnalyserRef.current) {
            const systemDataArray = new Uint8Array(systemAnalyserRef.current.frequencyBinCount)
            systemAnalyserRef.current.getByteFrequencyData(systemDataArray)
            systemLevel =
              systemDataArray.reduce((sum, value) => sum + value, 0) / systemDataArray.length
          }

          const normalizedMicLevel = (micLevel / 140) * 100
          const normalizedSystemLevel = (systemLevel / 140) * 100

          ;(window as any).electronAPI.send('audio:level-update', {
            micLevel: Math.min(normalizedMicLevel, 100),
            systemLevel: Math.min(normalizedSystemLevel, 100)
          })

          animationFrameId.current = requestAnimationFrame(draw)
        }
        draw()
      } catch (error) {
        console.error('[RealTimeAnalysis] Error starting audio processing:', error)
      }
    }

    startAudioProcessing()

    return () => {
      console.log('[RealTimeAnalysis] Stopping dual audio processing...')

      // Clean up error handlers
      unsubscribeError?.()
      unsubscribeWarning?.()
      unsubscribeProcessed?.()

      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
      shouldSendAudio = false

      // Log connection stats before disconnecting
      if (micProcessor) {
        const micStats = micProcessor.getStats()
        console.log('[RealTimeAnalysis] Microphone processor stats:', micStats)
        micProcessor.disconnect()
        micProcessor = null
        micProcessorRef.current = null
      }

      if (systemProcessor) {
        const systemStats = systemProcessor.getStats()
        console.log('[RealTimeAnalysis] System audio processor stats:', systemStats)
        systemProcessor.disconnect()
        systemProcessor = null
        systemProcessorRef.current = null
      }

      if (transcriptionFactory) {
        console.log('[RealTimeAnalysis] Cleaning up transcription factory')
        transcriptionFactory = null
        transcriptionFactoryRef.current = null
      }

      mediaStream?.getTracks().forEach((track) => track.stop())
      mediaStream = null

      micAudioSource?.disconnect()
      micAudioSource = null

      systemAudioSource?.disconnect()
      systemAudioSource = null

      micAudioWorkletNode?.disconnect()
      micAudioWorkletNode = null

      systemAudioWorkletNode?.disconnect()
      systemAudioWorkletNode = null

      audioContext?.close().catch(console.error)
      audioContext = null

      // Clear refs
      audioContextRef.current = null
      systemAudioWorkletNodeRef.current = null
      systemAudioSourceRef.current = null
      systemAnalyserRef.current = null
    }
  }, [isScreenSharing, language, customPrompt, onTextResponse]) // Removed systemAudioStream dependency

  // Separate effect to handle system audio stream changes without restarting transcription
  useEffect(() => {
    if (!isScreenSharing || !systemAudioStream) return

    console.log(
      '[RealTimeAnalysis] System audio stream changed, reconnecting without restarting transcription'
    )

    const audioContext = audioContextRef.current
    const systemAudioWorkletNode = systemAudioWorkletNodeRef.current

    if (audioContext && systemAudioWorkletNode) {
      // Disconnect previous system audio source
      if (systemAudioSourceRef.current) {
        systemAudioSourceRef.current.disconnect()
      }

      try {
        const systemAnalyser = audioContext.createAnalyser()
        systemAnalyser.fftSize = 256
        systemAnalyserRef.current = systemAnalyser

        const systemAudioSource = audioContext.createMediaStreamSource(systemAudioStream)
        systemAudioSourceRef.current = systemAudioSource

        systemAudioSource.connect(systemAnalyser)
        systemAnalyser.connect(systemAudioWorkletNode)
        console.log('[RealTimeAnalysis] System audio source reconnected successfully')
      } catch (error) {
        console.error('[RealTimeAnalysis] Error reconnecting system audio:', error)
      }
    } else {
      console.warn(
        '[RealTimeAnalysis] Cannot reconnect system audio - audio context or worklet not available'
      )
    }
  }, [systemAudioStream, isScreenSharing])

  return null
}
