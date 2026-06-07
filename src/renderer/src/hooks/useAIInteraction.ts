/**
 * @fileoverview AI Interaction Hook
 * @module useAIInteraction
 * @description React hook for managing AI interactions, transcriptions, and responses
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Message as AIMessage } from 'ai'
import { useI18n } from '@/hooks/useI18n'
import { useScreenShare } from './useScreenShare'

export type AIAction =
  | 'chat'
  | 'recommend_response'
  | 'deep_response'
  | 'summary'
  | 'keyword_search'
  | 'screenshot'
  | 'file'

interface TranscriptionMessage extends AIMessage {
  timestamp: number
  type: 'transcription'
  sourceType?: 'microphone' | 'system'
  isStreaming?: boolean
}

interface AIContextData {
  text?: string
  timestamp?: number
}

export function useAIInteraction() {
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([])
  const [transcriptions, setTranscriptions] = useState<TranscriptionMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSummarizing, setIsSummarizing] = useState(false)
  const [customPrompt, setCustomPrompt] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true)
  const { t, language = 'en-US' } = useI18n()
  const currentLanguage = language as 'en-US' | 'zh-TW'

  const { isScreenSharing, toggleScreenShare, screenStreamRef, cancelScreenShare } =
    useScreenShare()

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [aiMessages])

  const handleTranscriptionResponse = useCallback(
    (
      text: string,
      turnComplete: boolean = false,
      sourceType: 'microphone' | 'system' = 'system'
    ): void => {
      console.log(`[useAIInteraction] handleTranscriptionResponse called:`, {
        textLength: text?.length || 0,
        text: text ? `"${text}"` : null,
        sourceType,
        turnComplete,
        hasElectronAPI: !!(window as any).electronAPI
      })

      if ((window as any).electronAPI && text) {
        ;(window as any).electronAPI.send('transcription:data', { text, sourceType })
        console.log(`[useAIInteraction] Sent transcription data to main process via IPC`)
      } else {
        console.warn(
          `[useAIInteraction] Cannot send transcription - electronAPI: ${!!(window as any).electronAPI}, text: ${!!text}`
        )
      }
    },
    []
  )

  useEffect(() => {
    const api = (window as any).electronAPI
    if (!api) return () => {}

    // rAF-batched token buffers, keyed by transcriptId (backpressure safety).
    const buffers = new Map<string, string>()
    let rafId: number | null = null

    const flush = () => {
      rafId = null
      if (buffers.size === 0) return
      setTranscriptions((prev) =>
        prev.map((m) => {
          const pending = buffers.get(m.id)
          return pending ? { ...m, content: m.content + pending } : m
        })
      )
      buffers.clear()
    }
    const scheduleFlush = () => {
      if (rafId == null) rafId = requestAnimationFrame(flush)
    }

    const unsubData = api.on(
      'transcription:data',
      (t: TranscriptionMessage & { isStreaming?: boolean }) => {
        if (!t) return
        // Allow empty content only for the streaming placeholder.
        if (!t.content && !t.isStreaming) return
        const formatted: TranscriptionMessage = {
          ...t,
          content: t.content || '',
          timestamp: new Date(t.timestamp as any).getTime(),
          sourceType: t.sourceType || 'system',
          isStreaming: !!t.isStreaming
        }
        setTranscriptions((prev) => [...prev, formatted])
      }
    )

    const unsubToken = api.on(
      'correction:token',
      ({ transcriptId, chunk }: { transcriptId: string; chunk: string }) => {
        buffers.set(transcriptId, (buffers.get(transcriptId) || '') + chunk)
        scheduleFlush()
      }
    )

    const settle = (transcriptId: string, fullText?: string) => {
      if (rafId != null) {
        cancelAnimationFrame(rafId)
        rafId = null
      }
      buffers.delete(transcriptId)
      setTranscriptions((prev) =>
        prev.map((m) =>
          m.id === transcriptId
            ? { ...m, content: fullText != null ? fullText : m.content, isStreaming: false }
            : m
        )
      )
    }

    const unsubDone = api.on(
      'correction:done',
      ({ transcriptId, fullText }: { transcriptId: string; fullText: string }) =>
        settle(transcriptId, fullText)
    )
    const unsubCancelled = api.on(
      'correction:cancelled',
      ({ transcriptId }: { transcriptId: string }) => settle(transcriptId)
    )
    const unsubError = api.on('correction:error', ({ transcriptId }: { transcriptId: string }) =>
      settle(transcriptId)
    )

    return () => {
      if (rafId != null) cancelAnimationFrame(rafId)
      unsubData()
      unsubToken()
      unsubDone()
      unsubCancelled()
      unsubError()
    }
  }, [])

  useEffect(() => {
    const loadInitialTranscripts = async () => {
      if ((window as any).electronAPI) {
        try {
          const sessionId = await (window as any).electronAPI.invoke('session:get-id')
          if (sessionId) {
            const loadedTranscripts = await (window as any).electronAPI.invoke(
              'db:get-all-transcripts',
              sessionId
            )

            if (loadedTranscripts && loadedTranscripts.length > 0) {
              const formattedTranscripts = loadedTranscripts.map((t: any) => ({
                id: t.id,
                // Use enhanced_text if available, otherwise fall back to raw content
                content: t.enhanced_text || t.content,
                role: 'assistant',
                type: 'transcription',
                timestamp: new Date(t.timestamp).getTime(),
                sourceType: t.source_type || 'system'
              }))
              setTranscriptions(formattedTranscripts)
            }
          }
        } catch (error) {
          console.error('Failed to load initial transcripts:', error)
        }
      }
    }

    loadInitialTranscripts()
  }, [])

  const gatherContext = useCallback(
    async (action?: AIAction): Promise<AIContextData | null> => {
      if (transcriptions.length === 0) {
        return { text: '', timestamp: Date.now() }
      }

      let contextTranscriptions: TranscriptionMessage[]

      if (action === 'recommend_response' || action === 'deep_response') {
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
        contextTranscriptions = transcriptions.filter((t) => t.timestamp > fiveMinutesAgo)
      } else {
        // Default behavior for other actions, e.g., keyword_search from a popover
        contextTranscriptions = transcriptions.slice(-10)
      }

      const contextText = contextTranscriptions.map((t) => t.content).join('\n')
      return { text: contextText, timestamp: Date.now() }
    },
    [transcriptions]
  )

  const sendContextToAI = useCallback(
    async (action: AIAction, query?: string, screenshot?: string) => {
      console.log(`[AIInteraction] Starting action: ${action}`, {
        query,
        hasScreenshot: !!screenshot
      })
      if (action === 'summary') {
        setIsSummarizing(true)
      } else {
        setIsLoading(true)
      }

      // Avoid adding a display message for periodic summary updates
      // Also, if a screenshot is present, the calling component is responsible for creating the display message.
      if (action !== 'summary' && !screenshot) {
        // Map action to translation key for display message
        const getDisplayMessage = (action: AIAction): string => {
          const actionToTranslationKey = {
            chat: 'aiActionChatDisplay',
            recommend_response: 'aiActionAnswerDisplay',
            deep_response: 'aiActionDeepResponseDisplay',
            summary: 'aiActionSummaryDisplay',
            keyword_search: 'aiActionKeywordSearchDisplay',
            screenshot: 'aiActionScreenshotDisplay',
            file: 'aiActionUpload' // Fallback to existing translation
          } as const

          return t(actionToTranslationKey[action] as any)
        }

        const displayMsgContent = query || getDisplayMessage(action)
        const displayMsg: AIMessage = {
          id: `disp-${Date.now()}`,
          role: 'user',
          content: displayMsgContent
        }
        setAiMessages((prev) => [...prev, displayMsg])
      }

      try {
        // Map actions to IPC channels
        const actionToChannel: Record<string, string> = {
          chat: 'ai:chat',
          summary: 'ai:summarize',
          recommend_response: 'ai:recommend-response',
          deep_response: 'ai:deep-response',
          keyword_search: 'ai:keyword-search',
          screenshot: 'ai:screenshot-analysis'
        }

        const ipcChannel = actionToChannel[action]
        if (!ipcChannel) {
          throw new Error(`AI Action '${action}' is not supported.`)
        }

        const payload: Record<string, any> = {
          language: currentLanguage
        }

        switch (action) {
          case 'summary': {
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            if (!sessionId) throw new Error('No active session found.')

            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const lastSummaryTime = existingSummary
              ? new Date(existingSummary.updated_at).getTime()
              : 0

            const newTranscripts = transcriptions.filter((t) => t.timestamp > lastSummaryTime)

            if (newTranscripts.length === 0 && existingSummary) {
              console.log('[AIInteraction] No new transcripts. Displaying existing summary.')
              setAiMessages((prev) => {
                const summaryMessage = {
                  id: 'ai-summary',
                  role: 'assistant' as const,
                  content: existingSummary.content
                }
                if (prev.some((m) => m.id === 'ai-summary')) {
                  return prev.map((m) => (m.id === 'ai-summary' ? summaryMessage : m))
                }
                return [...prev, summaryMessage]
              })
              setIsSummarizing(false)
              return
            }

            if (newTranscripts.length === 0 && !existingSummary) {
              console.log('[AIInteraction] No content available to create a summary.')
              setIsSummarizing(false)
              return
            }

            payload.text_input = newTranscripts.map((t) => t.content).join('\n')
            payload.existing_summary = existingSummary?.content
            break
          }
          case 'recommend_response': {
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            if (!sessionId) throw new Error('No active session found.')

            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const context = await gatherContext(action)

            if (query) {
              payload.text_input = query
            } else {
              if (!context?.text?.trim()) {
                throw new Error('There is no transcription history to recommend a response.')
              }
              payload.text_input = context.text
            }

            payload.existing_summary = existingSummary?.content
            payload.recent_transcriptions = context?.text
            break
          }
          case 'deep_response': {
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            if (!sessionId) throw new Error('No active session found.')

            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const context = await gatherContext()

            if (query) {
              payload.text_input = query
            } else {
              if (!context?.text?.trim()) {
                throw new Error('There is no transcription history to generate a deep response.')
              }
              payload.text_input = context.text
            }

            payload.existing_summary = existingSummary?.content
            payload.recent_transcriptions = context?.text
            break
          }
          case 'keyword_search': {
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const context = await gatherContext()

            payload.text_input = query
            payload.existing_summary = existingSummary?.content
            payload.recent_transcriptions = context?.text
            break
          }
          case 'screenshot': {
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const context = await gatherContext()

            payload.text_input =
              query || 'Please analyze this screenshot and describe what you see.'
            payload.image_input = screenshot
            payload.existing_summary = existingSummary?.content
            payload.recent_transcriptions = context?.text
            break
          }
          case 'chat': {
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            if (!sessionId) throw new Error('No active session found.')
            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const context = await gatherContext()

            payload.text_input = query
            payload.existing_summary = existingSummary?.content
            payload.recent_transcriptions = context?.text
            break
          }
        }

        console.log(`[AIInteraction] Invoking IPC: ${ipcChannel}`, { payload })
        const data = await (window as any).electronAPI.invoke(ipcChannel, payload)
        console.log('[AIInteraction] IPC returned:', data)

        const responseMapping = {
          summary: (d: any) => d.summary,
          recommend_response: (d: any) => d.recommendation,
          deep_response: (d: any) => d.recommendation,
          keyword_search: (d: any) => d.response,
          screenshot: (d: any) => d.analysis,
          chat: (d: any) => d.response
        }

        const content =
          responseMapping[action as keyof typeof responseMapping]?.(data) || JSON.stringify(data)

        if (action === 'summary') {
          const sessionId = await (window as any).electronAPI.invoke('session:get-id')
          if (sessionId && content) {
            await (window as any).electronAPI.invoke('db:save-summary', {
              sessionId,
              content,
              short_summary: data.short_summary,
              context: data.context
            })
          }
          setAiMessages((prev) => {
            const existingSummary = prev.find((m) => m.id === 'ai-summary')
            if (existingSummary) {
              return prev.map((m) => (m.id === 'ai-summary' ? { ...m, content } : m))
            }
            return [...prev, { id: 'ai-summary', role: 'assistant', content }]
          })
        } else {
          const aiResponse: AIMessage = {
            id: `ai-${Date.now()}`,
            role: 'assistant',
            content
          }
          setAiMessages((prev) => [...prev, aiResponse])
        }
      } catch (e: unknown) {
        console.error('[AIInteraction] Error in sendContextToAI:', e)
        setAiMessages((prev) => [
          ...prev,
          {
            id: `err-ai-${Date.now()}`,
            role: 'assistant',
            content: `[AI 錯誤] 無法處理您的請求: ${e instanceof Error ? e.message : String(e)}`
          }
        ])
      } finally {
        if (action === 'summary') {
          setIsSummarizing(false)
        } else {
          setIsLoading(false)
        }
      }
    },
    [gatherContext, t, language, transcriptions]
  )

  const handleSendMessage = (action: 'chat', prompt: string) => {
    sendContextToAI(action, prompt)
  }

  const cancelCorrections = useCallback(() => {
    ;(window as any).electronAPI?.send('correction:cancel')
  }, [])

  return {
    aiMessages,
    setAiMessages,
    transcriptions,
    isLoading,
    customPrompt,
    setCustomPrompt,
    sendContextToAI,
    handleTranscriptionResponse,
    messagesContainerRef,
    isSubtitleVisible,
    handleSendMessage,
    isScreenSharing,
    toggleScreenShare,
    screenStreamRef,
    cancelScreenShare,
    isSummarizing,
    cancelCorrections
  }
}
