import React from 'react'
import { Button } from '@/components/ui/button'
import {
  MicIcon,
  MicOffIcon,
  SettingsIcon,
  LayoutGrid,
  MonitorIcon,
  MessageSquare,
  Loader2
} from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'
import { formatTime } from '@/lib/utils'

interface MainControlBarProps {
  isAlwaysOnTop: boolean
  toggleAlwaysOnTop: () => void
  minimizeWindow: () => void
  closeWindow: () => void
  isScreenSharing: boolean
  onToggleScreenShare: () => void
  isSummarizing: boolean
  recordingDuration: number
  onTogglePanel: (panelId: string) => void
  openPanels: Set<string>
  isSettingsOpen: boolean
  preparingProgress?: number | null
  micEnabled: boolean
  onToggleMic: () => void
}

export function MainControlBar({
  isScreenSharing,
  onToggleScreenShare,
  isSummarizing,
  recordingDuration,
  onTogglePanel,
  openPanels,
  isSettingsOpen,
  preparingProgress,
  micEnabled,
  onToggleMic
}: MainControlBarProps) {
  const { t } = useI18n()
  const canShowActions = true

  return (
    <header
      className="flex items-center justify-between p-1 bg-transparent rounded-full w-full h-full px-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side controls */}
      <div
        className="flex items-center gap-2"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <Button
          variant={'ghost'}
          size="sm"
          onClick={onToggleScreenShare}
          disabled={isSummarizing || preparingProgress != null}
          title={
            preparingProgress != null ? `${t('preparingModel')} ${preparingProgress}%` : undefined
          }
          className={`h-8 rounded-full shadow text-sm w-28 ${
            isScreenSharing
              ? 'bg-destructive/80 text-white breathing-light'
              : 'bg-muted text-black hover:bg-destructive/80 hover:text-white'
          } `}
        >
          {isSummarizing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {'Stopping'}
            </>
          ) : preparingProgress != null ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {`${preparingProgress}%`}
            </>
          ) : (
            <>
              <MicIcon className="h-8 w-8" />
              {isScreenSharing ? formatTime(recordingDuration) : 'Listen'}
            </>
          )}
        </Button>
        {isScreenSharing && (
          <>
            <Button
              variant="ghost"
              size="icon"
              onClick={onToggleMic}
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${
                micEnabled ? '' : 'bg-destructive/80 text-white hover:text-black'
              }`}
              title={micEnabled ? t('muteMicrophone') : t('unmuteMicrophone')}
              aria-pressed={!micEnabled}
            >
              {micEnabled ? (
                <MicIcon className="h-4 w-4" />
              ) : (
                <MicOffIcon className="h-4 w-4" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTogglePanel('screen-preview')}
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${openPanels.has('screen-preview') ? 'bg-white' : ''}`}
              title="Screen Preview"
            >
              <MonitorIcon className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onTogglePanel('transcriptions')}
              className={`h-8 w-8 rounded-full shadow hover:bg-white ${openPanels.has('transcriptions') ? 'bg-white' : ''}`}
              title="Show Transcriptions"
            >
              <MessageSquare className="h-4 w-4" />
            </Button>
            {canShowActions && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onTogglePanel('actions')}
                className={`h-8 w-8 rounded-full shadow hover:bg-white ${openPanels.has('actions') ? 'bg-white' : ''}`}
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
          onClick={() => onTogglePanel('settings')}
          className={`h-8 w-8 rounded-full shadow hover:bg-white ${isSettingsOpen ? 'bg-white' : ''}`}
          title="Settings"
        >
          <SettingsIcon className="h-4 w-4" />
        </Button>
      </div>
    </header>
  )
}
