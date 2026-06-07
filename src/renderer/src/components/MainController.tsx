'use client'
import { useEffect, useState, useCallback, useRef } from 'react'

// Hooks
import { useElectron } from '@/hooks/useElectron'
import { useScreenShare } from '@/hooks/useScreenShare'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { useLanguage } from '@/hooks/useLanguage'

// Components
import { MainControlBar } from './MainControlBar'
import RealTimeAnalysis from './RealTimeAnalysis'
import { useOllamaModelState } from '@/hooks/useOllamaModelState'
import { decideRecordAction } from '@/lib/recordGate'

export function MainController() {
  const { language } = useLanguage()
  const [openPanels, setOpenPanels] = useState<Set<string>>(new Set())
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)

  // Electron Interactions
  const { isAlwaysOnTop, toggleAlwaysOnTop, minimizeWindow, closeWindow } = useElectron()

  // Screen Sharing and Recording
  const {
    isScreenSharing,
    toggleScreenShare,
    restartScreenShare,
    currentSystemAudioStream,
    recordingDuration
  } = useScreenShare()

  // AI Interaction Logic
  const { customPrompt, handleTranscriptionResponse, sendContextToAI, isSummarizing } =
    useAIInteraction()

  const ollama = useOllamaModelState()
  const gateOpenRef = useRef(false)

  useEffect(() => {
    const newWidth = isScreenSharing ? 440 : 360
    // Always pin the bar height. The transparent frameless window can momentarily
    // auto-grow when the control bar re-renders on toggle; sending an explicit
    // height keeps the resize handler authoritative instead of preserving the drift.
    window.electronAPI.send('app:resize-window', { width: newWidth, height: 50 })

    if (!isScreenSharing) {
      // Close all popovers when screen sharing stops
      window.electronAPI.send('popover:close-all')
      setOpenPanels(new Set())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  // Track settings window state
  useEffect(() => {
    const handleSettingsClosed = () => {
      setIsSettingsOpen(false)
    }
    const unsubscribe = window.electronAPI.on('settings:closed', handleSettingsClosed)
    return () => {
      unsubscribe()
    }
  }, [])

  const handleTogglePanel = useCallback(
    async (panelId: string, options?: { ensureOpen?: boolean }) => {
      // Handle settings separately - toggle window instead of popover
      if (panelId === 'settings') {
        if (isSettingsOpen) {
          // Close if already open
          window.electronAPI.send('settings:close')
          setIsSettingsOpen(false)
        } else {
          // Open if closed
          await window.electronAPI.invoke('settings:open')
          setIsSettingsOpen(true)
        }
        return
      }

      const currentPanels = new Set(openPanels)
      const isOpening = options?.ensureOpen ? true : !currentPanels.has(panelId)
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
            if (id !== panelId) {
              newPanels.delete(id)
              window.electronAPI.send('popover:close', id)
            }
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
        'screen-preview': {
          id: 'screen-preview',
          hash: 'screen-preview',
          width: 440,
          height: 340
        },
        updater: {
          id: 'updater',
          hash: 'updater',
          width: isScreenSharing ? 440 : 360,
          height: 50
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
    },
    [isScreenSharing, openPanels, isSettingsOpen]
  )

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('updater:update-downloaded', () => {
      console.log('Update downloaded, creating updater panel.')
      handleTogglePanel('updater', { ensureOpen: true })
    })
    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [handleTogglePanel])

  useEffect(() => {
    const handleKeywordSearch = (keyword: string) => {
      console.log(
        `[MainController] Received 'keyword:search' event for "${keyword}". Ensuring actions panel is open.`
      )
      handleTogglePanel('actions', { ensureOpen: true })
    }
    const unsubscribeKeyword = window.electronAPI.on('keyword:search', handleKeywordSearch)

    // Auto-open ActionsPanel when a new action is triggered
    const handleActionTriggered = (action: any) => {
      console.log(
        `[MainController] Action triggered: ${action.actionType}. Ensuring actions panel is open.`
      )
      handleTogglePanel('actions', { ensureOpen: true })
    }
    const unsubscribeActionTriggered =
      window.electronAPI.autoTrigger.onActionTriggered(handleActionTriggered)

    const handleSourceChanged = () => restartScreenShare()
    const unsubscribeSourceChanged = window.electronAPI.on(
      'screenshare:source-changed',
      handleSourceChanged
    )

    return () => {
      unsubscribeKeyword()
      unsubscribeActionTriggered()
      unsubscribeSourceChanged()
    }
  }, [handleTogglePanel, restartScreenShare])

  const startRecordingNow = useCallback(async () => {
    await toggleScreenShare()
  }, [toggleScreenShare])

  const openGatePopover = useCallback(async () => {
    if (gateOpenRef.current) return
    const bounds = await window.electronAPI.invoke('electronAPI:getMainWindowBounds')
    if (!bounds) return
    const width = 360
    const height = 220
    const x = bounds.x + Math.round((bounds.width - width) / 2)
    const y = bounds.y - height - 8
    gateOpenRef.current = true
    await window.electronAPI.invoke('popover:create', {
      id: 'model-gate',
      hash: 'model-gate',
      width,
      height,
      x,
      y
    })
  }, [])

  useEffect(() => {
    const unsubStart = window.electronAPI.on('model-gate:start-recording', () => {
      startRecordingNow()
    })
    const unsubClosed = window.electronAPI.on('popover:was-closed', (id: string) => {
      if (id === 'model-gate') gateOpenRef.current = false
    })
    return () => {
      unsubStart()
      unsubClosed()
    }
  }, [startRecordingNow])

  const handleToggleScreenShare = useCallback(async () => {
    if (isSummarizing) return

    if (isScreenSharing) {
      window.electronAPI.send('app:graceful-stop-and-execute', { postAction: 'stop' })
      return
    }

    // Starting: consult the gate against a freshly refreshed model-state AND
    // a freshly read aiCorrection setting. The setting can be toggled in the
    // separate Settings window, so the hook's cached value may be stale here.
    await ollama.refreshState()
    const s = await window.electronAPI.invoke('ollama:get-model-state')
    const ai = await window.electronAPI.invoke('ollama:get-ai-correction')
    const action = decideRecordAction({
      aiCorrection: ai?.mode === 'off' ? 'off' : 'on',
      phase: s?.phase ?? 'idle',
      reachable: s?.reachable ?? false
    })

    switch (action.type) {
      case 'start-enhanced':
      case 'start-raw':
        await startRecordingNow()
        break
      case 'prompt-no-model':
      case 'prompt-downloading':
      case 'prompt-error':
        await openGatePopover()
        break
    }
  }, [
    isSummarizing,
    isScreenSharing,
    ollama,
    toggleScreenShare,
    startRecordingNow,
    openGatePopover
  ])

  useEffect(() => {
    const handleGracefulStop = async ({ postAction }: { postAction: string }) => {
      if (isScreenSharing && !isSummarizing) {
        await sendContextToAI('summary')
        await toggleScreenShare() // Stop

        switch (postAction) {
          case 'restart':
            toggleScreenShare() // Start again
            break
          case 'quit':
            window.electronAPI.send('app:quit')
            break
          case 'stop':
            // The session is now stopped. Do nothing further.
            break
        }
      }
    }

    const unsubscribe = window.electronAPI.on('app:execute-graceful-stop', handleGracefulStop)
    return () => {
      unsubscribe()
    }
  }, [isScreenSharing, isSummarizing, sendContextToAI, toggleScreenShare])

  // Keyboard shortcut handlers
  useEffect(() => {
    const handleToggleRecording = () => {
      console.log('[MainController] Shortcut: Toggle recording')
      handleToggleScreenShare()
    }

    const handleTogglePreviewPanel = () => {
      console.log('[MainController] Shortcut: Toggle preview panel')
      if (isScreenSharing) {
        handleTogglePanel('screen-preview')
      }
    }

    const handleToggleChatPanel = () => {
      console.log('[MainController] Shortcut: Toggle chat panel')
      if (isScreenSharing) {
        handleTogglePanel('transcriptions')
      }
    }

    const handleToggleActionsPanel = () => {
      console.log('[MainController] Shortcut: Toggle actions panel')
      if (isScreenSharing) {
        handleTogglePanel('actions')
      }
    }

    const handleAIActionRecommendResponse = async () => {
      console.log('[MainController] Shortcut: AI action - recommend response')
      if (isScreenSharing) {
        // Check if actions panel is already open
        const isPanelOpen = openPanels.has('actions')

        if (!isPanelOpen) {
          // Panel is not open, open it first
          await handleTogglePanel('actions', { ensureOpen: true })
          // Give the panel time to mount before triggering action
          setTimeout(() => {
            window.electronAPI.send('ai-action:trigger-recommend-response')
          }, 150)
        } else {
          // Panel is already open, trigger immediately
          window.electronAPI.send('ai-action:trigger-recommend-response')
        }
      }
    }

    const handleAIActionScreenshotAnalysis = async () => {
      console.log('[MainController] Shortcut: AI action - screenshot analysis')
      if (isScreenSharing) {
        // Check if actions panel is already open
        const isPanelOpen = openPanels.has('actions')

        if (!isPanelOpen) {
          // Panel is not open, open it first then take screenshot
          await handleTogglePanel('actions', { ensureOpen: true })
          // Give the panel time to mount before taking screenshot
          setTimeout(() => {
            window.electronAPI.send('electronAPI:startScreenshot')
          }, 150)
        } else {
          // Panel is already open, trigger screenshot immediately
          window.electronAPI.send('electronAPI:startScreenshot')
        }
      }
    }

    const unsubscribeToggleRecording = window.electronAPI.on(
      'shortcut:toggle-recording',
      handleToggleRecording
    )
    const unsubscribeTogglePreview = window.electronAPI.on(
      'shortcut:toggle-preview-panel',
      handleTogglePreviewPanel
    )
    const unsubscribeToggleChat = window.electronAPI.on(
      'shortcut:toggle-chat-panel',
      handleToggleChatPanel
    )
    const unsubscribeToggleActions = window.electronAPI.on(
      'shortcut:toggle-actions-panel',
      handleToggleActionsPanel
    )
    const unsubscribeAIRecommend = window.electronAPI.on(
      'shortcut:ai-action-recommend-response',
      handleAIActionRecommendResponse
    )
    const unsubscribeAIScreenshot = window.electronAPI.on(
      'shortcut:ai-action-screenshot-analysis',
      handleAIActionScreenshotAnalysis
    )

    return () => {
      unsubscribeToggleRecording()
      unsubscribeTogglePreview()
      unsubscribeToggleChat()
      unsubscribeToggleActions()
      unsubscribeAIRecommend()
      unsubscribeAIScreenshot()
    }
  }, [isScreenSharing, openPanels, handleTogglePanel, handleToggleScreenShare])

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
        isSettingsOpen={isSettingsOpen}
        preparingProgress={
          ollama.state.phase === 'downloading' || ollama.state.phase === 'verifying'
            ? ollama.state.progress
            : null
        }
      />
      <RealTimeAnalysis
        isScreenSharing={isScreenSharing}
        systemAudioStream={currentSystemAudioStream}
        onTextResponse={handleTranscriptionResponse}
        customPrompt={customPrompt}
        language={language}
      />
    </div>
  )
}
