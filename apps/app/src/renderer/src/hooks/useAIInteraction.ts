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
          setTranscriptions((prev) => [...prev, newTranscription])
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
            const loadedTranscripts = await window.electronAPI.invoke(
              'db:get-transcripts',
              sessionId
            )
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
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      const contextTranscriptions = (
        action === 'answer' || action === 'summary' ? transcriptions : transcriptions.slice(-5)
      ).filter((t) => t.timestamp >= fiveMinutesAgo)
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
      setIsLoading(true)

      const displayMsgContent = query || baseDisplayPromptMap[action][currentLanguage]
      const displayMsg: AIMessage = {
        id: `disp-${Date.now()}`,
        role: 'user',
        content: displayMsgContent
      }
      setAiMessages((prev) => [...prev, displayMsg])

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
            const context = await gatherContext(action)
            if (!context?.text?.trim()) {
              throw new Error('There is no transcription history to summarize.')
            }
            functionName = 'ai-action-summarize'
            functionPayload.text_input = context.text
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
          case 'chat':
            throw new Error("'chat' action is not yet implemented.")
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
          screenshot: (d: any) => d.analysis
        }

        const content =
          responseMapping[action as keyof typeof responseMapping]?.(data) || JSON.stringify(data)

        const aiResponse: AIMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content
        }
        setAiMessages((prev) => [...prev, aiResponse])
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
        setIsLoading(false)
      }
    },
    [gatherContext, t, language]
  )

  const SUMMARY_TIME_WINDOW_SECONDS = 60

  useEffect(() => {
    const interval = setInterval(() => {
      if (isScreenSharing && aiMessages.some((m) => m.id.startsWith('ai-summary'))) {
        console.log('[AIInteraction] Periodically updating summary...')
        sendContextToAI('summary')
      }
    }, SUMMARY_TIME_WINDOW_SECONDS * 1000)

    return () => clearInterval(interval)
  }, [isScreenSharing, aiMessages, sendContextToAI])

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
    cancelScreenShare
  }
}
