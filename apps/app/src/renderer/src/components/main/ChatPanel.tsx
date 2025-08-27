import React, { useRef, useEffect } from 'react'
import { Message as AIMessage } from 'ai'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ArrowUpRight } from 'lucide-react'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/utils'
import { useI18n } from '@/hooks/useI18n'

interface ChatPanelProps {
  messages: AIMessage[]
  isLoading: boolean
  isScreenSharing: boolean
  customPrompt: string
  setCustomPrompt: (prompt: string) => void
  onSendMessage: (action: 'custom', prompt: string) => void
  isSubtitleVisible?: boolean
}

export default function ChatPanel({
  messages,
  isLoading,
  isScreenSharing,
  customPrompt,
  setCustomPrompt,
}: ChatPanelProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!customPrompt.trim() || isLoading || !isScreenSharing) return
    window.electronAPI.send('popover:sendMessage', { action: 'custom', prompt: customPrompt })
    setCustomPrompt('')
  }

  return (
    <div className="grid gap-4 p-4 bg-muted/10 rounded-2xl">
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {messages.map((m) => (
          <div
            key={m.id}
            className={cn(
              'p-2 rounded-md text-xs w-fit max-w-[95%] whitespace-pre-wrap',
              m.role === 'user'
                ? 'bg-blue-500/20 border border-blue-500/30 ml-auto text-black'
                : 'bg-white/10 border border-white/20 mr-auto text-black'
            )}
          >
            <Markdown>{m.content}</Markdown>
          </div>
        ))}
        {isLoading && (
          <div className="flex justify-center py-2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white/50"></div>
          </div>
        )}
      </div>

      <div className="flex-none p-2 border-t border-white/10">
        <form onSubmit={handleSubmit} className="flex gap-2 text-black">
          <Input
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            placeholder={
              isScreenSharing ? t('chatPlaceholderSharing') : t('chatPlaceholderNotSharing')
            }
            className="flex-grow h-8 text-xs bg-black/20 border-white/20 placeholder:text-black/40 text-black"
            disabled={isLoading || !isScreenSharing}
            aria-label="Custom prompt input"
          />
          <Button
            type="submit"
            variant="default"
            size="icon"
            disabled={isLoading || !isScreenSharing || !customPrompt.trim()}
            className="h-8 w-8 bg-white/10 hover:bg-white/20 text-black"
            aria-label={t('sendChatButtonLabel')}
          >
            <ArrowUpRight className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  )
}
