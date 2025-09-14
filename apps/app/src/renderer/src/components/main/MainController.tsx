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
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set())

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
      setOpenPanels(new Set())
    }
  }, [isScreenSharing])

  useEffect(() => {
    const handlePopoverClosed = (id: string) => {
      setOpenPanels((prev) => {
        const newPanels = new Set(prev)
        if (newPanels.has(id)) {
          newPanels.delete(id)
          return newPanels
        }
        return prev
      })
    }
    const unsubscribe = window.electronAPI.on('popover:was-closed', handlePopoverClosed)
    return () => {
      unsubscribe()
    }
  }, [])

  const handleTogglePanel = async (panelId: string) => {
    const currentPanels = new Set(openPanels)
    const isOpening = !currentPanels.has(panelId)
    const newPanels = new Set(currentPanels)

    const coexistingPanels = ['transcriptions', 'actions']
    const isCoexistingPanel = coexistingPanels.includes(panelId)

    // Apply exclusivity rules to determine the final set of panels
    if (isOpening) {
      if (isCoexistingPanel) {
        // If opening a coexisting panel, close any exclusive panels
        for (const id of currentPanels) {
          if (!coexistingPanels.includes(id)) {
            newPanels.delete(id)
            window.electronAPI.send('popover:close', id)
          }
        }
      } else {
        // Opening an exclusive panel, so close ALL other panels
        for (const id of currentPanels) {
          newPanels.delete(id)
          window.electronAPI.send('popover:close', id)
        }
      }
      newPanels.add(panelId) // Add the new panel
    } else {
      // isClosing
      newPanels.delete(panelId)
      window.electronAPI.send('popover:close', panelId)
    }

    // Get necessary info for layout calculation
    const parentBounds = await window.electronAPI.invoke('electronAPI:getMainWindowBounds')
    if (!parentBounds) return

    const panelConfigs = {
      transcriptions: { id: 'transcriptions', hash: 'transcriptions', width: 440, height: 340 },
      actions: { id: 'actions', hash: 'actions', width: 440, height: 340 },
      settings: {
        id: 'settings',
        hash: 'settings',
        width: isScreenSharing ? 440 : 360,
        height: 340
      },
      'screen-preview': {
        id: 'screen-preview',
        hash: 'screen-preview',
        width: 440,
        height: 340
      }
    }
    const gap = 8

    // Calculate target positions for all panels that WILL be open
    const targetPositions: { [key: string]: { x: number; y: number } } = {}
    const panelsToLayout = Array.from(newPanels)
    const openCoexisting = panelsToLayout.filter((p) => coexistingPanels.includes(p))

    if (openCoexisting.length === 2) {
      // Two panels: symmetrical layout
      const chatConfig = panelConfigs.transcriptions
      const actConfig = panelConfigs.actions
      const startX = parentBounds.x

      targetPositions['transcriptions'] = { x: startX, y: parentBounds.y - chatConfig.height - 8 }
      targetPositions['actions'] = {
        x: startX + chatConfig.width + gap,
        y: parentBounds.y - actConfig.height - 8
      }
    } else {
      // One or more panels, but all are centered
      for (const id of panelsToLayout) {
        const config = panelConfigs[id]
        targetPositions[id] = {
          x: parentBounds.x + Math.round((parentBounds.width - config.width) / 2),
          y: parentBounds.y - config.height - 8
        }
      }
    }

    // Execute IPC calls to create or reposition windows
    const panelsToReposition = panelsToLayout.filter((id) => currentPanels.has(id))
    for (const id of panelsToReposition) {
      const config = panelConfigs[id]
      const pos = targetPositions[id]
      await window.electronAPI.invoke('popover:resize', {
        id,
        ...pos,
        width: config.width,
        height: config.height
      })
    }

    const panelsToOpen = panelsToLayout.filter((id) => !currentPanels.has(id))
    for (const id of panelsToOpen) {
      const config = panelConfigs[id]
      const pos = targetPositions[id]
      await window.electronAPI.invoke('popover:create', { ...config, ...pos })
    }

    // Update React state
    setOpenPanels(newPanels)
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
        onTogglePanel={handleTogglePanel}
        openPanels={openPanels}
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
