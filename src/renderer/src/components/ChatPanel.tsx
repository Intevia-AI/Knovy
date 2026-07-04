import { useEffect, useRef, useState } from 'react'
import { Markdown } from '@/components/MarkdownRenderer'
import { StreamingText } from '@/components/StreamingText'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { Button } from '@/components/ui/button'
import { Message, MessageContent, MessageFooter } from '@/components/ui/message'
import { Bubble, BubbleContent } from '@/components/ui/bubble'
import {
  MessageScrollerProvider,
  MessageScroller,
  MessageScrollerViewport,
  MessageScrollerContent,
  MessageScrollerItem,
  MessageScrollerButton
} from '@/components/ui/message-scroller'
import { Marker, MarkerIcon, MarkerContent } from '@/components/ui/marker'
import { Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'motion'
import { useTranslation } from '@/context/TranslationContext'
import { parseStructuredSummary } from '@/lib/summary-utils'

interface ChatPanelProps {}

export default function ChatPanel({}: ChatPanelProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState('transcription')
  const { transcriptions, aiMessages, sendContextToAI, isLoading, isSummarizing } =
    useAIInteraction()
  const [isOpen, setIsOpen] = useState(true)
  const popoverId = 'transcriptions'

  // Store latest sendContextToAI in a ref to avoid stale closure in interval
  const sendContextToAIRef = useRef(sendContextToAI)
  useEffect(() => {
    sendContextToAIRef.current = sendContextToAI
  }, [sendContextToAI])

  const handleKeywordClick = (keyword: string) => {
    if ((window as any).electronAPI) {
      ;(window as any).electronAPI.send('keyword:click', keyword)
    }
  }

  useEffect(() => {
    const unsubscribe = (window as any).electronAPI.on('popover:prepare-to-close', (id) => {
      if (id === popoverId) {
        setIsOpen(false)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'summary') {
      sendContextToAI('summary')
    }
  }

  // Background auto-summarization: Runs every 60 seconds when ChatPanel is open
  // Smart logic in useAIInteraction skips API calls if no new transcripts exist
  // Uses ref to avoid stale closure problem with sendContextToAI
  useEffect(() => {
    console.log('[ChatPanel] Starting background auto-summarization (60s interval)')
    const intervalId = setInterval(() => {
      console.log('[ChatPanel] Background auto-summarization tick')
      sendContextToAIRef.current('summary')
    }, 60000) // 60 seconds

    return () => {
      console.log('[ChatPanel] Stopping background auto-summarization')
      clearInterval(intervalId)
    }
  }, [])

  const summary = aiMessages.find((m) => m.id === 'ai-summary')?.content || ''

  const handleAnimationComplete = () => {
    if (!isOpen) {
      ;(window as any).electronAPI.send('popover:ready-to-close', popoverId)
    }
  }

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-screen w-full glass-popover p-2"
        >
          <div className="flex-none p-1 flex justify-center">
            <div className="bg-black/10 rounded-lg p-1 gap-1 flex text-sm">
              <Button
                variant={activeTab === 'transcription' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('transcription')}
                className="h-6 text-md select-none"
              >
                {t('transcriptionTab')}
              </Button>
              <Button
                variant={activeTab === 'summary' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('summary')}
                className="h-6 text-md select-none"
              >
                {t('summaryTab')}
              </Button>
            </div>
          </div>
          <div className="flex-1 min-h-0 rounded-lg relative [mask-image:linear-gradient(to_bottom,black_95%,transparent_100%)]">
            <AnimatePresence mode="wait">
              {activeTab === 'transcription' && (
                <motion.div
                  key="transcription"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full"
                >
                  <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                    <MessageScroller>
                      <MessageScrollerViewport className="p-2">
                        <MessageScrollerContent className="gap-2">
                          {transcriptions.map((m) => {
                            const isUserMessage = m.sourceType === 'microphone'
                            const align = isUserMessage ? 'end' : 'start'
                            return (
                              <MessageScrollerItem key={m.id} messageId={m.id}>
                                <Message align={align}>
                                  <MessageContent className="gap-1">
                                    <Bubble
                                      variant={isUserMessage ? 'tinted' : 'muted'}
                                      align={align}
                                      className="max-w-[95%]"
                                    >
                                      <BubbleContent className="whitespace-pre-wrap text-pretty text-black">
                                        {m.isThinking && !m.content ? (
                                          <Marker>
                                            <MarkerIcon>
                                              <Loader2 className="animate-spin" />
                                            </MarkerIcon>
                                            <MarkerContent className="animate-pulse">
                                              {t('thinkingIndicator')}
                                            </MarkerContent>
                                          </Marker>
                                        ) : (
                                          <StreamingText
                                            text={m.content}
                                            isStreaming={m.isStreaming}
                                          />
                                        )}
                                      </BubbleContent>
                                    </Bubble>
                                    <MessageFooter className="text-gray-400">
                                      {new Date(m.timestamp).toLocaleTimeString([], {
                                        hour: 'numeric',
                                        minute: '2-digit'
                                      })}
                                    </MessageFooter>
                                  </MessageContent>
                                </Message>
                              </MessageScrollerItem>
                            )
                          })}
                        </MessageScrollerContent>
                      </MessageScrollerViewport>
                      <MessageScrollerButton />
                    </MessageScroller>
                  </MessageScrollerProvider>
                </motion.div>
              )}
              {activeTab === 'summary' && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full overflow-y-auto p-2"
                >
                  {isLoading || (isSummarizing && !summary) ? (
                    <div className="flex justify-center py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black/50"></div>
                    </div>
                  ) : summary ? (
                    <div className="p-2 rounded-md text-sm break-words text-pretty bg-black/5 border border-black/10 text-black">
                      {isSummarizing && (
                        <div className="absolute top-2 right-2">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-black/50"></div>
                        </div>
                      )}
                      {(() => {
                        const structured = parseStructuredSummary(summary)
                        if (!structured) {
                          return (
                            <div className="whitespace-pre-wrap">
                              <Markdown onKeywordClick={handleKeywordClick}>{summary}</Markdown>
                            </div>
                          )
                        }
                        const sections = [
                          { title: t('summaryKeyPoints'), items: structured.key_points },
                          { title: t('summaryDecisions'), items: structured.decisions },
                          { title: t('summaryActionItems'), items: structured.action_items },
                          { title: t('summaryOpenQuestions'), items: structured.open_questions }
                        ].filter((s) => s.items?.length > 0)
                        return (
                          <div className="space-y-3">
                            <p className="font-medium">{structured.short_summary}</p>
                            {sections.map((section) => (
                              <div key={section.title}>
                                <div className="text-xs font-medium text-gray-500 mb-1">
                                  {section.title}
                                </div>
                                <ul className="list-disc pl-4 space-y-0.5">
                                  {section.items.map((item, i) => (
                                    <li key={i}>{item}</li>
                                  ))}
                                </ul>
                              </div>
                            ))}
                            {structured.topics?.length > 0 && (
                              <div className="text-xs text-gray-500">
                                {t('summaryTopics')}: {structured.topics.join(' · ')}
                              </div>
                            )}
                          </div>
                        )
                      })()}
                    </div>
                  ) : (
                    <div className="text-center text-sm text-gray-500">No summary available.</div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
