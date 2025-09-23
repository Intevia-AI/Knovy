'use client'

import { useEffect, useRef } from 'react'
import { GeminiClient } from '@/lib/geminiClient.js'

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
  const micTextBufferRef = useRef('')
  const systemTextBufferRef = useRef('')
  const animationFrameId = useRef<number | null>(null)

  useEffect(() => {
    if (!isScreenSharing) {
      return
    }

    let micGeminiClient: GeminiClient | null = null
    let systemGeminiClient: GeminiClient | null = null
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
      sourceType: 'microphone' | 'system'
    ) => {
      textBufferRef.current += text

      if (
        textBufferRef.current.includes('TRANSCRIPTION:') &&
        textBufferRef.current.includes('KEYWORDS:')
      ) {
        const transcriptionMatch = textBufferRef.current.match(
          /TRANSCRIPTION: (.*?)(?:\n|$|KEYWORDS:)/s
        )
        const keywordsMatch = textBufferRef.current.match(/KEYWORDS: (.*?)(?:\n|$)/s)

        let transcription = ''
        if (transcriptionMatch && transcriptionMatch[1]) {
          transcription = transcriptionMatch[1]
            .replace(/TRANSCRIPTION:\s*/gi, '')
            .replace(/search web/g, '')
            .replace(/\s+/g, ' ')
            .trim()
        }

        let keywords: string[] = []
        if (keywordsMatch && keywordsMatch[1]) {
          const keywordsStr = keywordsMatch[1].trim()
          if (keywordsStr) {
            keywords = keywordsStr
              .split(',')
              .map((k) => k.trim())
              .filter((k) => k)
          }
        }

        if (transcription && onTextResponse) {
          let highlightedTranscription = transcription
          if (keywords.length > 0) {
            const regex = new RegExp(`(${keywords.join('|')})`, 'gi')
            highlightedTranscription = transcription.replace(regex, '`$1`')
          }
          onTextResponse(highlightedTranscription, false, sourceType)
        }

        textBufferRef.current = ''
      }
    }

    const startAudioProcessing = async () => {
      console.log('[RealTimeAnalysis] Starting dual audio processing with language:', language)

      // Create separate Gemini clients for microphone and system audio
      micGeminiClient = new GeminiClient(
        (text) => processTranscriptionResponse(text, micTextBufferRef, 'microphone'),
        () => {
          console.log('[RealTimeAnalysis] Microphone WebSocket setup complete')
          shouldSendAudio = true
        },
        () => {}, // onPlayingStateChange
        () => {}, // onAudioLevelChange
        () => {}, // onTranscription
        'transcription', // mode
        customPrompt,
        language
      )

      systemGeminiClient = new GeminiClient(
        (text) => processTranscriptionResponse(text, systemTextBufferRef, 'system'),
        () => {
          console.log('[RealTimeAnalysis] System audio WebSocket setup complete')
        },
        () => {}, // onPlayingStateChange
        () => {}, // onAudioLevelChange
        () => {}, // onTranscription
        'transcription', // mode
        customPrompt,
        language
      )

      await Promise.all([micGeminiClient.connect(), systemGeminiClient.connect()])

      try {
        audioContext = new AudioContext({ sampleRate: 16000 })
        await Promise.all([
          audioContext.audioWorklet.addModule('worklets/mic-audio-processor.js'),
          audioContext.audioWorklet.addModule('worklets/system-audio-processor.js')
        ])

        // Create separate worklet nodes for mic and system audio
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

        // Handle microphone audio
        micAudioWorkletNode.port.onmessage = (event) => {
          const { pcmData, sourceType } = event.data
          if (micGeminiClient && shouldSendAudio && sourceType === 'microphone') {
            try {
              const pcmArray = new Uint8Array(pcmData)
              const b64Data = btoa(String.fromCharCode.apply(null, Array.from(pcmArray)))
              micGeminiClient.sendMediaChunk(b64Data, 'audio/pcm')
            } catch (error) {
              console.error('[RealTimeAnalysis] Error sending microphone audio chunk:', error)
            }
          }
        }

        // Handle system audio
        systemAudioWorkletNode.port.onmessage = (event) => {
          const { pcmData, sourceType } = event.data
          if (systemGeminiClient && shouldSendAudio && sourceType === 'system') {
            try {
              const pcmArray = new Uint8Array(pcmData)
              const b64Data = btoa(String.fromCharCode.apply(null, Array.from(pcmArray)))
              systemGeminiClient.sendMediaChunk(b64Data, 'audio/pcm')
            } catch (error) {
              console.error('[RealTimeAnalysis] Error sending system audio chunk:', error)
            }
          }
        }

        // --- Audio Analysis Setup ---
        const micAnalyser = audioContext.createAnalyser()
        micAnalyser.fftSize = 256

        // Setup microphone audio source
        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micAudioSource = audioContext.createMediaStreamSource(mediaStream)
        micAudioSource.connect(micAnalyser)
        micAnalyser.connect(micAudioWorkletNode)

        let systemAnalyser: AnalyserNode | null = null
        // Setup system audio source (if available)
        if (systemAudioStream && audioContext) {
          if (systemAudioSource) {
            systemAudioSource.disconnect()
          }
          systemAnalyser = audioContext.createAnalyser()
          systemAnalyser.fftSize = 256
          systemAudioSource = audioContext.createMediaStreamSource(systemAudioStream)
          systemAudioSource.connect(systemAnalyser)
          systemAnalyser.connect(systemAudioWorkletNode)
          console.log('[RealTimeAnalysis] System audio source connected')
        }

        const draw = () => {
          const micDataArray = new Uint8Array(micAnalyser.frequencyBinCount)
          micAnalyser.getByteFrequencyData(micDataArray)
          const micLevel = micDataArray.reduce((sum, value) => sum + value, 0) / micDataArray.length

          let systemLevel = 0
          if (systemAnalyser) {
            const systemDataArray = new Uint8Array(systemAnalyser.frequencyBinCount)
            systemAnalyser.getByteFrequencyData(systemDataArray)
            systemLevel =
              systemDataArray.reduce((sum, value) => sum + value, 0) / systemDataArray.length
          }

          // Normalize to 0-100 for simple bar width percentage
          const normalizedMicLevel = (micLevel / 140) * 100 // Using 140 as a practical max
          const normalizedSystemLevel = (systemLevel / 140) * 100

          ;(window as any).electronAPI.send('audio:level-update', {
            micLevel: Math.min(normalizedMicLevel, 100),
            systemLevel: Math.min(normalizedSystemLevel, 100)
          })

          animationFrameId.current = requestAnimationFrame(draw)
        }
        draw()
        // --- End Audio Analysis Setup ---
      } catch (error) {
        console.error('[RealTimeAnalysis] Error starting audio processing:', error)
      }
    }

    startAudioProcessing()

    return () => {
      console.log('[RealTimeAnalysis] Stopping dual audio processing...')
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
      shouldSendAudio = false

      micGeminiClient?.disconnect()
      micGeminiClient = null

      systemGeminiClient?.disconnect()
      systemGeminiClient = null

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
    }
  }, [isScreenSharing, language, customPrompt, systemAudioStream, onTextResponse])

  return null
}
