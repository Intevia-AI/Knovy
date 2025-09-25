/**
 * @fileoverview AI Interaction Hook
 * @module useAIInteraction
 * @description React hook for managing AI interactions, transcriptions, and responses
 */

import { useState, useCallback, useRef, useEffect } from 'react'
import { Message as AIMessage } from 'ai'
import { useI18n } from '@/hooks/useI18n'
import { useScreenShare } from './useScreenShare'
import { supabase } from '@/lib/supabaseClient'
import { baseDisplayPromptMap } from '@/lib/prompts'

export type AIAction = 'chat' | 'answer' | 'summary' | 'keyword_search' | 'screenshot'

interface TranscriptionMessage extends AIMessage {
  timestamp: number
  type: 'transcription'
  sourceType?: 'microphone' | 'system'
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
      if ((window as any).electronAPI && text) {
        ;(window as any).electronAPI.send('transcription:data', { text, sourceType })
      }
    },
    []
  )

  useEffect(() => {
    if ((window as any).electronAPI) {
      const unsubscribe = (window as any).electronAPI.on(
        'transcription:data',
        (newTranscription: TranscriptionMessage) => {
          if (!newTranscription || !newTranscription.content) return
          // The object from IPC has a string timestamp, which needs to be converted to a number.
          const formattedTranscription = {
            ...newTranscription,
            timestamp: new Date(newTranscription.timestamp as any).getTime(),
            sourceType: newTranscription.sourceType || 'system'
          }
          setTranscriptions((prev) => [...prev, formattedTranscription])
        }
      )
      return () => unsubscribe()
    }
    return () => {} // Return empty cleanup function when electronAPI is not available
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
                content: t.content,
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

      if (action === 'answer') {
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
      if (action !== 'summary') {
        const displayMsgContent = query || baseDisplayPromptMap[action][currentLanguage]
        const displayMsg: AIMessage = {
          id: `disp-${Date.now()}`,
          role: 'user',
          content: displayMsgContent
        }
        setAiMessages((prev) => [...prev, displayMsg])
      }

      try {
        const {
          data: { session }
        } = await supabase.auth.getSession()
        if (!session) throw new Error('User is not authenticated.')

        let functionName: string
        const functionPayload: Record<string, any> = {
          text_input: null,
          message_history: null,
          image_input: null,
          language: currentLanguage
        }

        switch (action) {
          case 'summary': {
            functionName = 'ai-action-summarize'
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

            // Condition 1: No new content and a summary already exists.
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
              setIsLoading(false)
              return // Stop execution
            }

            // Condition 2: No transcripts at all to summarize.
            if (newTranscripts.length === 0 && !existingSummary) {
              console.log('[AIInteraction] No content available to create a summary.')
              // Optionally, set a message indicating not enough content
              setIsLoading(false)
              return // Stop execution
            }

            functionPayload.text_input = newTranscripts.map((t) => t.content).join('\n')
            functionPayload.existing_summary = existingSummary?.content
            break
          }
          case 'answer': {
            functionName = 'ai-action-recommend-response'
            const context = await gatherContext(action)
            if (!context?.text?.trim()) {
              throw new Error('There is no transcription history to recommend a response.')
            }
            functionPayload.text_input = context.text
            break
          }
          case 'keyword_search': {
            functionName = 'ai-action-keyword-search'
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const context = await gatherContext()

            functionPayload.text_input = query
            functionPayload.existing_summary = existingSummary?.content
            functionPayload.recent_transcriptions = context?.text
            break
          }
          case 'screenshot': {
            functionName = 'ai-action-screenshot-analysis'
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const context = await gatherContext()

            functionPayload.text_input = query || 'Please analyze this screenshot and describe what you see.'
            functionPayload.image_input = screenshot
            functionPayload.existing_summary = existingSummary?.content
            functionPayload.recent_transcriptions = context?.text
            break
          }
          case 'chat': {
            functionName = 'ai-action-chat'
            const sessionId = await (window as any).electronAPI.invoke('session:get-id')
            if (!sessionId) throw new Error('No active session found.')
            const existingSummary = await (window as any).electronAPI.invoke(
              'db:get-summary',
              sessionId
            )
            const context = await gatherContext()

            functionPayload.text_input = query
            functionPayload.existing_summary = existingSummary?.content
            functionPayload.recent_transcriptions = context?.text
            break
          }
          default:
            throw new Error(`AI Action '${action}' is not supported.`)
        }

        console.log(`[AIInteraction] Invoking function: ${functionName}`, {
          payload: functionPayload
        })
        const { data, error } = await supabase.functions.invoke(functionName, {
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: functionPayload
        })
        console.log('[AIInteraction] Function returned:', { data, error })

        if (error) throw error

        // Log the action with token usage
        const actionToLogName = {
          chat: 'ai_action:chat',
          keyword_search: 'ai_action:keyword-search',
          answer: 'ai_action:recommend-response',
          screenshot: 'ai_action:screenshot-analysis',
          summary: 'ai_action:summarize'
        }
        const loggedActionName = actionToLogName[action]

        if (loggedActionName && data.usage) {
          const { error: logError } = await supabase.functions.invoke('session-manager', {
            body: {
              log_type: 'action',
              action_name: loggedActionName,
              metadata: {
                input_tokens: data.usage.input_tokens,
                output_tokens: data.usage.output_tokens
              }
            }
          })
          if (logError) {
            console.error(`[AIInteraction] Failed to log action '${loggedActionName}':`, logError)
          }
        }

        console.log('[AIInteraction] Raw data for response mapping:', data)
        const responseMapping = {
          summary: (d: any) => d.summary,
          answer: (d: any) => d.recommendation,
          keyword_search: (d: any) => d.response,
          screenshot: (d: any) => d.analysis,
          chat: (d: any) => d.response
        }

        const content =
          responseMapping[action as keyof typeof responseMapping]?.(data) || JSON.stringify(data)

        if (action === 'summary') {
          const sessionId = await (window as any).electronAPI.invoke('session:get-id')
          if (sessionId && content) {
            await (window as any).electronAPI.invoke('db:save-summary', { sessionId, content })
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
    [gatherContext, t, language, transcriptions] // Added transcriptions dependency
  )

  const handleSendMessage = (action: 'chat', prompt: string) => {
    sendContextToAI(action, prompt)
  }

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
    isSummarizing
  }
}
