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
import { AnimatedText } from '@/components/ui/AnimatedText'
import { cn } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'
import { Markdown } from '@/components/markdown'

export default function ActionsPanel() {
  const { t } = useI18n()
  const { hasEntitlement } = useAuth()
  const { sendContextToAI, aiMessages, isLoading } = useAIInteraction()
  const [isScreenSharing, setIsScreenSharing] = useState(false)
  const [input, setInput] = useState('')
  const [isConversational, setIsConversational] = useState(false)
  const [isOpen, setIsOpen] = useState(true)
  const popoverId = 'actions'
  const lastProcessedKeyword = useRef<string | null>(null)

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

      console.log(
        `[ActionsPanel] Received 'keyword:search' event for "${keyword}". Triggering AI search.`
      )
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

  type Action = {
    readonly action: 'summary' | 'answer' | 'screenshot' | 'file'
    readonly labelKey: string
    readonly icon: React.ElementType
  }

  const baseActions: Action[] = [
    { action: 'answer', labelKey: 'aiActionAnswer', icon: MessageSquareQuote }
    // { action: 'screenshot', labelKey: 'aiActionScreenshot', icon: CameraIcon }
  ]

  const actions = baseActions

  const handleActionClick = (action: 'summary' | 'answer' | 'screenshot' | 'file') => {
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
                      {m.role === 'assistant' ? <Markdown>{m.content}</Markdown> : m.content}
                    </motion.div>
                  ))}
                  {isLoading && (
                    <motion.div variants={messageItemVariants} className="text-sm text-black">
                      Loading...
                    </motion.div>
                  )}
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
