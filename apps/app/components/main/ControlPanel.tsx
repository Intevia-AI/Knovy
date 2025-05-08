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
import AudioVisualizer from "@/components/AudioVisualizer"; // Adjust path if needed
import { formatTime } from "@/lib/utils"; // Adjust path if needed
import RealTimeSubtitle from "@/components/RealTimeSubtitle";
import { Textarea } from "@workspace/ui/components/textarea"; // Add Textarea component
import { Label } from "@workspace/ui/components/label"; // Add Label component
import ScreenPreviewWindow from "./ScreenPreviewWindow";
import AdvancedSettingsWindow from "./AdvancedSettingsWindow";

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
  screenStreamRef: React.RefObject<MediaStream | null>; // Change to screenStreamRef
  currentSystemAudioStream: MediaStream | null; // For RealTimeAnalysis
  customPrompt?: string; // Add custom prompt prop
  setCustomPrompt?: (prompt: string) => void; // Add setter for custom prompt
  language?: string;
  setLanguage?: (language: string) => void;

  onToggleScreenShare: () => void;
  onAiAction: (action: "answer" | "summary" | "search" | "find-clue", query?: string, screenshot?: string, language?: string) => void;
  onKeywordClick: (keyword: string, language?: string) => void;
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
  screenStreamRef,
  currentSystemAudioStream,
  customPrompt, // Add custom prompt to destructuring
  setCustomPrompt, // Add setter to destructuring
  language,
  setLanguage,
  onToggleScreenShare,
  onAiAction,
  onKeywordClick,
  onTranscriptionResponse,
  onTranscriptionKeywords,
  onAnswerResponse,
  onAnswerKeywords,
  setSubtitleVisibility,
}: ControlPanelProps) {
  // 追踪確認的提示詞
  const [confirmedPrompt, setConfirmedPrompt] = useState<string | undefined>(
    customPrompt
  );
  // 追踪輸入中的提示詞
  const [draftPrompt, setDraftPrompt] = useState<string>(customPrompt || "");
  const [isAdvancedSettingsOpen, setIsAdvancedSettingsOpen] = useState(false); // State for expansion
  const asideRef = useRef<HTMLElement>(null); // Ref for the aside element
  const [isScreenPreviewOpen, setIsScreenPreviewOpen] = useState(false);

  const aiActions = [
    { action: "answer", label: "深度回答", icon: MicIcon, shortcut: "1" }, // Keep shortcut as number for key check
    { action: "summary", label: "產生摘要", icon: ListCollapseIcon, shortcut: "2" }, // Keep shortcut as number for key check
    // { action: "search", label: "搜尋主題", icon: SearchIcon },
  ] as const; // Use const assertion

  const languages = [
    { code: "zh-TW", name: "繁體中文" },
    { code: "en-US", name: "English" },
    { code: "ja-JP", name: "日本語" },
    { code: "original", name: "原始語言" },
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

  // 處理語言選擇
  const handleLanguageChange = (value: string) => {
    console.log("[ControlPanel] 選擇語言:", value);
    if (setLanguage) {
      // 如果正在螢幕分享，先停止分享
      if (isScreenSharing) {
        console.log("[ControlPanel] 正在螢幕分享，先停止分享");
        onToggleScreenShare();
      }
      setLanguage(value);
    }
  };

  // 處理 custom prompt 確認
  const handleCustomPromptConfirm = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      // 如果正在螢幕分享，先停止分享
      if (isScreenSharing) {
        console.log("[ControlPanel] 正在螢幕分享，先停止分享");
        onToggleScreenShare();
      }
      // 確認提示詞
      setConfirmedPrompt(draftPrompt);
      if (setCustomPrompt) {
        setCustomPrompt(draftPrompt);
      }
      e.currentTarget.blur();
    }
  };

  // 處理清除 custom prompt
  const handleClearCustomPrompt = () => {
    // 如果正在螢幕分享，先停止分享
    if (isScreenSharing) {
      console.log("[ControlPanel] 正在螢幕分享，先停止分享");
      onToggleScreenShare();
    }
    setConfirmedPrompt(undefined);
    if (setCustomPrompt) {
      setCustomPrompt('');
    }
    setDraftPrompt('');
  };

  return (
    <aside ref={asideRef} className="flex flex-col h-full overflow-y-auto">

      {/* Status and Control */}
      <div className="p-2 space-y-1.5 border-b border-border/30">
        {/* Screen Preview */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground">
              <span
                className={`flex h-2 w-2 rounded-full ${
                  isScreenSharing
                    ? isLoading
                      ? "bg-yellow-400 animate-pulse"
                      : "bg-destructive animate-pulse"
                    : "bg-muted/50"
                }`}
                title={
                  isLoading
                    ? "AI 處理中"
                    : isScreenSharing
                    ? "分享/錄製中"
                    : "已停止"
                }
              ></span>
              {isLoading ? "處理中..." : isScreenSharing ? "分享中" : "已停止"}
            </span>
            <Button
              variant={isScreenSharing ? "destructive" : "default"}
              size="sm"
              onClick={onToggleScreenShare}
              disabled={isLoading && isScreenSharing}
              aria-pressed={isScreenSharing}
              className="text-xs h-6.5 w-90"
            >
              {isScreenSharing ? (
                <MonitorOffIcon className="h-3 w-3 mr-0.5" />
              ) : (
                <MonitorIcon className="h-3 w-3 mr-0.5" />
              )}
              {isScreenSharing ? "停止" : "分享"}
            </Button>
          </div>
          {isScreenSharing && (
            <span className="text-[10px] font-semibold tabular-nums text-foreground">
              <ClockIcon className="inline h-2.5 w-2.5 mr-0.5 align-[-2px]" />
              {formatTime(recordingDuration)}
            </span>
          )}
        </div>

        {/* Keywords Section */}
        {keywords.length > 0 && (
          <div className="pt-1.5 space-y-1">
            <h4 className="text-xs font-medium text-foreground">關鍵字</h4>
            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
              {keywords.map((keyword, index) => (
                <Button
                  key={`${keyword}-${index}`}
                  variant="secondary"
                  size="sm"
                  onClick={() => onKeywordClick(keyword, language)}
                  disabled={isLoading && selectedKeyword === keyword}
                  className="flex items-center gap-0.5 text-xs h-4 px-1"
                  title={`解釋 "${keyword}"`}
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
        <h4 className="text-xs font-medium text-foreground">AI 動作</h4>
        <div className="grid grid-cols-2 gap-1">
          {aiActions.map(({ action, label, icon: Icon, shortcut }) => (
            <Button
              key={action}
              variant="outline"
              size="sm"
              disabled={isLoading || !isScreenSharing}
              onClick={() => onAiAction(action, undefined, undefined, language)}
              className="flex items-center justify-center gap-0.5 text-xs px-1 h-7"
              title={`${label} (快捷鍵: ${modifierKey}+${shortcut})`} // Updated tooltip display
            >
              <Icon className="h-2.5 w-2.5" />
              <span className="truncate">{label}</span>
              <span className="ml-1 text-[10px] text-muted-foreground/80 border border-muted/50 rounded-sm px-0.5">
                {modifierKey}+{shortcut}
              </span>
            </Button>
          ))}
        </div>
      </div>
      
      {/* Screen Preview Button */}
      <div className="border-b border-border/30">
        <div
          className="flex items-center justify-between p-2 cursor-pointer bg-muted/10 hover:bg-muted/50"
          onClick={() => setIsScreenPreviewOpen(true)}
          role="button"
        >
          <h4 className="text-xs font-medium text-foreground">螢幕預覽</h4>
          <MonitorIcon className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Advanced Settings Button */}
      <div className="border-b border-border/30">
        <div
          className="flex items-center justify-between p-2 cursor-pointer bg-muted/10 hover:bg-muted/50"
          onClick={() => setIsAdvancedSettingsOpen(true)}
          role="button"
        >
          <h4 className="text-xs font-medium text-foreground">進階設定</h4>
          <LanguagesIcon className="h-3 w-3 text-muted-foreground" />
        </div>
      </div>

      {/* Screen Preview Window */}
      <ScreenPreviewWindow
        isOpen={isScreenPreviewOpen}
        onClose={() => {
          setIsScreenPreviewOpen(false);
        }}
        isScreenSharing={isScreenSharing}
        screenStreamRef={screenStreamRef}
        systemAnalyserNode={systemAnalyserNode}
        systemLevel={systemLevel}
      />

      {/* Advanced Settings Window */}
      <AdvancedSettingsWindow
        isOpen={isAdvancedSettingsOpen}
        onClose={() => setIsAdvancedSettingsOpen(false)}
        language={language}
        setLanguage={setLanguage}
        customPrompt={customPrompt}
        setCustomPrompt={setCustomPrompt}
        isScreenSharing={isScreenSharing}
        onToggleScreenShare={onToggleScreenShare}
      />
    </aside>
  );
}
