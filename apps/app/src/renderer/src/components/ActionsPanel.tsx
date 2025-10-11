import React, { useState, useEffect, useCallback, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowUpRight,
  ListCollapseIcon,
  CameraIcon,
  MessageSquareQuote,
  FileIcon
} from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { motion, AnimatePresence } from 'motion'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/useAuth'
import { Markdown } from '@/components/MarkdownRenderer'
import { useActionQueue } from '@/hooks/useActionQueue'
import { ActionQueue } from '@/components/ActionQueue'

export default function ActionsPanel() {
  const { t } = useI18n()
  const { sendContextToAI, aiMessages, isLoading, setAiMessages } = useAIInteraction()
  const { pendingActions, settings, approveAction, rejectAction, executeAction } = useActionQueue()
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [input, setInput] = useState('')
  const [isConversational, setIsConversational] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const popoverId = 'actions'
  const lastProcessedKeyword = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [aiMessages, isLoading])

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('popover:prepare-to-close', (id) => {
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

  useEffect(() => {
    const getInitialData = async () => {
      if (window.electronAPI) {
        try {
          const sharingState = await window.electronAPI.invoke('get-screenshare-state')
          setIsScreenSharing(sharingState)
        } catch (error) {
          console.error('[ActionsPanel] Error fetching screen share state:', error)
        }
      }
    }
    getInitialData()

    const unsubscribe = window.electronAPI.on('screenshare:state-changed', (isSharing: boolean) => {
      setIsScreenSharing(isSharing)
      if (!isSharing) {
        setIsConversational(false) // Reset on sharing stop
      }
    })
    return () => unsubscribe()
  }, [])

  const handleKeywordSearch = useCallback(
    (keyword: string) => {
      if (!keyword || keyword === lastProcessedKeyword.current) return
      lastProcessedKeyword.current = keyword

      if (!isConversational) {
        setIsConversational(true)
      }
      sendContextToAI('keyword_search', keyword)
    },
    [isConversational, sendContextToAI]
  )

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('keyword:search', handleKeywordSearch)
    return () => {
      unsubscribe()
    }
  }, [handleKeywordSearch])

  useEffect(() => {
    const consumeInitialKeyword = async () => {
      const keyword = await window.electronAPI.invoke('popover:consume-pending-keyword')
      if (keyword) {
        handleKeywordSearch(keyword)
      }
    }
    consumeInitialKeyword()
  }, [handleKeywordSearch])

  // Listen for AI action shortcuts via IPC
  useEffect(() => {
    const handleRecommendResponse = () => {
      console.log('[ActionsPanel] Shortcut: Recommend response triggered')
      handleActionClick('answer')
    }

    const unsubscribe = window.electronAPI.on(
      'ai-action:recommend-response',
      handleRecommendResponse
    )
    return () => {
      unsubscribe()
    }
  }, [isConversational, sendContextToAI])

  useEffect(() => {
    // Receive base64 screenshot data directly from main process
    const unsubscribeScreenshotTaken = window.electronAPI.on(
      'electronAPI:screenshotTaken',
      async (base64Data: string) => {
        try {
          // Switch to conversational mode
          setIsConversational(true)

          // Add a user message with the screenshot (like in chat apps)
          const screenshotMessage = {
            id: `screenshot-${Date.now()}`,
            role: 'user' as const,
            content: t('aiActionScreenshotDisplay'), // "Please analyze this screenshot"
            screenshot: base64Data // Add screenshot data to the message
          }

          // Add the screenshot message to the conversation
          setAiMessages((prev) => [...prev, screenshotMessage])

          // Send to AI analysis
          sendContextToAI('screenshot', undefined, base64Data)
        } catch (error) {
          console.error('[ActionsPanel] Error processing screenshot:', error)
        }
      }
    )

    const unsubscribeScreenshotError = window.electronAPI.on(
      'electronAPI:screenshotError',
      (error: string) => {
        console.error('[ActionsPanel] Screenshot error (generic on):', error)
      }
    )

    return () => {
      unsubscribeScreenshotTaken()
      unsubscribeScreenshotError()
    }
  }, []) // Remove dependencies to prevent constant re-setup

  type Action = {
    readonly action: 'summary' | 'answer' | 'screenshot' | 'file'
    readonly labelKey: string
    readonly icon: React.ElementType
  }

  const baseActions: Action[] = [
    { action: 'answer', labelKey: 'aiActionAnswer', icon: MessageSquareQuote },
    { action: 'screenshot', labelKey: 'aiActionScreenshot', icon: CameraIcon }
  ]

  const actions = baseActions

  const handleActionClick = (action: 'summary' | 'answer' | 'screenshot' | 'file') => {
    if (action === 'screenshot') {
      window.electronAPI.startScreenshot()
      return
    }

    if (!isConversational) {
      setIsConversational(true)
    }
    sendContextToAI(action)
  }

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !isScreenSharing) return
    if (!isConversational) {
      setIsConversational(true)
    }
    sendContextToAI('chat', input)
    setInput('')
  }

  const messageContainerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const messageItemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0 }
  }

  const handleAnimationComplete = () => {
    if (!isOpen) {
      window.electronAPI.send('popover:ready-to-close', popoverId)
    }
  }

  // Handle automatic execution of actions in automatic mode
  useEffect(() => {
    if (!settings || settings.approvalMode !== 'automatic') return

    // Auto-execute pending actions
    pendingActions.forEach((action) => {
      if (action.status === 'pending') {
        console.log('[ActionsPanel] Auto-executing action in automatic mode:', action.id)
        // Approve and execute immediately
        approveAction(action.id)
        setTimeout(() => executeAction(action), 100)
      }
    })
  }, [pendingActions, settings, approveAction, executeAction])

  // Handle AI action execution with context
  useEffect(() => {
    const handleAIAction = (data: any) => {
      console.log('[ActionsPanel] AI action triggered with context:', data)
      // Switch to conversational mode and trigger AI response
      if (!isConversational) {
        setIsConversational(true)
      }
      // Trigger the 'answer' action which generates a recommended response
      sendContextToAI('answer')
    }

    const unsubscribe = window.electronAPI.on('ai-action:recommend-response', handleAIAction)
    return () => unsubscribe()
  }, [isConversational, sendContextToAI])

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="flex flex-col h-screen w-full glass-popover p-2 space-y-2 overflow-y-auto"
        >
          {/* Action Queue - Always visible when there are pending actions */}
          {pendingActions.length > 0 && settings && (
            <div className="flex-none">
              <ActionQueue
                pendingActions={pendingActions}
                approvalMode={settings.approvalMode}
                onApprove={approveAction}
                onReject={rejectAction}
                onExecute={executeAction}
              />
            </div>
          )}

          <AnimatePresence initial={false}>
            {isConversational ? (
              <motion.div
                key="conversation"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col flex-grow space-y-2 overflow-hidden"
              >
                {/* Conversational View */}
                <motion.div
                  variants={messageContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex-grow overflow-y-auto p-2 space-y-4 [mask-image:linear-gradient(to_bottom,black_95%,transparent_100%)]"
                >
                  {aiMessages.map((m) => (
                    <motion.div
                      key={m.id}
                      variants={messageItemVariants}
                      className={cn(
                        'p-2 rounded-md text-sm w-fit max-w-[95%] whitespace-pre-wrap break-words text-pretty',
                        m.role === 'user'
                          ? 'bg-blue-500/10 border-blue-500/20 ml-auto text-right'
                          : 'bg-black/5 border-black/10 mr-auto text-left'
                      )}
                    >
                      {m.role === 'assistant' ? (
                        <Markdown>{m.content}</Markdown>
                      ) : (
                        <div className="space-y-2">
                          {m.content}
                          {/* Show screenshot if this user message contains one */}
                          {(m as any).screenshot && (
                            <img
                              src={(m as any).screenshot}
                              alt="Screenshot"
                              className="max-w-full max-h-48 object-contain rounded border mt-2"
                            />
                          )}
                        </div>
                      )}
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div variants={messageItemVariants} className="text-sm text-black">
                      Loading...
                    </motion.div>
                  )}
                  <div ref={messagesEndRef} />
                </motion.div>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                exit={{ opacity: 0, scale: 0.9 }}
                className="grid grid-cols-2 gap-2 flex-grow"
              >
                {actions.map(({ action, labelKey, icon: Icon }) => (
                  <Button
                    key={action}
                    variant="ghost"
                    size="lg"
                    disabled={!isScreenSharing}
                    onClick={() => handleActionClick(action)}
                    className="flex flex-col items-center justify-center h-full text-black hover:bg-black/10 hover:text-black space-y-1"
                  >
                    <Icon className="h-6 w-6" />
                    <span className="text-xs">{t(labelKey as any)}</span>
                  </Button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Bottom Bar */}
          <div className="flex-none">
            {isConversational && (
              <div className="flex justify-center gap-2 mb-2">
                {actions.map(({ action, icon: Icon }) => (
                  <Button
                    key={action}
                    variant="ghost"
                    size="icon"
                    disabled={!isScreenSharing || isLoading}
                    onClick={() => handleActionClick(action)}
                    className="h-8 w-8 bg-black/10 hover:bg-black/20 text-black"
                  >
                    <Icon className="h-4 w-4" />
                  </Button>
                ))}
              </div>
            )}
            <form onSubmit={handleSubmit} className="flex gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder={
                  isScreenSharing ? t('chatPlaceholderSharing') : t('chatPlaceholderNotSharing')
                }
                className="flex-grow h-8 text-sm bg-black/5 border-black/20 placeholder:text-gray-500 text-black"
                disabled={isLoading || !isScreenSharing}
                aria-label="Custom prompt input"
              />
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                disabled={isLoading || !isScreenSharing || !input.trim()}
                className="h-8 w-8 bg-black/10 hover:bg-black/20 text-black"
                aria-label={t('sendChatButtonLabel')}
              >
                <ArrowUpRight className="h-4 w-4" />
              </Button>
            </form>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
