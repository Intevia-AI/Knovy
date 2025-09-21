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

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        const micSource = audioContext.createMediaStreamSource(mediaStream)
        micSource.connect(audioWorkletNode)

        if (systemAudioStream && audioContext) {
          if (systemAudioSource) {
            systemAudioSource.disconnect()
          }
          const source = audioContext.createMediaStreamSource(systemAudioStream)
          source.connect(audioWorkletNode)
          systemAudioSource = source
          console.log('[RealTimeAnalysis] System audio source connected')
        }
      } catch (error) {
        console.error('[RealTimeAnalysis] Error starting audio processing:', error)
      }
    }

    startAudioProcessing()

    return () => {
      console.log('[RealTimeAnalysis] Stopping audio processing...')
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
