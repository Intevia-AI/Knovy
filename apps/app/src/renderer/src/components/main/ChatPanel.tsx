import React, { useRef, useState } from 'react'
import { Message as AIMessage } from 'ai'
import { Markdown } from '@/components/markdown'
import { cn } from '@/lib/utils'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { Button } from '@/components/ui/button'

interface ChatPanelProps {}

export default function ChatPanel({}: ChatPanelProps) {
  const [activeTab, setActiveTab] = useState('transcription')
  const { transcriptions, aiMessages, sendContextToAI, isLoading } = useAIInteraction()
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const handleTabChange = (tab: string) => {
    setActiveTab(tab)
    if (tab === 'summary' && aiMessages.filter((m) => m.role === 'assistant').length === 0) {
      sendContextToAI('summary')
    }
  }

  const summary = aiMessages.find((m) => m.id === 'ai-summary')?.content || ''

  return (
    <div className="flex flex-col h-screen w-full glass-popover p-1">
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
      <div ref={messagesContainerRef} className="flex-1 overflow-y-auto p-2 space-y-2">
        {activeTab === 'transcription' &&
          transcriptions.map((m) => (
            <div
              key={m.id}
              className={cn(
                'p-2 rounded-md text-sm w-fit max-w-[95%] whitespace-pre-wrap',
                'bg-black/5 border border-black/10 mr-auto text-black'
              )}
            >
              <Markdown>{m.content}</Markdown>
            </div>
          ))}
        {activeTab === 'summary' &&
          (isLoading && !summary ? (
            <div className="flex justify-center py-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black/50"></div>
            </div>
          ) : (
            <div className="p-2 rounded-md text-sm whitespace-pre-wrap bg-black/5 border border-black/10 text-black">
              <Markdown>{summary || 'No summary available.'}</Markdown>
            </div>
          ))}
      </div>
    </div>
  )
}
