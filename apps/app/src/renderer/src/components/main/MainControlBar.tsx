import React from 'react'
import { Button } from '@/components/ui/button'
import { MicIcon, SettingsIcon, LayoutGrid, MonitorIcon, MessageSquare } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { formatTime } from '@/lib/utils'
import { useAuth } from '@/context/AuthContext'

interface MainControlBarProps {
  isAlwaysOnTop: boolean
  toggleAlwaysOnTop: () => void
  minimizeWindow: () => void
  closeWindow: () => void
  isScreenSharing: boolean
  onToggleScreenShare: () => void
  recordingDuration: number
  // New props for popover management
  onToggleTranscriptionWindow: () => void
  isChatPanelVisible: boolean
  onToggleFeaturesWindow: () => void
  isActionPanelVisible: boolean
  onToggleSettingsWindow: () => void
  isSettingsWindowVisible: boolean
  onToggleScreenPreviewWindow: () => void
  isScreenPreviewVisible: boolean
}

export function MainControlBar({
  isScreenSharing,
  onToggleScreenShare,
  recordingDuration,
  // Destructure new props
  onToggleTranscriptionWindow,
  isChatPanelVisible,
  onToggleFeaturesWindow,
  isActionPanelVisible,
  onToggleSettingsWindow,
  isSettingsWindowVisible,
  onToggleScreenPreviewWindow,
  isScreenPreviewVisible
}: MainControlBarProps) {
  const { t } = useI18n()
  const { permissions } = useAuth()

  const canShowActions = permissions.some((p) => p.startsWith('ai_action:'))

  return (
    <header
      className="flex items-center justify-between p-1 bg-transparent rounded-full w-full h-full px-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side controls */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Button
          variant={'ghost'}
          size="sm"
          onClick={onToggleScreenShare}
          className={`h-8 rounded-full shadow text-sm w-24 ${isScreenSharing ? 'bg-destructive/80 text-white breathing-light' : 'bg-muted text-black hover:bg-destructive/80 hover:text-white'} `}
        >
          <MicIcon className="h-8 w-8" />
          {isScreenSharing ? formatTime(recordingDuration) : 'Listen'}
        </Button>
        {isScreenSharing && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleScreenPreviewWindow}
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${isScreenPreviewVisible ? 'bg-white' : ''}`}
              title="Screen Preview"
            >
              <MonitorIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTranscriptionWindow}
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${isChatPanelVisible ? 'bg-white' : ''}`}
              title="Show Transcriptions"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            {canShowActions && (
              <Button
                variant="ghost"
                size="icon"
                onClick={onToggleFeaturesWindow}
                className={`h-8 w-8 rounded-full shadow hover:bg-white ${isActionPanelVisible ? 'bg-white' : ''}`}
                title="actions"
              >
                <LayoutGrid className="h-4 w-4" />
              </Button>
            )}
          </>
        )}
      </div>

      {/* Right side controls */}
      <div
        className="flex items-center gap-1"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Button
          variant="ghost"
          size="icon"
          onClick={onToggleSettingsWindow}
          className={`h-8 w-8 rounded-full shadow hover:bg-white ${isSettingsWindowVisible ? 'bg-white' : ''}`}
          title="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
