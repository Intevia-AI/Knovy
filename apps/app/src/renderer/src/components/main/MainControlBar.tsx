import React from 'react'
import { Button } from '@/components/ui/button'
import { MicIcon, SettingsIcon, LayoutGrid, MonitorIcon, MessageSquare } from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { formatTime } from '@/lib/utils'

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
  isTranscriptionWindowVisible: boolean
  onToggleFeaturesWindow: () => void
  isFeaturesWindowVisible: boolean
  onToggleSettingsWindow: () => void
  isSettingsWindowVisible: boolean
  onToggleScreenPreviewWindow: () => void
  isScreenPreviewWindowVisible: boolean
}

export function MainControlBar({
  isScreenSharing,
  onToggleScreenShare,
  recordingDuration,
  // Destructure new props
  onToggleTranscriptionWindow,
  isTranscriptionWindowVisible,
  onToggleFeaturesWindow,
  isFeaturesWindowVisible,
  onToggleSettingsWindow,
  isSettingsWindowVisible,
  onToggleScreenPreviewWindow,
  isScreenPreviewWindowVisible
}: MainControlBarProps) {
  const { t } = useI18n()

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
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${isScreenPreviewWindowVisible ? 'bg-white' : ''}`}
              title="Screen Preview"
            >
              <MonitorIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleTranscriptionWindow}
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${isTranscriptionWindowVisible ? 'bg-white' : ''}`}
              title="Show Transcriptions"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleFeaturesWindow}
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${isFeaturesWindowVisible ? 'bg-white' : ''}`}
              title="actions"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
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
