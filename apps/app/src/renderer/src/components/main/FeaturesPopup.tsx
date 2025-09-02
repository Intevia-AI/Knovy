import React, { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ListCollapseIcon, CameraIcon, History, MessageSquareQuote } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { AIAction } from '@/hooks/useAIInteraction'

export function FeaturesPopup() {
  const { t } = useI18n()
  const [isScreenSharing, setIsScreenSharing] = useState(false)

  useEffect(() => {
    const getInitialData = async () => {
      if (window.electronAPI) {
        try {
          const sharingState = await window.electronAPI.invoke('get-screenshare-state')
          setIsScreenSharing(sharingState)
        } catch (error) {
          console.error('[FeaturesPopup] Error fetching screen share state:', error)
        }
      }
    }
    getInitialData()
  }, [])

  useEffect(() => {
    if (window.electronAPI) {
      const unsubscribe = window.electronAPI.on(
        'screenshare:state-changed',
        (isScreenSharing: boolean) => {
          setIsScreenSharing(isScreenSharing)
        }
      )
      return () => unsubscribe()
    }
  }, [])

  const features = [
    { action: 'summary', labelKey: 'aiActionSummary', icon: ListCollapseIcon },
    { action: 'answer', labelKey: 'aiActionAnswer', icon: MessageSquareQuote },
    { action: 'screenshot', labelKey: 'aiActionScreenshot', icon: CameraIcon }
  ] as const

  const onShowHistory = () => {
    if (window.electronAPI) {
      window.electronAPI.send('history:open')
    }
  }

  return (
    <div className="glass-popover grid gap-2 p-2">
      {features.map(({ action, labelKey, icon: Icon }) => (
        <Button
          key={action}
          variant="ghost"
          size="sm"
          disabled={!isScreenSharing}
          onClick={() => onAiAction(action)}
          className="w-full justify-start text-xs h-8 text-black hover:bg-black/10 hover:text-black"
        >
          <Icon className="mr-2 h-3 w-3" />
          {t(labelKey as any)}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onShowHistory}
        className="w-full justify-start text-xs h-8 text-black hover:bg-black/10 hover:text-black"
      >
        <History className="mr-2 h-3 w-3" />
        View History
      </Button>
    </div>
  )
}