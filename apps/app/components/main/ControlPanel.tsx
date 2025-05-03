import React from 'react';
import { Button } from "@workspace/ui/components/button";
import {
  MicIcon,
  Loader2Icon,
  ClockIcon,
  ListCollapseIcon,
  SearchIcon,
  MonitorIcon,
  MonitorOffIcon,
  LightbulbIcon,
} from "lucide-react";
import RealTimeAnalysis from "@/components/RealTimeAnalysis"; // Adjust path if needed
import AudioVisualizer from "@/components/AudioVisualizer"; // Adjust path if needed
import { formatTime } from '@/lib/utils'; // Adjust path if needed
import { Progress } from "@workspace/ui/components/progress"; // Import Progress
import RealTimeSubtitle from '@/components/RealTimeSubtitle';

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
  onToggleScreenShare,
  onAiAction,
  onKeywordClick,
  onTranscriptionResponse,
  onTranscriptionKeywords,
  onAnswerResponse,
  onAnswerKeywords,
  setSubtitleVisibility,
}: ControlPanelProps) {

  const aiActions = [
    { action: "answer", label: "深度回答", icon: MicIcon },
    { action: "summary", label: "產生摘要", icon: ListCollapseIcon },
    // { action: "search", label: "搜尋主題", icon: SearchIcon },
  ] as const; // Use const assertion

  return (
    <aside className="flex flex-col w-full max-w-[160px] border-l border-border overflow-y-auto shrink-0 bg-card">
      {/* Status and Control */}
      <div className="p-2 space-y-1.5 border-b border-border">
        <div className="flex items-center justify-between gap-1">
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
            <span
              className={`flex h-2.5 w-2.5 rounded-full ${
                isScreenSharing
                  ? isLoading
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-destructive animate-pulse"
                  : "bg-muted"
              }`}
              title={isLoading ? "AI 處理中" : isScreenSharing ? "分享/錄製中" : "已停止"}
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
            <h4 className="text-xs font-medium text-foreground">
              關鍵字
            </h4>
            <div className="flex flex-wrap gap-1.5 max-h-[80px] overflow-y-auto pr-1">
              {keywords.map((keyword, index) => (
                <Button
                  key={`${keyword}-${index}`}
                  variant="secondary"
                  size="sm"
                  onClick={() => onKeywordClick(keyword)}
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
      <div className="p-2 space-y-1.5 border-b border-border">
        <div className="flex flex-col gap-2">
          <RealTimeSubtitle
            onTextResponse={onTranscriptionResponse}
            onKeywords={onTranscriptionKeywords}
            systemAudioStream={currentSystemAudioStream || undefined}
            isScreenSharing={isScreenSharing}
            setSubtitleVisibility={setSubtitleVisibility}
          />
          <RealTimeAnalysis
            onTextResponse={onAnswerResponse}
            onKeywords={onAnswerKeywords}
            systemAudioStream={currentSystemAudioStream || undefined}
            isScreenSharing={isScreenSharing}
          />
        </div>
      </div>
      
      {/* AI Actions */}
      <div className="p-2 space-y-1.5 border-b border-border">
        <h4 className="text-xs font-medium text-foreground">
          AI 動作
        </h4>
        <div className="grid grid-cols-2 gap-1">
          {aiActions.map(({ action, label, icon: Icon }) => (
            <Button
              key={action}
              variant="outline"
              size="sm"
              disabled={isLoading || !isScreenSharing}
              onClick={() => onAiAction(action)}
              className="flex items-center justify-center gap-0.5 text-xs px-1 h-7"
              title={label}
            >
              <Icon className="h-2.5 w-2.5" />
              <span className="truncate">{label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Mic Audio Visualizer - Commented out
      <div className="p-4 space-y-3 border-b border-border">
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

      {/* System Audio Visualizer */}
      <div className="p-1.5 space-y-1 border-b border-border">
        <div className="flex items-center justify-between">
          {/* <span className="text-xs text-muted-foreground">系統音訊</span> */}
          <h4 className="text-xs font-medium text-foreground">
              系統音訊
          </h4>
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

      {/* Screen Preview */}
      {isScreenSharing && ( // Only show preview section when sharing
        <div className="p-4 space-y-2 border-b border-border">
          <h3 className="text-base font-semibold text-card-foreground">
            螢幕預覽
          </h3>
          <video
            ref={screenPreviewRef}
            className="w-full aspect-video rounded border border-border bg-muted"
            autoPlay
            playsInline
            muted // Preview should always be muted
          />
        </div>
      )}
    </aside>
  );
}
