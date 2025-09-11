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
  const [keywords, setKeywords] = useState<string[]>([])
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true)
  const { t, language = 'en-US' } = useI18n()
  const currentLanguage = language as 'en-US' | 'zh-TW' | 'ja-JP'

  const { isScreenSharing, toggleScreenShare, screenStreamRef, cancelScreenShare } =
    useScreenShare()

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    }
  }, [aiMessages])

  const handleTranscriptionResponse = useCallback((text: string) => {
    if (window.electronAPI && text) {
      window.electronAPI.send('transcription:data', text)
    }
  }, [])

  useEffect(() => {
    if (window.electronAPI) {
      const unsubscribe = window.electronAPI.on(
        'transcription:data',
        (newTranscription: TranscriptionMessage) => {
          if (!newTranscription || !newTranscription.content) return
          // The object from IPC has a string timestamp, which needs to be converted to a number.
          const formattedTranscription = {
            ...newTranscription,
            timestamp: new Date(newTranscription.timestamp as any).getTime()
          }
          setTranscriptions((prev) => [...prev, formattedTranscription])
        }
      )
      return () => unsubscribe()
    }
  }, [])

  useEffect(() => {
    const loadInitialTranscripts = async () => {
      if (window.electronAPI) {
        try {
          const sessionId = await window.electronAPI.invoke('session:get-id')
          if (sessionId) {
            // Performance: Only load the first page of transcripts initially.
            const loadedTranscripts = await window.electronAPI.invoke('db:get-transcripts', {
              sessionId,
              page: 1,
              limit: 50
            })

            if (loadedTranscripts && loadedTranscripts.length > 0) {
              const formattedTranscripts = loadedTranscripts.map((t: any) => ({
                id: t.id,
                content: t.content,
                role: 'assistant',
                type: 'transcription',
                timestamp: new Date(t.timestamp).getTime()
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

  const handleTranscriptionKeywords = useCallback((newKeywords: string[]) => {
    setKeywords((prev) => {
      const uniqueNewKeywords = newKeywords.filter((k) => k && !prev.includes(k))
      if (uniqueNewKeywords.length > 0) {
        return [...prev, ...uniqueNewKeywords]
      }
      return prev
    })
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
            const sessionId = await window.electronAPI.invoke('session:get-id')
            if (!sessionId) throw new Error('No active session found.')

            const existingSummary = await window.electronAPI.invoke('db:get-summary', sessionId)
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
                  role: 'assistant',
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
            functionPayload.previous_summary = existingSummary?.content
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
            functionPayload.text_input = query
            break
          }
          case 'screenshot': {
            functionName = 'ai-action-screenshot-analysis'
            functionPayload.text_input = query
            functionPayload.image_input = screenshot
            break
          }
          case 'chat': {
            functionName = 'ai-action-chat'
            const sessionId = await window.electronAPI.invoke('session:get-id')
            if (!sessionId) throw new Error('No active session found.')
            const existingSummary = await window.electronAPI.invoke('db:get-summary', sessionId)
            const context = await gatherContext()

            functionPayload.text_input = query
            functionPayload.previous_summary = existingSummary?.content
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

        const responseMapping = {
          summary: (d: any) => d.summary,
          answer: (d: any) => d.recommendation,
          keyword_search: (d: any) => `Keywords found: ${d.keywords.join(', ')}`,
          screenshot: (d: any) => d.analysis,
          chat: (d: any) => d.response
        }

        const content =
          responseMapping[action as keyof typeof responseMapping]?.(data) || JSON.stringify(data)

        if (action === 'summary') {
          const sessionId = await window.electronAPI.invoke('session:get-id')
          if (sessionId && content) {
            await window.electronAPI.invoke('db:save-summary', { sessionId, content })
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

  const handleKeywordClick = useCallback(
    async (keyword: string) => {
      if (isLoading) return
      setSelectedKeyword(keyword)
      await sendContextToAI('keyword_search', keyword)
      setSelectedKeyword(null)
    },
    [isLoading, sendContextToAI]
  )

  const resetChat = useCallback(() => {
    setAiMessages([])
    setKeywords([])
    setCustomPrompt('')
    setIsLoading(false)
    setSelectedKeyword(null)
  }, [])

  const setSubtitleVisibility = (visible: boolean) => {
    setIsSubtitleVisible(visible)
  }

  const handleScreenshot = useCallback(
    async (screenshotPath: string) => {
      let relativePath = screenshotPath.startsWith('/screenshots/')
        ? screenshotPath
        : `/screenshots/${screenshotPath.split('/screenshots/').pop()}`
      try {
        const response = await fetch(relativePath)
        if (!response.ok) throw new Error(`Failed to fetch screenshot: ${response.statusText}`)
        const blob = await response.blob()
        const reader = new FileReader()
        reader.readAsDataURL(blob)
        reader.onloadend = () => {
          const base64Image = reader.result as string
          let question =
            'Please analyze the content of this screenshot and provide a detailed description.'
          if (currentLanguage === 'zh-TW') {
            question = '請分析這張截圖的內容，並提供詳細的描述。'
          } else if (currentLanguage === 'ja-JP') {
            question = 'このスクリーンショットの内容を分析し、詳細な説明を提供してください。'
          }
          sendContextToAI('screenshot', question, base64Image)
        }
        reader.onerror = () => {
          throw new Error('Failed to read screenshot file')
        }
      } catch (error) {
        console.error('[AIInteraction] Error processing screenshot:', error)
        setAiMessages((prev) => [
          ...prev,
          {
            id: `err-screenshot-${Date.now()}`,
            role: 'assistant',
            content: `[錯誤] 無法處理截圖: ${error instanceof Error ? error.message : String(error)}`
          }
        ])
      }
    },
    [sendContextToAI, currentLanguage]
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
    keywords,
    selectedKeyword,
    sendContextToAI,
    handleTranscriptionResponse,
    handleTranscriptionKeywords,
    handleKeywordClick,
    messagesContainerRef,
    resetChat,
    isSubtitleVisible,
    setSubtitleVisibility,
    handleSendMessage,
    handleScreenshot,
    isScreenSharing,
    toggleScreenShare,
    screenStreamRef,
    cancelScreenShare,
    isSummarizing
  }
}
