'use client'

import { useEffect, useRef } from 'react'
import { GeminiClient } from '@/lib/geminiClient.js'
import { useAuth } from '@/context/AuthContext'

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
      sourceType: 'microphone' | 'system',
      canHighlightKeywords: boolean
    ) => {
      textBufferRef.current += text

      while (true) {
        const buffer = textBufferRef.current
        const transIndex = buffer.indexOf('TRANSCRIPTION:')
        const keyIndex = buffer.indexOf('KEYWORDS:')

        // If a full block is not available, break and wait for more data.
        if (transIndex === -1 || keyIndex === -1 || keyIndex < transIndex) {
          break
        }

        // Find the start of the next block to isolate the current one.
        const nextTransIndex = buffer.indexOf('TRANSCRIPTION:', transIndex + 1)
        let currentBlock
        let remainingBuffer

        if (nextTransIndex !== -1) {
          currentBlock = buffer.substring(transIndex, nextTransIndex)
          remainingBuffer = buffer.substring(nextTransIndex)
        } else {
          currentBlock = buffer.substring(transIndex)
          remainingBuffer = ''
        }

        const transcriptionMatch = currentBlock.match(/TRANSCRIPTION:\s*([\s\S]*?)KEYWORDS:/s)
        const keywordsMatch = currentBlock.match(/KEYWORDS:\s*([\s\S]*)/s)

        // Only process if the block is well-formed with both parts.
        if (transcriptionMatch && keywordsMatch) {
          const transcription = transcriptionMatch[1].replace(/search web/g, '').trim()

          if (transcription && onTextResponse) {
            const keywordsStr = keywordsMatch[1].trim()
            let keywords: string[] = []
            if (keywordsStr) {
              keywords = keywordsStr
                .split(',')
                .map((k) => k.trim())
                .filter((k) => k)
            }

            let highlightedTranscription = transcription
            if (canHighlightKeywords && keywords.length > 0) {
              const regex = new RegExp(`(${keywords.join('|')})`, 'gi')
              highlightedTranscription = transcription.replace(regex, '`$1`')
            }
            onTextResponse(highlightedTranscription, false, sourceType)
          }

          textBufferRef.current = remainingBuffer
        } else {
          // The block is incomplete, so we put it back and wait for more data.
          break
        }
      }
    }

    const startAudioProcessing = async () => {
      console.log('[RealTimeAnalysis] Starting dual audio processing with language:', language)

      micGeminiClient = new GeminiClient(
        (text) =>
          processTranscriptionResponse(text, micTextBufferRef, 'microphone', canUseKeywordSearch),
        () => {
          console.log('[RealTimeAnalysis] Microphone WebSocket setup complete')
          shouldSendAudio = true
        },
        () => {},
        () => {},
        () => {},
        'transcription',
        customPrompt,
        language
      )

      systemGeminiClient = new GeminiClient(
        (text) =>
          processTranscriptionResponse(text, systemTextBufferRef, 'system', canUseKeywordSearch),
        () => {
          console.log('[RealTimeAnalysis] System audio WebSocket setup complete')
        },
        () => {},
        () => {},
        () => {},
        'transcription',
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

        const micAnalyser = audioContext.createAnalyser()
        micAnalyser.fftSize = 256

        mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true })
        micAudioSource = audioContext.createMediaStreamSource(mediaStream)
        micAudioSource.connect(micAnalyser)
        micAnalyser.connect(micAudioWorkletNode)

        let systemAnalyser: AnalyserNode | null = null
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
