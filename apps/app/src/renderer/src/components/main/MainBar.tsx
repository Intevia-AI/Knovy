'use client'
import { useEffect, useState } from 'react'

// Hooks
import { useElectron } from '@/hooks/useElectron'
import { useScreenShare } from '@/hooks/useScreenShare'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { useLanguage } from '@/context/LanguageContext'

// Components
import { HeaderBar } from './HeaderBar'
import RealTimeAnalysis from '../RealTimeAnalysis'

/**
 * This component is the controller for the main application window (the header bar).
 * It contains all the core logic and state management hooks.
 */
export function MainBar() {
  const { language } = useLanguage()
  const [activePopover, setActivePopover] = useState<string | null>(null)

  // Electron Interactions
  const { isAlwaysOnTop, toggleAlwaysOnTop, minimizeWindow, closeWindow } = useElectron()

  // Screen Sharing and Recording
  const { isScreenSharing, toggleScreenShare, currentSystemAudioStream, recordingDuration } =
    useScreenShare()

  // AI Interaction Logic
  const { customPrompt, handleTranscriptionResponse, handleTranscriptionKeywords } =
    useAIInteraction()

  useEffect(() => {
    const newWidth = isScreenSharing ? 440 : 360
    window.electronAPI.send('app:resize-window', { width: newWidth, height: 50 })

    // When screen sharing stops, close any popovers that should only be open during sharing
    if (!isScreenSharing) {
      if (activePopover === 'screen-preview' || activePopover === 'transcriptions') {
        window.electronAPI.send('popover:close', activePopover)
        setActivePopover(null)
      }
    }
  }, [isScreenSharing, activePopover])

  const handleTogglePopover = (popover: {
    id: string
    hash: string
    width: number
    height: number
  }) => {
    const { id, hash, width, height } = popover
    if (activePopover === id) {
      window.electronAPI.send('popover:close', id)
      setActivePopover(null)
    } else {
      if (activePopover) {
        window.electronAPI.send('popover:close', activePopover)
      }
      window.electronAPI.invoke('popover:create', { id, hash, width, height })
      setActivePopover(id)
    }
  }

  return (
    <div className="flex flex-col h-screen rounded-lg glass-popover">
      <HeaderBar
        isAlwaysOnTop={isAlwaysOnTop}
        toggleAlwaysOnTop={toggleAlwaysOnTop}
        minimizeWindow={minimizeWindow}
        closeWindow={closeWindow}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={toggleScreenShare}
        recordingDuration={recordingDuration}
        onToggleTranscriptionWindow={() =>
          handleTogglePopover({
            id: 'transcriptions',
            hash: 'transcriptions',
            width: 440,
            height: 300
          })
        }
        isTranscriptionWindowVisible={activePopover === 'transcriptions'}
        onToggleFeaturesWindow={() =>
          handleTogglePopover({ id: 'features', hash: 'features', width: 360, height: 200 })
        }
        isFeaturesWindowVisible={activePopover === 'features'}
        onToggleSettingsWindow={() =>
          handleTogglePopover({ id: 'settings', hash: 'settings', width: 360, height: 300 })
        }
        isSettingsWindowVisible={activePopover === 'settings'}
        onToggleScreenPreviewWindow={() =>
          handleTogglePopover({
            id: 'screen-preview',
            hash: 'screen-preview',
            width: 440,
            height: 300
          })
        }
        isScreenPreviewWindowVisible={activePopover === 'screen-preview'}
      />
      <RealTimeAnalysis
        isScreenSharing={isScreenSharing}
        systemAudioStream={currentSystemAudioStream}
        onTextResponse={handleTranscriptionResponse}
        onKeywords={handleTranscriptionKeywords}
        customPrompt={customPrompt}
        language={language}
      />
    </div>
  )
}
