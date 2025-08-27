import React from 'react'
import { Button } from '@/components/ui/button'
import {
  MicIcon,
  SettingsIcon,
  PinIcon,
  PinOffIcon,
  MinusIcon,
  XIcon,
  Rows,
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
}

export function HeaderBar({
  isAlwaysOnTop,
  toggleAlwaysOnTop,
  minimizeWindow,
  closeWindow,
  isScreenSharing,
  onToggleScreenShare
}: HeaderBarProps) {
  const { t } = useI18n()

  const handleTogglePopover = (id: string, hash: string, width: number, height: number) => {
    // This function now simply sends a request to the main process.
    // The main process is responsible for managing the popover's state and position.
    window.electronAPI.invoke('popover:create', { id, hash, width, height })
      .catch(console.error);
  }

  return (
    <header
      className="flex items-center justify-between p-1 bg-muted/10 rounded-full w-full h-full"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      {/* Left side controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 rounded-full'
          onClick={() => handleTogglePopover('screen-preview', 'screen-preview', 480, 300)}
          title='Screen Preview'
        >
          <MonitorIcon className='h-4 w-4' />
        </Button>
        <Button
          variant={isScreenSharing ? 'destructive' : 'default'}
          size='sm'
          onClick={onToggleScreenShare}
          className='h-8 rounded-full px-4 text-xs'
        >
          <MicIcon className='h-3 w-3 mr-1' />
          {isScreenSharing ? 'Stop' : 'Listen'}
        </Button>

        {isScreenSharing && (
          <Button
            variant='outline'
            size='icon'
            onClick={() => handleTogglePopover('transcriptions', 'transcriptions', 480, 300)}
            className='h-8 w-8 rounded-full'
            title='Show Transcriptions'
          >
            <MessageSquare className='h-4 w-4' />
          </Button>
        )}
      </div>

      {/* Right side controls */}
      <div className="flex items-center gap-1" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 rounded-full'
          onClick={() => handleTogglePopover('features', 'features', 200, 150)}
          title='Features'
        >
          <Rows className='h-4 w-4' />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 rounded-full'
          onClick={() => handleTogglePopover('settings', 'settings', 280, 300)}
          title='Settings'
        >
          <SettingsIcon className='h-4 w-4' />
        </Button>

        {/* Window Controls */}
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 rounded-full'
          onClick={toggleAlwaysOnTop}
          title={isAlwaysOnTop ? t('unpinWindowTooltip') : t('pinWindowTooltip')}
        >
          {isAlwaysOnTop ? <PinOffIcon size={14} /> : <PinIcon size={14} />}
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 rounded-full'
          onClick={minimizeWindow}
          title={t('minimizeWindowTooltip')}
        >
          <MinusIcon size={14} />
        </Button>
        <Button
          variant='ghost'
          size='icon'
          className='h-8 w-8 rounded-full hover:bg-destructive/80'
          onClick={closeWindow}
          title={t('closeWindowTooltip')}
        >
          <XIcon size={14} />
        </Button>
      </div>
    </header>
  )
}
