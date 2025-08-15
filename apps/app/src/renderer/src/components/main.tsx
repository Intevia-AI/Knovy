"use client";
import { useEffect, useState } from "react";

// Hooks
import { useElectron } from "@/hooks/useElectron";
import { useScreenShare } from "@/hooks/useScreenShare";
import { useAudioAnalysis } from "@/hooks/useAudioAnalysis";
import { useAIInteraction } from "@/hooks/useAIInteraction";
import { useLanguage } from "@/context/LanguageContext";

// Components
import { HeaderBar } from "./main/HeaderBar.js";
import { SourcePickerModal } from "./main/SourcePickerModal.js";
import ChatPanel from "./main/ChatPanel.js";
import { ControlPanel } from "./main/ControlPanel.js";
import { useTheme } from "next-themes";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable"; // Import Resizable components

// Types (Import necessary types)

// =============================================================
export function Main() {
  // --- Hooks ----------------------------------------------------
  const { setTheme } = useTheme();
  const { language, setLanguage } = useLanguage();

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
    toggleScreenShare,
    screenPreviewRef, // Ref for video element in ControlPanel
    screenStreamRef, // Ref for the video element
  } = useScreenShare();

  // Audio Analysis (Visualizers)
  const { micAnalyserNode, systemAnalyserNode, micLevel, systemLevel } =
    useAudioAnalysis(
      isScreenSharing ? micStream : null, // Pass stream only when sharing
      isScreenSharing ? currentSystemAudioStream : null, // Pass stream only when sharing
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
    isSubtitleVisible,
    handleScreenshot,
    startSession,
    endSession,
    currentSessionId,
  } = useAIInteraction();

  // --- State for Layout Direction ------------------------------
  const [layoutDirection, setLayoutDirection] = useState<"horizontal" | "vertical">("vertical");

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

  // --- Helper Functions ---------------------------------------
  const toggleLayoutDirection = () => {
    setLayoutDirection((prevDirection) =>
      prevDirection === "vertical" ? "horizontal" : "vertical",
    );
  };

  const handleToggleScreenShare = async () => {
    if (isScreenSharing) {
      if (currentSessionId) {
        await endSession();
      }
      toggleScreenShare();
    } else {
      await startSession();
      toggleScreenShare();
    }
  };

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
        layoutDirection={layoutDirection}
        toggleLayoutDirection={toggleLayoutDirection}
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
        direction={layoutDirection}
        className="flex flex-1 overflow-hidden shadow-lg rounded-b-lg"
      >
        {/* Control Panel (Sidebar) - Moved to the left */}
        <ResizablePanel defaultSize={30} minSize={16} className="border-none">
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
            screenPreviewRef={screenPreviewRef}
            currentSystemAudioStream={currentSystemAudioStream}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            onToggleScreenShare={handleToggleScreenShare}
            onAiAction={sendContextToAI}
            onKeywordClick={handleKeywordClick}
            onTranscriptionResponse={handleTranscriptionResponse}
            onTranscriptionKeywords={handleTranscriptionKeywords}
            onAnswerResponse={handleAnswerResponse}
            onAnswerKeywords={handleAnswerKeywords}
            setSubtitleVisibility={setSubtitleVisibility}
            handleScreenshot={handleScreenshot}
          />
        </ResizablePanel>

        <ResizableHandle withHandle className="bg-border/70" />

        {/* Chat Panel - Moved to the right */}
        <ResizablePanel defaultSize={70} minSize={20} className="border-none">
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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
