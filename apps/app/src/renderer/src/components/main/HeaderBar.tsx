import React from 'react'
import { Button } from '@/components/ui/button'
import {
  MicIcon,
  SettingsIcon,
  PinIcon,
  PinOffIcon,
  MinusIcon,
  XIcon,
  LayoutGrid,
  MonitorIcon,
  MessageSquare
} from 'lucide-react'
import { useI18n } from '@/hooks/useI18n'

interface HeaderBarProps {
  isAlwaysOnTop: boolean
  toggleAlwaysOnTop: () => void
  minimizeWindow: () => void
  closeWindow: () => void
  isScreenSharing: boolean
  onToggleScreenShare: () => void
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

export function HeaderBar({
  isAlwaysOnTop,
  toggleAlwaysOnTop,
  minimizeWindow,
  closeWindow,
  isScreenSharing,
  onToggleScreenShare,
  // Destructure new props
  onToggleTranscriptionWindow,
  isTranscriptionWindowVisible,
  onToggleFeaturesWindow,
  isFeaturesWindowVisible,
  onToggleSettingsWindow,
  isSettingsWindowVisible,
  onToggleScreenPreviewWindow,
  isScreenPreviewWindowVisible
}: HeaderBarProps) {
  const { t } = useI18n()

  return (
    <header
      className="flex items-center justify-between p-1 bg-muted/10 rounded-full w-full h-full px-2"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        {isScreenSharing && (
          <Button
            variant={isScreenPreviewWindowVisible ? 'default' : 'ghost'} // Highlight if open
            size='icon'
            className='h-7 w-7 rounded-full'
            onClick={onToggleScreenPreviewWindow} // Use new toggle function
            title='Screen Preview'
          >
            <MonitorIcon className='h-4 w-4' />
          </Button>
        )}
        <Button
          variant={isScreenSharing ? 'destructive' : 'default'}
          size='sm'
          onClick={onToggleScreenShare}
          className='h-7 rounded-full text-xs'
        >
          <MicIcon className='h-5 w-5' />
          {isScreenSharing ? 'Stop' : 'Listen'}
        </Button>

        {isScreenSharing && (
          <Button
            variant={isTranscriptionWindowVisible ? 'default' : 'default'} // Highlight if open
            size='icon'
            onClick={onToggleTranscriptionWindow} // Use new toggle function
            className='h-7 w-7 rounded-full'
            title='Show Transcriptions'
          >
            <MessageSquare className='h-4 w-4' />
          </Button>
        )}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button
          variant={isFeaturesWindowVisible ? 'default' : 'ghost'} // Highlight if open
          size='icon'
          className='h-7 w-7 rounded-full'
          onClick={onToggleFeaturesWindow} // Use new toggle function
          title='Features'
        >
          <LayoutGrid className='h-4 w-4' />
        </Button>
        <Button
          variant={isSettingsWindowVisible ? 'default' : 'ghost'} // Highlight if open
          size='icon'
          className='h-7 w-7 rounded-full'
          onClick={onToggleSettingsWindow} // Use new toggle function
          title='Settings'
        >
          <SettingsIcon className='h-4 w-4' />
        </Button>

        {/* Window Controls */}
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7 rounded-full'
          onClick={toggleAlwaysOnTop}
          title={isAlwaysOnTop ? t('unpinWindowTooltip') : t('pinWindowTooltip')}
        >
          {isAlwaysOnTop ? <PinOffIcon size={14} /> : <PinIcon size={14} />}
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7 rounded-full'
          onClick={minimizeWindow}
          title={t('minimizeWindowTooltip')}
        >
          <MinusIcon size={14} />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-7 w-7 rounded-full hover:bg-destructive/80'
          onClick={closeWindow}
          title={t('closeWindowTooltip')}
        >
          <XIcon size={14} />
        </Button>
      </div>
    </header>
  )
}
