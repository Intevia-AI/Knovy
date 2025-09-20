import { useEffect, useRef, useState } from 'react'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/utils'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { Button } from '@/components/ui/button'
import { motion, AnimatePresence } from 'motion'

interface ChatPanelProps {}

export default function ChatPanel({}: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState('transcription')
  const { transcriptions, aiMessages, sendContextToAI, isLoading, isSummarizing } =
    useAIInteraction()
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [isOpen, setIsOpen] = useState(true)
  const popoverId = 'transcriptions'

  const handleKeywordClick = (keyword: string) => {
    if (window.electronAPI) {
      window.electronAPI.send('keyword:click', keyword)
    }
  }

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

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'summary') {
      sendContextToAI('summary')
    }
  }

  useEffect(() => {
    if (activeTab === 'summary') {
      const intervalId = setInterval(() => {
        console.log('[ChatPanel] Periodically updating summary...')
        sendContextToAI('summary')
      }, 30000) // 30 seconds
      return () => clearInterval(intervalId)
    }
    return undefined
  }, [activeTab, sendContextToAI])

  const summary = aiMessages.find((m) => m.id === 'ai-summary')?.content || ''

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  }

  const itemVariants = {
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
          className="flex flex-col h-screen w-full glass-popover p-2"
        >
          <div className="flex-none p-1 flex justify-center">
            <div className="bg-black/10 rounded-lg p-1 gap-1 flex text-sm">
              <Button
                variant={activeTab === 'transcription' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('transcription')}
                className="h-6 text-md"
              >
                Transcription
              </Button>
              <Button
                variant={activeTab === 'summary' ? 'secondary' : 'ghost'}
                size="sm"
                onClick={() => handleTabChange('summary')}
                className="h-6 text-md"
              >
                Summary
              </Button>
            </div>
          </div>
          <div
            ref={messagesContainerRef}
            className="flex-1 rounded-lg overflow-y-auto p-2 space-y-2 relative [mask-image:linear-gradient(to_bottom,black_95%,transparent_100%)]"
          >
            <AnimatePresence mode="wait">
              {activeTab === 'transcription' && (
                <motion.div
                  key="transcription"
                  variants={containerVariants}
                  initial="hidden"
                  animate="visible"
                  className="space-y-2"
                >
                  {transcriptions.map((m) => (
                    <motion.div
                      key={m.id}
                      variants={itemVariants}
                      className={cn(
                        'p-2 rounded-md text-sm w-fit max-w-[95%] whitespace-pre-wrap break-words text-pretty',
                        'bg-black/5 border border-black/10 mr-auto text-black'
                      )}
                    >
                      <Markdown onKeywordClick={handleKeywordClick}>{m.content}</Markdown>
                    </motion.div>
                  ))}
                </motion.div>
              )}
              {activeTab === 'summary' && (
                <motion.div
                  key="summary"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                >
                  {isLoading || (isSummarizing && !summary) ? (
                    <div className="flex justify-center py-2">
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black/50"></div>
                    </div>
                  ) : summary ? (
                    <div className="p-2 rounded-md text-sm whitespace-pre-wrap break-words text-pretty bg-black/5 border border-black/10 text-black">
                      {isSummarizing && (
                        <div className="absolute top-2 right-2">
                          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-black/50"></div>
                        </div>
                      )}
                      <Markdown>{summary}</Markdown>
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
