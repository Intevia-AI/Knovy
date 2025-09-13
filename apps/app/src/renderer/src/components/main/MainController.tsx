'use client'
import { useEffect, useState } from 'react'

// Hooks
import { useElectron } from '@/hooks/useElectron'
import { useScreenShare } from '@/hooks/useScreenShare'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { useLanguage } from '@/context/LanguageContext'

// Components
import { MainControlBar } from './MainControlBar'
import RealTimeAnalysis from '../RealTimeAnalysis'

export function MainController() {
  const { language } = useLanguage()
  const [activePopover, setActivePopover] = useState<string | null>(null)

  // Electron Interactions
  const { isAlwaysOnTop, toggleAlwaysOnTop, minimizeWindow, closeWindow } = useElectron()

  // Screen Sharing and Recording
  const { isScreenSharing, toggleScreenShare, currentSystemAudioStream, recordingDuration } =
    useScreenShare()

  // AI Interaction Logic
  const {
    customPrompt,
    handleTranscriptionResponse,
    handleTranscriptionKeywords,
    sendContextToAI,
    isSummarizing
  } = useAIInteraction()

  useEffect(() => {
    const newWidth = isScreenSharing ? 440 : 360
    window.electronAPI.send('app:resize-window', { width: newWidth, height: 50 })

    if (!isScreenSharing) {
      // Close all popovers when screen sharing stops
      window.electronAPI.send('popover:close-all')
      setActivePopover(null)
    }
  }, [isScreenSharing])

  // This effect handles resizing the settings popover.
  useEffect(() => {
    if (activePopover === 'settings') {
      const newWidth = isScreenSharing ? 440 : 360
      window.electronAPI.send('popover:resize', {
        id: 'settings',
        width: newWidth,
        height: 340
      })
    }
  }, [isScreenSharing, activePopover])

  useEffect(() => {
    const handlePopoverClosed = (id: string) => {
      if (activePopover === id) {
        setActivePopover(null)
      }
    }
    const unsubscribe = window.electronAPI.on('popover:was-closed', handlePopoverClosed)
    return () => {
      unsubscribe()
    }
  }, [activePopover])

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

  const handleToggleScreenShare = async () => {
    if (isSummarizing) return // Prevent action while summarizing

    if (isScreenSharing) {
      // Stopping screen share: first summarize, then stop.
      await sendContextToAI('summary')
      toggleScreenShare()
    } else {
      // Starting screen share
      toggleScreenShare()
    }
  }

  return (
    <div className="flex flex-col h-screen rounded-lg glass-popover">
      <MainControlBar
        isAlwaysOnTop={isAlwaysOnTop}
        toggleAlwaysOnTop={toggleAlwaysOnTop}
        minimizeWindow={minimizeWindow}
        closeWindow={closeWindow}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={handleToggleScreenShare}
        isSummarizing={isSummarizing}
        recordingDuration={recordingDuration}
        onToggleTranscriptionWindow={() =>
          handleTogglePopover({
            id: 'transcriptions',
            hash: 'transcriptions',
            width: 440,
            height: 340
          })
        }
        isChatPanelVisible={activePopover === 'transcriptions'}
        onToggleFeaturesWindow={() =>
          handleTogglePopover({ id: 'actions', hash: 'actions', width: 440, height: 340 })
        }
        isActionPanelVisible={activePopover === 'actions'}
        onToggleSettingsWindow={() =>
          handleTogglePopover({
            id: 'settings',
            hash: 'settings',
            width: isScreenSharing ? 440 : 360,
            height: 340
          })
        }
        isSettingsWindowVisible={activePopover === 'settings'}
        onToggleScreenPreviewWindow={() =>
          handleTogglePopover({
            id: 'screen-preview',
            hash: 'screen-preview',
            width: 440,
            height: 340
          })
        }
        isScreenPreviewVisible={activePopover === 'screen-preview'}
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
