'use client'

import { useEffect, useRef } from 'react'
import { GeminiClient } from '@/lib/geminiClient.js'

interface RealTimeAnalysisProps {
  onTextResponse?: (text: string, turnComplete: boolean) => void // 當收到文字回應時的回呼
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
  const textBufferRef = useRef('')
  const animationFrameId = useRef<number | null>(null)

  useEffect(() => {
    if (!isScreenSharing) {
      return
    }

    let geminiClient: GeminiClient | null = null
    let audioContext: AudioContext | null = null
    let audioWorkletNode: AudioWorkletNode | null = null
    let mediaStream: MediaStream | null = null
    let systemAudioSource: MediaStreamAudioSourceNode | null = null
    let shouldSendAudio = false

    const startAudioProcessing = async () => {
      console.log('[RealTimeAnalysis] Starting audio processing with language:', language)

      geminiClient = new GeminiClient(
        (text) => {
          // onMessage
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
              onTextResponse(highlightedTranscription, false)
            }

            textBufferRef.current = ''
          }
        },
        () => {
          // onSetupComplete
          console.log('[RealTimeAnalysis] WebSocket setup complete')
          shouldSendAudio = true
        },
        () => {}, // onPlayingStateChange
        () => {}, // onAudioLevelChange
        () => {}, // onTranscription
        'transcription', // mode
        customPrompt,
        language
      )

      await geminiClient.connect()

      try {
        audioContext = new AudioContext({ sampleRate: 16000 })
        await audioContext.audioWorklet.addModule('worklets/audio-processor.js')

        audioWorkletNode = new AudioWorkletNode(audioContext, 'audio-processor', {
          processorOptions: {
            bufferSize: 8192
          }
        })

        audioWorkletNode.port.onmessage = (event) => {
          const { pcmData } = event.data
          if (geminiClient && shouldSendAudio) {
            try {
              const pcmArray = new Uint8Array(pcmData)
              const b64Data = btoa(String.fromCharCode.apply(null, Array.from(pcmArray)))
              geminiClient.sendMediaChunk(b64Data, 'audio/pcm')
            } catch (error) {
              console.error('[RealTimeAnalysis] Error sending audio chunk:', error)
            }
          }
        }

        // --- Audio Analysis Setup ---
        const micAnalyser = audioContext.createAnalyser()
        micAnalyser.fftSize = 256

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const micSource = audioContext.createMediaStreamSource(mediaStream)
        micSource.connect(micAnalyser)
        micAnalyser.connect(audioWorkletNode) // Connect analyser to worklet

        let systemAnalyser: AnalyserNode | null = null
        if (systemAudioStream && audioContext) {
          if (systemAudioSource) {
            systemAudioSource.disconnect()
          }
          systemAnalyser = audioContext.createAnalyser()
          systemAnalyser.fftSize = 256
          const source = audioContext.createMediaStreamSource(systemAudioStream)
          source.connect(systemAnalyser)
          systemAnalyser.connect(audioWorkletNode) // Connect analyser to worklet
          systemAudioSource = source
          console.log('[RealTimeAnalysis] System audio source connected')
        }

        const draw = () => {
          const micDataArray = new Uint8Array(micAnalyser.frequencyBinCount)
          micAnalyser.getByteFrequencyData(micDataArray)
          const micLevel =
            micDataArray.reduce((sum, value) => sum + value, 0) / micDataArray.length

          let systemLevel = 0
          if (systemAnalyser) {
            const systemDataArray = new Uint8Array(systemAnalyser.frequencyBinCount)
            systemAnalyser.getByteFrequencyData(systemDataArray)
            systemLevel =
              systemDataArray.reduce((sum, value) => sum + value, 0) /
              systemDataArray.length
          }

          // Normalize to 0-100 for simple bar width percentage
          const normalizedMicLevel = (micLevel / 140) * 100 // Using 140 as a practical max
          const normalizedSystemLevel = (systemLevel / 140) * 100

          window.electronAPI.send('audio:level-update', {
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
      console.log('[RealTimeAnalysis] Stopping audio processing...')
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current)
      }
      shouldSendAudio = false

      geminiClient?.disconnect()
      geminiClient = null

      mediaStream?.getTracks().forEach((track) => track.stop())
      mediaStream = null

      systemAudioSource?.disconnect()
      systemAudioSource = null

      audioWorkletNode?.disconnect()
      audioWorkletNode = null

      audioContext?.close().catch(console.error)
      audioContext = null
    }
  }, [isScreenSharing, language, customPrompt, systemAudioStream, onTextResponse])

  return null
}
