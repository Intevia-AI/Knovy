import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  ArrowUpRight,
  ListCollapseIcon,
  CameraIcon,
  MessageSquareQuote,
  FileIcon,
  Check,
  X,
  Loader2,
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { motion, AnimatePresence } from 'motion'
import { cn } from '@/lib/utils'
import { Markdown } from '@/components/MarkdownRenderer'
import { useActionQueue } from '@/hooks/useActionQueue'
import type { PendingAction } from '@/types/settings'
import { ACTION_TYPE_LABELS, INTENTION_LABELS } from '@/types/settings'

export default function ActionsPanel() {
  const { t, language } = useI18n()
  const { sendContextToAI, aiMessages, isLoading, setAiMessages } = useAIInteraction()
  const { pendingActions, settings, approveAction, rejectAction, executeAction } = useActionQueue()
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [input, setInput] = useState('')
  const [isConversational, setIsConversational] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const popoverId = 'actions'
  const lastProcessedKeyword = useRef<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const executingActionRef = useRef<string | null>(null) // Track which action is currently being executed
  const [actionResults, setActionResults] = useState<Record<string, string>>({}) // Store AI results per action ID
  const [hiddenMessageIds, setHiddenMessageIds] = useState<Set<string>>(new Set()) // Track hidden messages
  const messageTimestamps = useRef<Map<string, number>>(new Map()) // Stable timestamps for messages
  const autoExecutedActions = useRef<Set<string>>(new Set()) // Track actions that have been auto-executed

  useEffect(() => {
    // Auto-scroll when new messages or actions arrive (unless we're executing an action)
    if (messagesEndRef.current && !executingActionRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [aiMessages, pendingActions])

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
  // Note: This handles keyboard shortcuts AND auto-triggered actions
  useEffect(() => {
    const handleRecommendResponse = (data?: { actionId?: string; context?: any }) => {
      console.log('[ActionsPanel] Recommend response triggered', data)

      // If this is triggered by an action approval, track it
      if (data?.actionId) {
        executingActionRef.current = data.actionId
        console.log('[ActionsPanel] Tracking action:', data.actionId)
      }

      // Trigger the AI interaction with specific transcription if available
      if (data?.context?.transcriptionText) {
        // Pass the specific transcription from the action context
        sendContextToAI('answer', data.context.transcriptionText)
      } else {
        // Fallback to general context gathering (keyboard shortcut case)
        handleActionClick('answer')
      }
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
    readonly action: 'summary' | 'deep_response' | 'screenshot' | 'file'
    readonly labelKey: string
    readonly icon: React.ElementType
  }

  const baseActions: Action[] = [
    { action: 'deep_response', labelKey: 'aiActionDeepResponse', icon: MessageSquareQuote },
    { action: 'screenshot', labelKey: 'aiActionScreenshot', icon: CameraIcon }
  ]

  const actions = baseActions

  const handleActionClick = (action: 'summary' | 'deep_response' | 'screenshot' | 'file') => {
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

  // Merge AI messages and pending actions into a unified timeline with proper chronological sorting
  const conversationTimeline = useMemo(() => {
    const timeline: Array<{ type: 'message' | 'action'; data: any; timestamp: number }> = []

    // Assign stable timestamps to new messages using real time
    aiMessages.forEach((msg) => {
      if (!messageTimestamps.current.has(msg.id)) {
        // Use Date.now() for each new message to get real timestamps
        // This ensures messages and actions can properly interleave
        messageTimestamps.current.set(msg.id, Date.now())
      }
    })

    // Add all AI messages with stable timestamps
    // Filter out hidden messages
    aiMessages.forEach((msg) => {
      if (!hiddenMessageIds.has(msg.id)) {
        timeline.push({
          type: 'message',
          data: msg,
          timestamp: messageTimestamps.current.get(msg.id)!
        })
      }
    })

    // Add pending actions with their actual creation timestamps
    pendingActions.forEach((action) => {
      timeline.push({
        type: 'action',
        data: action,
        timestamp: action.createdAt || action.timestamp || Date.now()
      })
    })

    // Sort by timestamp (chronological order)
    return timeline.sort((a, b) => a.timestamp - b.timestamp)
  }, [aiMessages, pendingActions, hiddenMessageIds])

  // Auto-switch to conversational mode when there are pending actions
  useEffect(() => {
    if (pendingActions.length > 0 && !isConversational) {
      console.log('[ActionsPanel] Pending actions detected, switching to conversational mode')
      setIsConversational(true)
    }
  }, [pendingActions.length, isConversational])

  // Handle automatic execution of actions in automatic mode (per-action)
  useEffect(() => {
    if (!settings) return

    // Get current action IDs
    const currentActionIds = new Set(pendingActions.map((a) => a.id))

    // Clean up tracking set - remove actions that no longer exist
    const toRemove: string[] = []
    autoExecutedActions.current.forEach((actionId) => {
      if (!currentActionIds.has(actionId)) {
        toRemove.push(actionId)
      }
    })
    toRemove.forEach((actionId) => autoExecutedActions.current.delete(actionId))

    // Auto-execute pending actions based on per-action approval modes
    pendingActions.forEach((action) => {
      if (action.status === 'pending') {
        // IMPORTANT: Check the settingsSnapshot (approval mode when action was created)
        // not the current settings. We should only auto-execute actions that were
        // created when the mode was already "automatic", not actions that were
        // created in "ask" mode and then the user changed settings.
        const originalApprovalMode =
          action.settingsSnapshot?.actions[action.actionType]?.approvalMode

        if (originalApprovalMode === 'automatic') {
          // Check if we've already auto-executed this action
          if (autoExecutedActions.current.has(action.id)) {
            console.log('[ActionsPanel] Action already auto-executed, skipping:', action.id)
            return
          }

          console.log(
            '[ActionsPanel] Auto-executing action (was created in automatic mode):',
            action.id
          )

          // Mark this action as auto-executed
          autoExecutedActions.current.add(action.id)

          // Switch to conversational mode
          if (!isConversational) {
            setIsConversational(true)
          }
          // Approve and execute immediately
          approveAction(action.id)
          setTimeout(() => executeAction(action), 100)
        } else if (originalApprovalMode === 'ask') {
          console.log(
            '[ActionsPanel] Action was created in ask mode, not auto-executing even though settings changed:',
            action.id
          )
        }
      }
    })
  }, [pendingActions, settings, approveAction, executeAction, isConversational])

  // Intercept AI responses for executing actions
  useEffect(() => {
    if (!executingActionRef.current) return

    // Check if a new AI message (assistant response) was added
    const lastMessage = aiMessages[aiMessages.length - 1]
    if (lastMessage && lastMessage.role === 'assistant') {
      const actionId = executingActionRef.current
      console.log('[ActionsPanel] Capturing AI response for action:', actionId)

      // Store the result for this action
      setActionResults((prev) => ({
        ...prev,
        [actionId]: lastMessage.content
      }))

      // Hide the AI message from the timeline (it will be shown inline with the action)
      setHiddenMessageIds((prev) => new Set(prev).add(lastMessage.id))

      // Also hide the user prompt message if it exists (the "請根據前後文推薦適合的回應")
      const lastUserMsg = aiMessages[aiMessages.length - 2] // The user message is before the AI response
      if (lastUserMsg && lastUserMsg.role === 'user') {
        setHiddenMessageIds((prev) => new Set(prev).add(lastUserMsg.id))
      }

      // Clear the executing action reference
      executingActionRef.current = null
    }
  }, [aiMessages])

  // Render inline action notification (styled as system message - gray, left-aligned)
  const renderActionNotification = (action: PendingAction) => {
    const intentionLabel = INTENTION_LABELS[action.intention.primary][language]
    // Use the original approval mode from when the action was created
    // This ensures buttons stay visible even if settings change after action creation
    const originalApprovalMode =
      action.settingsSnapshot?.actions[action.actionType]?.approvalMode || 'ask'
    const isExecutingThisAction = executingActionRef.current === action.id

    return (
      <div className="space-y-2 w-full">
        {/* Approval message - styled as system message (gray, left-aligned) */}
        <div className="p-2 rounded-md text-sm w-fit max-w-[95%] bg-black/5 border-black/10 mr-auto text-left">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs px-2 py-0.5 rounded-full bg-black/10 text-gray-700">
                {intentionLabel}
              </span>
            </div>
            <div className="text-xs text-gray-700">"{action.context.transcriptionText}"</div>

            {/* Action buttons for pending in ask mode */}
            {action.status === 'pending' && originalApprovalMode === 'ask' && (
              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={() => rejectAction(action.id)}
                  variant="ghost"
                  className="h-7 px-3 text-xs hover:bg-red-500/20 text-gray-700"
                >
                  <X className="h-3 w-3 mr-1" />
                  {t('reject')}
                </Button>
                <Button
                  size="sm"
                  onClick={() => {
                    approveAction(action.id)
                    setTimeout(() => executeAction(action), 100)
                  }}
                  className="h-7 px-3 text-xs bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <Check className="h-3 w-3 mr-1" />
                  {t('approve')}
                </Button>
              </div>
            )}

            {/* Executing state with audio wave animation */}
            {(action.status === 'executing' || isExecutingThisAction) && (
              <div className="pt-2 mt-2 border-t border-gray-300">
                <div className="flex items-center justify-center gap-0.5 h-6">
                  {/* Audio wave animation */}
                  {[0, 1, 2, 3, 4].map((i) => (
                    <motion.div
                      key={i}
                      className="w-0.5 bg-black/40 rounded-full"
                      animate={{
                        height: ['8px', '16px', '8px']
                      }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        delay: i * 0.1,
                        ease: 'easeInOut'
                      }}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Failed state with retry */}
            {action.status === 'failed' && (
              <div className="space-y-2 pt-1">
                <div className="flex items-center gap-2 text-xs text-red-700">
                  <AlertCircle className="h-3 w-3" />
                  <span>{action.error || t('actionFailed')}</span>
                </div>
                <Button
                  size="sm"
                  onClick={() => executeAction(action)}
                  className="h-7 px-3 text-xs bg-blue-500 hover:bg-blue-600 text-white"
                >
                  <RefreshCw className="h-3 w-3 mr-1" />
                  {t('retry')}
                </Button>
              </div>
            )}

            {/* Completed state with inline AI result */}
            {action.status === 'completed' && actionResults[action.id] && (
              <div className="pt-2 mt-2 border-t border-gray-300">
                <Markdown>{actionResults[action.id]}</Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

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
          <AnimatePresence initial={false}>
            {isConversational ? (
              <motion.div
                key="conversation"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col flex-grow space-y-2 overflow-hidden"
              >
                {/* Conversational View with Integrated Actions */}
                <motion.div
                  variants={messageContainerVariants}
                  initial="hidden"
                  animate="visible"
                  className="flex-grow overflow-y-auto p-2 space-y-4 [mask-image:linear-gradient(to_bottom,black_95%,transparent_100%)]"
                >
                  {conversationTimeline.map((item) =>
                    item.type === 'message' ? (
                      <motion.div
                        key={item.data.id}
                        variants={messageItemVariants}
                        className={cn(
                          'p-2 rounded-md text-sm w-fit max-w-[95%] whitespace-pre-wrap break-words text-pretty',
                          item.data.role === 'user'
                            ? 'bg-blue-500/10 border-blue-500/20 ml-auto text-right'
                            : 'bg-black/5 border-black/10 mr-auto text-left'
                        )}
                      >
                        {item.data.role === 'assistant' ? (
                          <Markdown>{item.data.content}</Markdown>
                        ) : (
                          <div className="space-y-2">
                            {item.data.content}
                            {/* Show screenshot if this user message contains one */}
                            {(item.data as any).screenshot && (
                              <img
                                src={(item.data as any).screenshot}
                                alt="Screenshot"
                                className="max-w-full max-h-48 object-contain rounded border mt-2"
                              />
                            )}
                          </div>
                        )}
                      </motion.div>
                    ) : (
                      <motion.div
                        key={`action-${item.data.id}`}
                        variants={messageItemVariants}
                        className="w-full"
                      >
                        {renderActionNotification(item.data)}
                      </motion.div>
                    )
                  )}
                  {isLoading && !executingActionRef.current && (
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
                className="flex-grow h-8 text-sm bg-black/5 border-none placeholder:text-gray-500 text-black"
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
