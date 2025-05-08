"use client";
import { useEffect, useState } from "react";

// Hooks
import { useElectron } from "@/hooks/useElectron";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useAudioAnalysis } from "@/hooks/useAudioAnalysis";
import { useAIInteraction } from "@/hooks/useAIInteraction";

// Components
import { HeaderBar } from "./main/HeaderBar";
import { SourcePickerModal } from "./main/SourcePickerModal";
import ChatPanel from "./main/ChatPanel";
import { ControlPanel } from "./main/ControlPanel";
import { useTheme } from "next-themes";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@workspace/ui/components/resizable"; // Import Resizable components

// Types (Import necessary types)

// =============================================================
export function Main() {
  // --- Hooks ----------------------------------------------------
  const { setTheme } = useTheme();
  const [language, setLanguage] = useState("zh-TW");

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
    screenStreamRef,
  } = useScreenShare();

  // Audio Analysis (Visualizers)
  const { micAnalyserNode, systemAnalyserNode, micLevel, systemLevel } =
    useAudioAnalysis(
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
    handleTranscriptionResponse,
    handleTranscriptionKeywords,
    handleAnswerResponse,
    handleAnswerKeywords,
    handleKeywordClick,
    messagesContainerRef,
    resetChat,
    handleSendMessage,
    setSubtitleVisibility,
  } = useAIInteraction();

  // --- Effects ------------------------------------------------

  // Reset AI state when starting a new screen share session
  useEffect(() => {
    if (isScreenSharing) {
      resetChat();
      // Mic recorder state is reset within useScreenShare's startScreenShare
    }
  }, [isScreenSharing, resetChat]);

  useEffect(() => {
    setTheme("dark");
  }, []);

  // --- Render -------------------------------------------------
  return (
    // Added padding-top to account for fixed header height (h-6 = pt-6)
    <div className="flex flex-col h-screen rounded-lg bg-transparent pt-6">
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

      {/* Main Content Area using ResizablePanelGroup */}
      <ResizablePanelGroup
        direction="vertical"
        className="flex flex-1 overflow-hidden shadow-lg rounded-b-lg" // Added border and rounded-b-lg
      >
        {/* Control Panel (Sidebar) - Moved to the left */}
        <ResizablePanel defaultSize={25} minSize={20} className="border-none">
          <ControlPanel
            isScreenSharing={isScreenSharing}
            isLoading={isLoading}
            recordingDuration={recordingDuration}
            keywords={keywords}
            selectedKeyword={selectedKeyword}
            micAnalyserNode={micAnalyserNode}
            systemAnalyserNode={systemAnalyserNode}
            micLevel={micLevel}
            systemLevel={systemLevel}
            screenStreamRef={screenStreamRef}
            currentSystemAudioStream={currentSystemAudioStream}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            language={language}
            setLanguage={setLanguage}
            onToggleScreenShare={toggleScreenShare}
            onAiAction={sendContextToAI}
            onKeywordClick={handleKeywordClick}
            onTranscriptionResponse={handleTranscriptionResponse}
            onTranscriptionKeywords={handleTranscriptionKeywords}
            onAnswerResponse={handleAnswerResponse}
            onAnswerKeywords={handleAnswerKeywords}
            setSubtitleVisibility={setSubtitleVisibility}
          />
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-border/70"/>

        {/* Chat Panel - Moved to the right */}
        <ResizablePanel defaultSize={80} minSize={20} className="border-none">
          <ChatPanel
            messages={aiMessages}
            isLoading={isLoading}
            isScreenSharing={isScreenSharing}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            onSendMessage={handleSendMessage}
            messagesContainerRef={messagesContainerRef}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
