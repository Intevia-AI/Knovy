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
  screenPreviewRef,
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
                  ? "AI 處理中"
                  : isScreenSharing
                  ? "分享/錄製中"
                  : "已停止"
              }
            ></span>
            {isLoading ? "處理中..." : isScreenSharing ? "分享中" : "已停止"}
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
            {isScreenSharing ? "停止" : "分享"}
          </Button>
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

      {isScreenSharing && ( // Only show preview section when sharing
          <div className="p-4 space-y-2 border-t border-border/30">
            <h3 className="text-base font-semibold text-card-foreground">
              螢幕預覽
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
      {/* --- Collapsible Advanced Settings --- */}
      <div className="border-b border-border/30">
        <div
          className="flex items-center justify-between p-2 cursor-pointer bg-muted/10 hover:bg-muted/50"
          onClick={() => setIsAdvancedSettingsOpen(!isAdvancedSettingsOpen)}
          role="button"
          aria-expanded={isAdvancedSettingsOpen}
          aria-controls="advanced-settings-content"
        >
          <h4 className="text-xs font-medium text-foreground">進階設定</h4>
          {isAdvancedSettingsOpen ? (
            <ChevronUpIcon className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronDownIcon className="h-4 w-4 text-muted-foreground" />
          )}
        </div>

        {isAdvancedSettingsOpen && (
          <div id="advanced-settings-content" className="space-y-1.5">
            {/* Language Selection */}
            {setLanguage && (
              <div className="p-2 space-y-1.5 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    語言選擇
                  </Label>
                  <Select
                    value={language || "zh-TW"}
                    onValueChange={handleLanguageChange}
                  >
                    <SelectTrigger className="w-[120px] h-7! text-xs px-2 bg-background!">
                      <LanguagesIcon className="h-3 w-3 mr-1" />
                      <SelectValue placeholder="選擇語言" />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((lang) => (
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
            )}

            {/* Custom Prompt Input */}
            {setCustomPrompt && !confirmedPrompt && (
              <div className="p-2 space-y-1.5 border-t border-border/30">
                <Label
                  htmlFor="custom-prompt"
                  className="text-xs font-medium text-foreground"
                >
                  客製化模型要求
                </Label>
                <Textarea
                  id="custom-prompt"
                  placeholder="輸入自定義提示詞後按 Enter..."
                  value={draftPrompt}
                  onChange={(e) => setDraftPrompt(e.target.value)}
                  onKeyDown={handleCustomPromptConfirm}
                  className="h-7 text-xs border-border/30 bg-muted/50 focus-visible:ring-0 focus-visible:border-primary focus-visible:outline-none"
                />
              </div>
            )}

            {/* Confirmed Prompt Display */}
            {confirmedPrompt && (
              <div className="p-2 space-y-1.5 border-t border-border/30">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-medium text-foreground">
                    當前模型要求
                  </Label>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleClearCustomPrompt}
                    className="h-6 text-xs"
                  >
                    清除
                  </Button>
                </div>
                <div className="text-xs text-muted-foreground break-words">
                  {confirmedPrompt}
                </div>
              </div>
            )}

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
