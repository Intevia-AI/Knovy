import React, { useState, useRef, useEffect } from "react"; // Import useRef and useEffect
import { Button } from "@workspace/ui/components/button";
import {
  MicIcon,
  Loader2Icon,
  ClockIcon,
  ListCollapseIcon,
  MonitorIcon,
  MonitorOffIcon,
  LanguagesIcon,
  ChevronDownIcon, // Add icon
  ChevronUpIcon, // Add icon
} from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@workspace/ui/components/select"; // Import Select components
import RealTimeAnalysis from "@/components/RealTimeAnalysis"; // Adjust path if needed
import { formatTime } from "@/lib/utils"; // Adjust path if needed
import RealTimeSubtitle from "@/components/RealTimeSubtitle";
import { Textarea } from "@workspace/ui/components/textarea"; // Add Textarea component
import { Label } from "@workspace/ui/components/label"; // Add Label component
import { useI18n } from "@/hooks/useI18n"; // Import useI18n
import { useLanguage } from "@/context/LanguageContext"; // Import useLanguage
import { SupportedLanguage, TranslationKey } from "@/lib/translations"; // Import translations and SupportedLanguage

// Explicitly reference the global Window type to help TS
// This might not be strictly necessary if TS config is correct, but can help resolve issues.

interface ControlPanelProps {
  isScreenSharing: boolean;
  isLoading: boolean; // AI loading state
  recordingDuration: number;
  keywords: string[];
  selectedKeyword: string | null;
  micAnalyserNode: AnalyserNode | null;
  systemAnalyserNode: AnalyserNode | null;
  micLevel: number; // Add micLevel prop
  systemLevel: number; // Add systemLevel prop
  screenPreviewRef: React.RefObject<HTMLVideoElement | null>; // Allow null
  currentSystemAudioStream: MediaStream | null; // For RealTimeAnalysis
  customPrompt?: string; // Add custom prompt prop
  setCustomPrompt?: (prompt: string) => void; // Add setter for custom prompt
  onToggleScreenShare: () => void;
  onAiAction: (action: "answer" | "summary" | "search" | "find-clue") => void;
  onKeywordClick: (keyword: string) => void;
  onTranscriptionResponse: (text: string) => void; // For RealTimeSubtitle
  onTranscriptionKeywords: (keywords: string[]) => void; // For RealTimeSubtitle
  onAnswerResponse: (text: string, turnComplete: boolean) => void; // For RealTimeAnalysis
  onAnswerKeywords: (keywords: string[]) => void; // For RealTimeAnalysis
  setSubtitleVisibility: (visibility: boolean) => void; // For RealTimeSubtitle
}

export function ControlPanel({
  isScreenSharing,
  isLoading,
  recordingDuration,
  keywords,
  selectedKeyword,
  micAnalyserNode,
  systemAnalyserNode,
  micLevel, // Destructure micLevel
  systemLevel, // Destructure systemLevel
  screenPreviewRef,
  currentSystemAudioStream,
  customPrompt, // Add custom prompt to destructuring
  setCustomPrompt, // Add setter to destructuring
  onToggleScreenShare,
  onAiAction,
  onKeywordClick,
  onTranscriptionResponse,
  onTranscriptionKeywords,
  onAnswerResponse,
  onAnswerKeywords,
  setSubtitleVisibility,
}: ControlPanelProps) {
  const { t, language } = useI18n(); // Use the hook
  const { setLanguage } = useLanguage(); // Get setLanguage from context

  // State for the *currently displayed* prompt in the UI
  const [confirmedPrompt, setConfirmedPromptState] = useState<
    string | undefined
  >(undefined);
  // State for the draft/input value
  const [draftPrompt, setDraftPrompt] = useState<string>("");
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false); // State for expansion
  const asideRef = useRef<HTMLElement>(null); // Ref for the aside element
  const [isSettingsLoaded, setIsSettingsLoaded] = useState(false); // Track settings loading

  // Load settings on mount
  useEffect(() => {
    const loadInitialPrompt = async () => {
      // Explicitly use window.electronAPI
      if (window.electronAPI) {
        try {
          const settings = await window.electronAPI.getSettings();
          if (settings && settings.customPrompt) {
            setConfirmedPromptState(settings.customPrompt);
            setDraftPrompt(settings.customPrompt);
            if (setCustomPrompt) {
              setCustomPrompt(settings.customPrompt);
            }
          }
        } catch (error) {
          console.error("Failed to load custom prompt setting:", error);
        }
      }
      setIsSettingsLoaded(true);
    };
    loadInitialPrompt();
  }, [setCustomPrompt]); // Depend on setCustomPrompt from the parent hook

  // Function to save the prompt
  const savePromptSetting = async (promptToSave: string | undefined) => {
    // Explicitly use window.electronAPI
    if (window.electronAPI) {
      try {
        await window.electronAPI.setSettings({
          customPrompt: promptToSave || "",
        });
      } catch (error) {
        console.error("Failed to save custom prompt setting:", error);
      }
    }
  };

  const aiActions = [
    {
      action: "answer",
      labelKey: "aiActionAnswer",
      icon: MicIcon,
      shortcut: "1",
    },
    {
      action: "summary",
      labelKey: "aiActionSummary",
      icon: ListCollapseIcon,
      shortcut: "2",
    },
    // { action: "search", label: "搜尋主題", icon: SearchIcon },
  ] as const; // Use const assertion

  // Define languages within the component or import from a shared location
  const supportedLanguagesData = [
    { code: "zh-TW", name: "繁體中文" },
    { code: "en-US", name: "English" },
    { code: "ja-JP", name: "日本語" },
  ];

  // Scroll to bottom when advanced settings are opened
  useEffect(() => {
    if (isAdvancedSettingsOpen && asideRef.current) {
      // Use setTimeout to ensure the content is rendered before scrolling
      setTimeout(() => {
        if (asideRef.current) {
          asideRef.current.scrollTop = asideRef.current.scrollHeight;
        }
      }, 0);
    }
  }, [isAdvancedSettingsOpen]);

  // Handle AI Action shortcuts
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check if Cmd (Mac) or Ctrl (Windows/Linux) is pressed
      const modifierPressed = event.metaKey || event.ctrlKey;

      // Ignore if modifier key isn't pressed, or if other modifiers are pressed,
      // or if input/textarea has focus
      if (
        !modifierPressed ||
        event.altKey ||
        event.shiftKey ||
        event.target instanceof HTMLInputElement ||
        event.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      const actionMapping = aiActions.find((a) => a.shortcut === event.key);

      if (actionMapping && !isLoading && isScreenSharing) {
        event.preventDefault(); // Prevent default browser behavior (like opening bookmarks)
        onAiAction(actionMapping.action);
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    // Cleanup function to remove the event listener
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isLoading, isScreenSharing, onAiAction, aiActions]); // Add dependencies

  // Determine modifier key display based on OS (simple check)
  const modifierKey =
    navigator.platform.toUpperCase().indexOf("MAC") >= 0 ? "⌘" : "Ctrl";

  // Don't render until settings are loaded
  if (!isSettingsLoaded) {
    return null; // Or a loading indicator
  }

  return (
    <aside ref={asideRef} className="flex flex-col h-full overflow-y-auto">
      {/* Status and Control */}
      <div className="p-2 space-y-1.5 border-b border-border/30">
        {/* Screen Preview */}
        {isScreenSharing && ( // Only show preview section when sharing
          <div className="p-4 space-y-2 border-t border-border/30">
            <h3 className="text-base font-semibold text-card-foreground">
              {t("screenPreviewTitle")}
            </h3>
            <video
              ref={screenPreviewRef}
              className="w-full aspect-video rounded border border-border/30 bg-muted"
              autoPlay
              playsInline
              muted // Preview should always be muted
            />
          </div>
        )}
        <div className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span
              className={`flex h-2.5 w-2.5 rounded-full ${
                isScreenSharing
                  ? isLoading
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-destructive animate-pulse"
                  : "bg-muted/50"
              }`}
              title={
                isLoading
                  ? t("statusLoading")
                  : isScreenSharing
                    ? t("statusSharing")
                    : t("statusStopped")
              }
            ></span>
            {isLoading
              ? t("statusLoadingShort")
              : isScreenSharing
                ? t("statusSharingShort")
                : t("statusStoppedShort")}
          </span>
          {isScreenSharing && (
            <span className="text-xs font-semibold tabular-nums text-foreground">
              <ClockIcon className="inline h-3 w-3 mr-0.5 align-[-2px]" />
              {formatTime(recordingDuration)}
            </span>
          )}
        </div>
        <div className="flex gap-1">
          <Button
            variant={isScreenSharing ? "destructive" : "default"}
            size="sm"
            onClick={onToggleScreenShare}
            disabled={isLoading && isScreenSharing}
            aria-pressed={isScreenSharing}
            className="flex-1 text-xs h-7"
          >
            {isScreenSharing ? (
              <MonitorOffIcon className="h-3 w-3 mr-0.5" />
            ) : (
              <MonitorIcon className="h-3 w-3 mr-0.5" />
            )}
            {isScreenSharing ? t("stopSharingButton") : t("startSharingButton")}
          </Button>
        </div>

        {/* Keywords Section */}
        {keywords.length > 0 && (
          <div className="pt-1.5 space-y-1">
            <h4 className="text-xs font-medium text-foreground">
              {t("keywordsTitle")}
            </h4>
            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
              {keywords.map((keyword, index) => (
                <Button
                  key={`${keyword}-${index}`}
                  size="sm"
                  onClick={() => onKeywordClick(keyword)}
                  disabled={isLoading && selectedKeyword === keyword}
                  className="flex items-center gap-0.5 text-xs h-4 px-1.5 py-2"
                  title={`${t("explainKeywordTooltipPrefix")} "${keyword}"`}
                >
                  {keyword}
                  {isLoading && selectedKeyword === keyword && (
                    <Loader2Icon className="h-2.5 w-2.5 animate-spin ml-0.5" />
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Real-time Analysis & Keywords */}
      <div className="p-2 space-y-1.5 border-b border-border/30">
        <div className="flex flex-col gap-2">
          <RealTimeSubtitle
            onTextResponse={onTranscriptionResponse}
            onKeywords={onTranscriptionKeywords}
            systemAudioStream={currentSystemAudioStream || undefined}
            isScreenSharing={isScreenSharing}
            setSubtitleVisibility={setSubtitleVisibility}
            language={language}
          />
          <RealTimeAnalysis
            onTextResponse={onAnswerResponse}
            onKeywords={onAnswerKeywords}
            systemAudioStream={currentSystemAudioStream || undefined}
            isScreenSharing={isScreenSharing}
            customPrompt={confirmedPrompt}
            language={language}
          />
        </div>
      </div>

      {/* AI Actions */}
      <div className="p-2 space-y-1.5 border-b border-border/30">
        <h4 className="text-xs font-medium text-foreground">
          {t("aiActionsTitle")}
        </h4>
        <div className="grid grid-cols-2 gap-1">
          {aiActions.map(({ action, labelKey, icon: Icon, shortcut }) => (
            <Button
              key={action}
              variant="outline"
              size="sm"
              disabled={isLoading || !isScreenSharing}
              onClick={() => onAiAction(action)}
              className="flex items-center justify-center gap-0.5 text-xs px-1 h-7"
              title={`${t(labelKey as TranslationKey)} (${t(
                "shortcutKeyTooltip",
              )} ${modifierKey}+${shortcut})`}
            >
              <Icon className="h-2.5 w-2.5" />
              <span className="truncate">{t(labelKey as TranslationKey)}</span>
              <span className="ml-1 text-[10px] text-muted-foreground/80 border border-muted/50 rounded-sm px-0.5">
                {modifierKey}+{shortcut}
              </span>
            </Button>
          ))}
        </div>
      </div>

      {/* --- Collapsible Advanced Settings --- */}
      <div className="border-b border-border/30">
        <div
          className="flex items-center justify-between p-2 cursor-pointer bg-muted/10 hover:bg-muted/50"
          onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
          role="button"
          aria-expanded={isAdvancedSettingsOpen}
          aria-controls="advanced-settings-content"
        >
          <h4 className="text-xs font-medium text-foreground">
            {t("advancedSettingsTitle")}
          </h4>
          {isAdvancedSettingsOpen ? (
            <ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {isAdvancedSettingsOpen && (
          <div id="advanced-settings-content" className="space-y-1.5">
            {/* Custom Prompt Input - Show only if NO prompt is confirmed */}
            {setCustomPrompt && !confirmedPrompt && (
              <div className="p-2 space-y-1.5 border-t border-border/30">
                <Label
                  htmlFor="custom-prompt"
                  className="text-xs font-medium text-foreground"
                >
                  {t("customPromptLabel")}
                </Label>
                <Textarea
                  id="custom-prompt"
                  placeholder={t("customPromptPlaceholder")}
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (
                      e.key === "Enter" &&
                      !e.shiftKey &&
                      draftPrompt.trim()
                    ) {
                      // Confirm and save the prompt
                      setConfirmedPromptState(draftPrompt);
                      setCustomPrompt(draftPrompt); // Update AI hook state
                      savePromptSetting(draftPrompt); // Save to settings
                      e.currentTarget.blur();
                      e.preventDefault(); // Prevent newline in textarea
                    }
                  }}
                  className="h-7 text-xs border-border/30 bg-muted/50 focus-visible:ring-0 focus-visible:border-primary focus-visible:outline-none"
                />
              </div>
            )}

            {/* Confirmed Prompt Display - Show only if a prompt IS confirmed */}
            {confirmedPrompt && (
              <div className="p-2 space-y-1.5 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    {t("currentPromptLabel")}
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setConfirmedPromptState(undefined); // Clear UI state
                      setDraftPrompt(""); // Clear draft
                      if (setCustomPrompt) {
                        setCustomPrompt(""); // Clear AI hook state
                      }
                      savePromptSetting(undefined); // Clear saved setting
                    }}
                    className="h-6 text-xs"
                  >
                    {t("clearButton")}
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground break-words">
                  {confirmedPrompt}
                </div>
              </div>
            )}

            {/* Language Selection */}
            <div className="p-2 space-y-1.5 border-t border-border/30">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-foreground">
                  {t("languageSelectLabel")}
                </Label>
                <Select
                  value={language}
                  onValueChange={(value) => {
                    console.log("[ControlPanel] 選擇語言:", value);
                    setLanguage(value as SupportedLanguage);
                  }}
                >
                  <SelectTrigger className="w-[120px] h-7! text-xs px-2 bg-background!">
                    <LanguagesIcon className="h-3 w-3 mr-1" />
                    <SelectValue placeholder={t("languageSelectPlaceholder")} />
                  </SelectTrigger>
                  <SelectContent>
                    {supportedLanguagesData.map((lang) => (
                      <SelectItem
                        key={lang.code}
                        value={lang.code}
                        className="text-xs"
                      >
                        {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Mic Audio Visualizer - Commented out */}
            {/*
            <div className="p-4 space-y-3 border-t border-border/30">
              <h3 className="text-base font-semibold text-card-foreground">
                即時分析 (麥克風)
              </h3>
              <div className="py-2 w-full h-[56px] flex items-center justify-center">
                {isScreenSharing && micAnalyserNode ? (
                   <AudioVisualizer analyserNode={micAnalyserNode} height={40} />
                ) : (
                   <p className="text-xs text-muted-foreground">麥克風未啟用</p>
                )}
              </div>
              {isScreenSharing && (
                <div className="space-y-1">
                  <Progress value={micLevel} className="h-2" />
                  <span className="text-xs text-muted-foreground text-right block">音量: {micLevel.toFixed(0)}%</span>
                </div>
              )}
            </div>
            */}

            {/* System Audio Visualizer - Commented out */}
            {/*
            <div className="p-1.5 space-y-1 border-t border-border/30">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-medium text-foreground">系統音訊</h4>
                {isScreenSharing && (
                  <span className="text-xs text-muted-foreground">
                    {systemLevel.toFixed(0)}%
                  </span>
                )}
              </div>
              <div className="w-full h-[4px] flex items-center">
                {isScreenSharing && systemAnalyserNode ? (
                  <AudioVisualizer analyserNode={systemAnalyserNode} height={4} />
                ) : (
                  <div className="w-full h-full bg-muted rounded-full" />
                )}
              </div>
            </div>
            */}
          </div>
        )}
      </div>
      {/* --- End Collapsible Advanced Settings --- */}
    </aside>
  );
}
