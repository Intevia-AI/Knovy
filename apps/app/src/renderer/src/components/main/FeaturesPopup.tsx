import React from 'react'
import { Button } from '@/components/ui/button'
import { ListCollapseIcon, CameraIcon, History } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { AIAction } from '@/hooks/useAIInteraction'

interface FeaturesPopupProps {
  onAiAction: (action: AIAction) => void
  isScreenSharing: boolean
  onShowHistory: () => void
}

export function FeaturesPopup({ onAiAction, isScreenSharing, onShowHistory }: FeaturesPopupProps) {
  const { t } = useI18n()

  const features = [
    { action: 'summary', labelKey: 'aiActionSummary', icon: ListCollapseIcon },
    { action: 'screenshot', labelKey: 'aiActionScreenshot', icon: CameraIcon }
  ] as const

  return (
    <div className="grid gap-1 p-2 glass-popover">
      {features.map(({ action, labelKey, icon: Icon }) => (
        <Button
          key={action}
          variant="ghost"
          size="sm"
          disabled={!isScreenSharing}
          onClick={() => onAiAction(action)}
          className="w-full justify-start text-xs h-8 text-gray-200 hover:bg-white/10 hover:text-white"
        >
          <Icon className="mr-2 h-3 w-3" />
          {t(labelKey as any)}
        </Button>
      ))}
      <Button
        variant="ghost"
        size="sm"
        onClick={onShowHistory}
        className="w-full justify-start text-xs h-8 text-gray-200 hover:bg-white/10 hover:text-white"
      >
        <History className="mr-2 h-3 w-3" />
        View History
      </Button>
    </div>
  )
}