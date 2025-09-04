import React, { useRef, useState, useEffect } from 'react'
import { Message as AIMessage } from 'ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowUpRight } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'

// Define the message type received from IPC
interface TranscriptionMessage extends AIMessage {
  timestamp: number
  type: 'transcription'
}

interface ChatPanelProps {}

export default function ChatPanel({}: ChatPanelProps) {
  const [messages, setMessages] = useState<AIMessage[]>([])
  const [input, setInput] = useState('') // Local state for the input
  const [isLoading, setIsLoading] = useState(false) // Local loading state
  const [isScreenSharing, setIsScreenSharing] = useState(false) // Internal state
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  // Fetch initial state and data when the component mounts
  useEffect(() => {
    const getInitialData = async () => {
      if (window.electronAPI) {
        try {
          // 1. Fetch screen sharing state
          const sharingState = await window.electronAPI.invoke('get-screenshare-state')
          setIsScreenSharing(sharingState)
          console.log(`[ChatPanel] Initial isScreenSharing state: ${sharingState}`)

          if (sharingState) {
            // 2. If sharing, get the current session ID
            const sessionId = await window.electronAPI.invoke('session:get-id')
            console.log(`[ChatPanel] Fetched current session ID: ${sessionId}`)

            if (sessionId) {
              // 3. If we have a session ID, get its transcripts
              const transcripts = await window.electronAPI.invoke('db:get-transcripts', sessionId)
              console.log(
                `[ChatPanel] Received ${transcripts.length} historical transcripts for session ${sessionId}.`
              )
              const historicalMessages: AIMessage[] = transcripts.map((t: any) => ({
                id: t.id,
                role: 'assistant',
                content: t.content
              }))
              setMessages(historicalMessages)
            } else {
              console.warn(
                '[ChatPanel] Screen is sharing, but no session ID was found in the main process.'
              )
            }
          }
        } catch (error) {
          console.error('[ChatPanel] Error fetching initial data:', error)
        }
      }
    }
    getInitialData()
  }, [])

  // Effect to listen for screen sharing state changes
  useEffect(() => {
    const unsubscribe = window.electronAPI.on(
      'screenshare:state-changed',
      (isScreenSharing: boolean) => {
        console.log(`[ChatPanel] Received screenshare:state-changed = ${isScreenSharing}`)
        setIsScreenSharing(isScreenSharing)
      }
    )
    return () => unsubscribe()
  }, [])

  // Effect to listen for transcription data from the main process
  useEffect(() => {
    const unsubscribe = window.electronAPI.on(
      'transcription:data',
      (newMessage: TranscriptionMessage) => {
        setMessages((prevMessages) => [...prevMessages, newMessage])
      }
    )

    return () => {
      unsubscribe()
    }
  }, []) // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!input.trim() || isLoading || !isScreenSharing) return
    // Send the message to the main window via the main process
    window.electronAPI.send('popover:sendMessage', { action: 'custom', prompt: input })
    setInput('') // Clear the input
  }

  return (
    <div className="flex flex-col h-full glass-popover p-1">
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'p-2 rounded-md text-sm w-fit max-w-[95%] whitespace-pre-wrap',
              m.role === 'user'
                ? 'bg-blue-500/20 border border-blue-500/30 ml-auto text-black'
                : 'bg-black/5 border border-black/10 mr-auto text-black'
            )}
          >
            <Markdown>{m.content}</Markdown>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black/50"></div>
          </div>
        )}
      </div>

      <div className="flex-none p-2 border-t border-black/10">
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
    </div>
  )
}
