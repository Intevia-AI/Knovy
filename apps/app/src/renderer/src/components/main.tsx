'use client'
import { useEffect, useState } from 'react'
import path from 'path'
import { is } from '@electron-toolkit/utils'

// Hooks
import { useElectron } from '@/hooks/useElectron'
import { useScreenShare } from '@/hooks/useScreenShare'
import { useAIInteraction } from '@/hooks/useAIInteraction'
import { useLanguage } from '@/context/LanguageContext'

// Components
import { HeaderBar } from './main/HeaderBar'

import { useTheme } from 'next-themes'
import ChatPanel from './main/ChatPanel'
import { FeaturesPopup } from './main/FeaturesPopup'
import { SettingsPopup } from './main/SettingsPopup'
import { ScreenPreviewPopup } from './main/ScreenPreviewPopup.js'
import RealTimeAnalysis from './RealTimeAnalysis.js'

// =============================================================
export function Main() {
  // --- Hooks ----------------------------------------------------
  const { setTheme } = useTheme()
  const { language } = useLanguage()

  // Electron Interactions
  const {
    isAlwaysOnTop,
    toggleAlwaysOnTop,
    minimizeWindow,
    closeWindow
  } = useElectron()

  // Screen Sharing and Recording
  const { isScreenSharing, toggleScreenShare, screenStreamRef, currentSystemAudioStream } =
    useScreenShare()

  // AI Interaction Logic
  const {
    aiMessages,
    isLoading,
    customPrompt,
    setCustomPrompt,
    sendContextToAI,
    handleSendMessage,
    messagesContainerRef,
    isSubtitleVisible,
    handleTranscriptionResponse,
    handleTranscriptionKeywords
  } = useAIInteraction()

  const [isTranscriptionWindowVisible, setIsTranscriptionWindowVisible] = useState(false)

  // --- Effects ------------------------------------------------
  useEffect(() => {
    setTheme('dark')

    // Listen for custom prompt messages from popovers
    const unsubscribe = window.electronAPI.on(
      'ai:custom-prompt',
      ({ action, prompt }) => {
        console.log('[Main] Received custom prompt from popover:', prompt)
        handleSendMessage(action, prompt)
      }
    )

    // Cleanup listener on unmount
    return () => {
      unsubscribe()
    }
  }, [handleSendMessage])

  const handleToggleTranscriptionWindow = () => {
    if (isTranscriptionWindowVisible) {
      window.electronAPI.send('popover:close', 'transcriptions')
    } else {
      window.electronAPI.invoke('popover:create', {
        id: 'transcriptions',
        hash: 'transcriptions',
        width: 480,
        height: 300
      })
    }
    setIsTranscriptionWindowVisible(!isTranscriptionWindowVisible)
  }

  const handleShowHistory = () => {
    window.electronAPI.send('history:open')
  }

  // This logic determines what to render based on the URL hash
  const [view, setView] = useState('main')

  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash
      if (hash === '#transcriptions') {
        setView('transcriptions')
      } else if (hash === '#features') {
        setView('features')
      } else if (hash === '#settings') {
        setView('settings')
      } else if (hash === '#screen-preview') {
        setView('screen-preview')
      } else {
        setView('main')
      }
    }

    window.addEventListener('hashchange', handleHashChange)
    handleHashChange() // Initial check

    return () => {
      window.removeEventListener('hashchange', handleHashChange)
    }
  }, [])

  // --- Render Views -------------------------------------------------
  if (view === 'transcriptions') {
    return (
      <div className="flex flex-col h-screen rounded-lg bg-transparent pt-6">
        <ChatPanel
          messages={aiMessages}
          isLoading={isLoading}
          isScreenSharing={isScreenSharing}
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt}
          onSendMessage={handleSendMessage}
          messagesContainerRef={messagesContainerRef}
          isSubtitleVisible={isSubtitleVisible}
        />
      </div>
    )
  }

  if (view === 'features') {
    return (
      <FeaturesPopup
        onAiAction={sendContextToAI}
        isScreenSharing={isScreenSharing}
        onShowHistory={handleShowHistory}
      />
    )
  }

  if (view === 'settings') {
    return (
      <SettingsPopup
        customPrompt={customPrompt}
        setCustomPrompt={setCustomPrompt}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={toggleScreenShare}
      />
    )
  }

  if (view === 'screen-preview') {
    return (
      <div className="flex flex-col h-screen rounded-lg bg-transparent">
        <HeaderBar
          isAlwaysOnTop={isAlwaysOnTop}
          toggleAlwaysOnTop={toggleAlwaysOnTop}
          minimizeWindow={minimizeWindow}
          closeWindow={closeWindow}
          isScreenSharing={isScreenSharing}
          onToggleScreenShare={toggleScreenShare}
          onToggleTranscriptionWindow={handleToggleTranscriptionWindow}
          isTranscriptionWindowVisible={isTranscriptionWindowVisible}
        />
        <ScreenPreviewPopup isScreenSharing={isScreenSharing} screenStreamRef={screenStreamRef} />
      </div>
    )
  }

  // --- Render Main Bar -------------------------------------------------
  return (
    <div className="flex flex-col h-screen rounded-lg bg-transparent">
      <HeaderBar
        isAlwaysOnTop={isAlwaysOnTop}
        toggleAlwaysOnTop={toggleAlwaysOnTop}
        minimizeWindow={minimizeWindow}
        closeWindow={closeWindow}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={toggleScreenShare}
        onToggleTranscriptionWindow={handleToggleTranscriptionWindow}
        isTranscriptionWindowVisible={isTranscriptionWindowVisible}
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
