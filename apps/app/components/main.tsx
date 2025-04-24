"use client";
import { useEffect } from "react";
import type { Message } from 'ai'; // Import Message type

// Hooks
import { useElectron } from "@/hooks/useElectron";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useAudioAnalysis } from "@/hooks/useAudioAnalysis";
import { useAIInteraction } from "@/hooks/useAIInteraction";

// Components
import { HeaderBar } from "./main/HeaderBar";
import { SourcePickerModal } from "./main/SourcePickerModal";
import { ChatPanel } from "./main/ChatPanel";
import { ControlPanel } from "./main/ControlPanel";

// Types (Import necessary types)
import type { Segment, ElectronSource } from '@/types';

// =============================================================
export function Main() {
  // --- Hooks ----------------------------------------------------

  // Electron Interactions
  const {
    isAlwaysOnTop,
    toggleAlwaysOnTop,
    minimizeWindow,
    closeWindow,
    availableSources,
    showSourcePicker,
    handleSourceSelect,
    handleCancelSelect,
  } = useElectron();

  // Screen Sharing and Recording
  const {
    isScreenSharing,
    recordingDuration,
    micStream, // Needed for mic analysis
    currentSystemAudioStream, // Needed for system analysis & RealTimeAnalysis component
    micSegments, // Needed for AI context
    systemAudioSegments, // Needed for AI context
    micMimeType, // Needed for AI context
    systemAudioMimeType, // Needed for AI context
    toggleScreenShare,
    screenPreviewRef, // Ref for video element in ControlPanel
    currentMicChunksRef, // <<< Get this ref
    systemAudioChunksRef, // <<< Get this ref
  } = useScreenShare();

  // Audio Analysis (Visualizers)
  const { micAnalyserNode, systemAnalyserNode, micLevel, systemLevel } = useAudioAnalysis(
    isScreenSharing ? micStream : null, // Pass stream only when sharing
    isScreenSharing ? currentSystemAudioStream : null // Pass stream only when sharing
  );

  // AI Interaction Logic
  const {
    aiMessages,
    isLoading,
    customPrompt,
    setCustomPrompt,
    keywords,
    selectedKeyword,
    sendContextToAI,
    handleTextResponse, // Pass to ControlPanel -> RealTimeAnalysis
    handleKeywords,     // Pass to ControlPanel -> RealTimeAnalysis
    handleKeywordClick, // Pass to ControlPanel
    messagesContainerRef, // Pass to ChatPanel
    resetChat, // To reset AI state on starting share
  } = useAIInteraction({
    micSegments,
    systemAudioSegments,
    currentMicChunksRef, // <<< Pass this ref
    systemAudioChunksRef, // <<< Pass this ref
    micMimeType,
    systemAudioMimeType,
    isScreenSharing,
  });

  // --- Effects ------------------------------------------------

  // Reset AI state when starting a new screen share session
  useEffect(() => {
    if (isScreenSharing) {
      resetChat();
      // Mic recorder state is reset within useScreenShare's startScreenShare
    }
  }, [isScreenSharing, resetChat]);


  // --- Render -------------------------------------------------
  return (
    // Added padding-top to account for fixed header height (h-6 = pt-6)
    <div className="flex flex-col h-screen rounded-lg bg-background pt-6">
      {/* Fixed Header */}
      <HeaderBar
        isAlwaysOnTop={isAlwaysOnTop}
        toggleAlwaysOnTop={toggleAlwaysOnTop}
        minimizeWindow={minimizeWindow}
        closeWindow={closeWindow}
      />

      {/* Source Picker Modal */}
      <SourcePickerModal
        show={showSourcePicker}
        sources={availableSources}
        onSelect={handleSourceSelect}
        onCancel={handleCancelSelect}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden shadow-lg">
        {/* Chat Panel */}
        <ChatPanel
          messages={aiMessages}
          isLoading={isLoading}
          isScreenSharing={isScreenSharing}
          customPrompt={customPrompt}
          setCustomPrompt={setCustomPrompt}
          onSendMessage={sendContextToAI} // Pass the AI function
          messagesContainerRef={messagesContainerRef}
        />

        {/* Control Panel (Sidebar) */}
        <ControlPanel
          isScreenSharing={isScreenSharing}
          isLoading={isLoading}
          recordingDuration={recordingDuration}
          keywords={keywords}
          selectedKeyword={selectedKeyword}
          micAnalyserNode={micAnalyserNode}
          systemAnalyserNode={systemAnalyserNode}
          micLevel={micLevel} // <<< Pass micLevel
          systemLevel={systemLevel} // <<< Pass systemLevel
          screenPreviewRef={screenPreviewRef}
          currentSystemAudioStream={currentSystemAudioStream} // Pass for RealTimeAnalysis
          onToggleScreenShare={toggleScreenShare}
          onAiAction={sendContextToAI} // Pass the AI function
          onKeywordClick={handleKeywordClick}
          onTextResponse={handleTextResponse} // Pass down for RealTimeAnalysis
          onKeywords={handleKeywords}         // Pass down for RealTimeAnalysis
        />
      </div>
    </div>
  );
}
