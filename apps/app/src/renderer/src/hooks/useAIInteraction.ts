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

const API_URL = import.meta.env.VITE_AI_API_URL || 'http://localhost:4567/api/ai'

export type AIAction =
  | 'real-time'
  | 'answer'
  | 'summary'
  | 'search'
  | 'keyword_search'
  | 'custom'
  | 'screen'
  | 'screenshot'
  | 'upload'

interface TranscriptionMessage extends AIMessage {
  timestamp: number
  type: 'transcription'
}

interface AIContextData {
  text?: string
  timestamp?: number
  screenshot?: string
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

          setAiMessages((prev) => {
            const lastMessage = prev[prev.length - 1]
            if (lastMessage?.role === 'assistant' && lastMessage.content.startsWith('[即時轉錄]')) {
              return [
                ...prev.slice(0, -1),
                { ...lastMessage, content: lastMessage.content + newTranscription.content }
              ]
            } else {
              return [
                ...prev,
                {
                  id: `realtime-${Date.now()}`,
                  role: 'assistant',
                  content: `[即時轉錄] ${newTranscription.content}`
                }
              ]
            }
          })
        }
      )
      return () => unsubscribe()
    }
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
        return {
          text: '',
          timestamp: Date.now()
        }
      }
      const fiveMinutesAgo = Date.now() - 5 * 60 * 1000
      const contextTranscriptions = (
        action === 'answer' || action === 'summary' ? transcriptions : transcriptions.slice(-5)
      ).filter((t) => t.timestamp >= fiveMinutesAgo)

      const contextText = contextTranscriptions.map((t) => t.content).join('\n')

      return {
        text: contextText,
        timestamp: Date.now()
      }
    },
    [transcriptions]
  )

  const sendContextToAI = useCallback(
    async (action: AIAction, query?: string, screenshot?: string) => {
      setIsLoading(true)

      let context: AIContextData
      let finalUserMsgContent: string
      let finalDisplayMsgContent: string

      const basePromptMap = {
        'real-time': {
          'en-US':
            'Analyze the latest transcription content and identify key points, keywords, or action items mentioned.',
          'zh-TW': '分析最新的轉錄內容，並識別其中提到的關鍵點、關鍵字或待辦事項。',
          'ja-JP':
            '最新の文字起こし内容を分析し、言及された重要なポイント、キーワード、またはアクションアイテムを特定してください。'
        },
        answer_template: {
          'en-US':
            'Based on the attached transcription of the entire meeting, please provide a detailed answer to the last question asked: ',
          'zh-TW':
            '附上的轉錄內容是一個會議全部的對話，請根據整個會議的對話，詳細回答最後提出的問題: ',
          'ja-JP':
            '添付された会議全体の文字起こしに基づいて、最後に質問された内容について詳細に回答してください: '
        },
        summary_template: {
          'en-US': 'Please provide a concise summary based on the following transcription: ',
          'zh-TW': '根據以下的轉錄內容，提供簡明摘要: ',
          'ja-JP': '以下の文字起こしに基づいて、簡潔な要約を提供してください: '
        },
        search_template: {
          'en-US':
            'Please search the web for the following query, and answer the question directly: ',
          'zh-TW': '請搜尋以下查詢，並直接回答問題: ',
          'ja-JP': '以下のクエリを検索し、質問に直接回答してください: '
        },
        keyword_search_template: {
          'en-US':
            'Please search the web for the following query, and answer the question directly: ',
          'zh-TW': '請搜尋以下查詢，並直接回答問題: ',
          'ja-JP': '以下のクエリを検索し、質問に直接回答してください: '
        },
        custom_template: {
          'en-US': 'Please analyze or answer the following text:\n\n"{{query_text}}"',
          'zh-TW': '請針對以下文字內容進行分析或回答：\n\n"{{query_text}}"',
          'ja-JP': '以下のテキストを分析または回答してください：\n\n"{{query_text}}"'
        },
        screen_template: {
          'en-US':
            'Please analyze the screenshot and answer the following question:\n\n{{query_text}}',
          'zh-TW': '請你分析截圖，並回答以下問題：\n\n{{query_text}}',
          'ja-JP': 'スクリーンショットを分析し、以下の質問に回答してください：\n\n{{query_text}}'
        }
      } as const

      const baseDisplayPromptMap = {
        'real-time': {
          'en-US': 'Real-time Analysis',
          'zh-TW': '即時分析',
          'ja-JP': 'リアルタイム分析'
        },
        answer: {
          'en-US': 'Answer based on transcription',
          'zh-TW': '根據轉錄內容回答出現或是潛在的問題，請針對最後出現的問題回答',
          'ja-JP': '文字起こしに基づいて回答'
        },
        summary: {
          'en-US': 'Generate summary from transcription',
          'zh-TW': '根據轉錄內容產生摘要',
          'ja-JP': '文字起こしから要約を生成'
        },
        search: {
          'en-US': 'Search request',
          'zh-TW': '搜尋請求',
          'ja-JP': '検索リクエスト'
        },
        keyword_search: {
          'en-US': 'Keyword search',
          'zh-TW': '關鍵字搜尋',
          'ja-JP': 'キーワード検索'
        },
        custom: {
          'en-US': 'Custom request',
          'zh-TW': '自訂請求',
          'ja-JP': 'カスタムリクエスト'
        },
        screen: {
          'en-US': 'Screenshot analysis',
          'zh-TW': '截圖分析',
          'ja-JP': 'スクリーンショット分析'
        },
        screenshot: {
          'en-US': 'Screenshot',
          'zh-TW': '截圖',
          'ja-JP': 'スクリーンショット'
        },
        upload: {
          'en-US': 'Upload File',
          'zh-TW': '上傳檔案',
          'ja-JP': 'ファイルアップロード'
        }
      } as const

      const currentAction = action as AIAction

      if (action === 'custom') {
        if (!query) {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-query-${Date.now()}`,
              role: 'assistant',
              content: t('noQueryProvided')
            }
          ])
          setIsLoading(false)
          return
        }
        context = {
          text: query,
          timestamp: Date.now()
        }
        finalUserMsgContent = basePromptMap.custom_template[currentLanguage].replace(
          '{{query_text}}',
          query
        )
        finalDisplayMsgContent = query
      } else if (action === 'screen') {
        context = {
          text: query || '',
          screenshot: screenshot || '',
          timestamp: Date.now()
        }
        finalUserMsgContent = basePromptMap.screen_template[currentLanguage].replace(
          '{{query_text}}',
          query || t('currentScreen')
        )
        finalDisplayMsgContent = `${t('screenshotAnalysis')}: ${query || t('currentScreen')}`
      } else if (action === 'search') {
        if (!query) {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-query-search-${Date.now()}`,
              role: 'assistant',
              content: t('noSearchQueryProvided')
            }
          ])
          setIsLoading(false)
          return
        }
        context = {
          text: query,
          timestamp: Date.now()
        }
        finalUserMsgContent = basePromptMap.search_template[currentLanguage] + query
        finalDisplayMsgContent = `${t('search')}: ${query}`
      } else if (action === 'keyword_search') {
        if (!query) {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-query-keyword_search-${Date.now()}`,
              role: 'assistant',
              content: t('noQueryProvided')
            }
          ])
          setIsLoading(false)
          return
        }
        const gatheredContext = await gatherContext(action)
        context = {
          text: `請一定要用${currentLanguage}這個語言來回答，不要講多餘的話，只有單純的名詞解釋，連第一句對於請求的回覆也不要，請用簡單易懂的方式解釋這個專業術語，不超過50字：${query}\n\n上下文：\n${gatheredContext?.text}`,
          timestamp: Date.now()
        }
        finalUserMsgContent = basePromptMap.keyword_search_template[currentLanguage] + query
        finalDisplayMsgContent = baseDisplayPromptMap.keyword_search[currentLanguage]
      } else {
        const gatheredContext = await gatherContext(action)
        if (!gatheredContext?.text && action !== 'real-time') {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `err-no-ctx-${Date.now()}`,
              role: 'assistant',
              content: t('insufficientTranscription')
            }
          ])
          setIsLoading(false)
          return
        }
        context = gatheredContext || { text: '', timestamp: Date.now() }

        switch (action) {
          case 'answer':
            finalUserMsgContent = basePromptMap.answer_template[currentLanguage] + context.text
            break
          case 'summary':
            finalUserMsgContent = basePromptMap.summary_template[currentLanguage] + context.text
            break
          case 'real-time':
            finalUserMsgContent = basePromptMap['real-time'][currentLanguage]
            break
          default:
            finalUserMsgContent = ''
        }
        finalDisplayMsgContent = baseDisplayPromptMap[currentAction][currentLanguage]
      }

      const userMsg: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: finalUserMsgContent
      }
      const displayMsg: AIMessage = {
        id: `disp-${userMsg.id}`,
        role: 'user',
        content: finalDisplayMsgContent
      }

      if (action !== 'real-time') {
        setAiMessages((prev) => [...prev, displayMsg])
      }

      try {
        let functionName = ''
        let functionPayload: Record<string, any> = {}

        switch (action) {
          case 'summary':
            functionName = 'ai-action-summarize'
            functionPayload = { text: context.text }
            break
          case 'keyword_search':
            functionName = 'ai-action-keyword-search'
            functionPayload = { text: query } // Pass the keyword query
            break
          case 'answer': // Mapping 'answer' to the recommend-response function
            functionName = 'ai-action-recommend-response'
            // The function expects a messages array
            functionPayload = { messages: [userMsg] }
            break
          case 'screen':
            functionName = 'ai-action-screenshot-analysis'
            functionPayload = { prompt: query, screenshot: screenshot }
            break
          default:
            throw new Error(`AI Action '${action}' is not supported by Supabase Edge Functions.`)
        }

        const { data, error } = await supabase.functions.invoke(functionName, {
          body: functionPayload
        })

        if (error) {
          throw error
        }

        const responseMapping = {
          summary: (d) => d.summary,
          keyword_search: (d) => `Keywords found: ${d.keywords.join(', ')}`,
          answer: (d) => d.recommendation,
          screen: (d) => d.analysis
        }

        const content = responseMapping[action]?.(data) || JSON.stringify(data)

        const aiResponse: AIMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          content: content
        }

        setAiMessages((prev) => [...prev, aiResponse])
      } catch (e: unknown) {
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
    [gatherContext, customPrompt, t, language]
  )

  // Listen for custom prompts sent from popover windows
  useEffect(() => {
    if (window.electronAPI) {
      const unsubscribe = window.electronAPI.on(
        'ai:custom-prompt',
        ({ action, prompt }: { action: AIAction; prompt: string }) => {
          sendContextToAI(action, prompt)
        }
      )
      return () => unsubscribe()
    }
  }, [sendContextToAI])

  const handleKeywordClick = useCallback(
    async (keyword: string) => {
      if (isLoading) return
      setSelectedKeyword(keyword)

      try {
        await sendContextToAI('keyword_search', keyword)
      } catch (error) {
        console.error(`[錯誤] 無法取得 ${keyword} 的解釋:`, error)
        setAiMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: `[錯誤] 無法取得 "${keyword}" 的解釋`
          }
        ])
      } finally {
        setIsLoading(false)
        setSelectedKeyword(null)
      }
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
        if (!response.ok) {
          throw new Error(`Failed to fetch screenshot: ${response.statusText}`)
        }
        const blob = await response.blob()

        const reader = new FileReader()
        reader.readAsDataURL(blob)

        reader.onloadend = () => {
          const base64data = reader.result as string
          const base64Image = base64data

          let question = ''
          switch (currentLanguage) {
            case 'zh-TW':
              question = '請分析這張截圖的內容，並提供詳細的描述。'
              break
            case 'ja-JP':
              question = 'このスクリーンショットの内容を分析し、詳細な説明を提供してください。'
              break
            default:
              question =
                'Please analyze the content of this screenshot and provide a detailed description.'
          }

          sendContextToAI('screen', question, base64Image)
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
    [sendContextToAI, currentLanguage, setAiMessages]
  )

  const handleSendMessage = (action: 'custom', prompt: string) => {
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
