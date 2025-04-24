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
  onTextResponse: (text: string) => void; // For RealTimeAnalysis
  onKeywords: (keywords: string[]) => void; // For RealTimeAnalysis
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
  onTextResponse,
  onKeywords,
}: ControlPanelProps) {

  const aiActions = [
    { action: "answer", label: "回答問題", icon: MicIcon },
    { action: "summary", label: "產生摘要", icon: ListCollapseIcon },
    { action: "search", label: "搜尋主題", icon: SearchIcon },
    { action: "find-clue", label: "找尋線索", icon: LightbulbIcon },
  ] as const; // Use const assertion

  return (
    <aside className="flex flex-col w-full max-w-xs border-l border-border overflow-y-auto shrink-0 bg-card">
      {/* Status and Control */}
      <div className="p-4 space-y-3 border-b border-border">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <span
              className={`flex h-3 w-3 rounded-full ${
                isScreenSharing
                  ? isLoading // Show yellow if AI is loading during sharing
                    ? "bg-yellow-400 animate-pulse"
                    : "bg-destructive animate-pulse" // Red pulse if sharing and not loading
                  : "bg-muted" // Grey if stopped
              }`}
              title={isLoading ? "AI 處理中" : isScreenSharing ? "分享/錄製中" : "已停止"}
            ></span>
            {isLoading ? "處理中..." : isScreenSharing ? "分享/錄製中" : "已停止"}
          </span>
          {isScreenSharing && (
            <span className="text-sm font-semibold tabular-nums text-foreground">
              <ClockIcon className="inline h-4 w-4 mr-1 align-[-2px]" />
              {formatTime(recordingDuration)}
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <Button
            variant={isScreenSharing ? "destructive" : "default"}
            size="sm"
            onClick={onToggleScreenShare}
            disabled={isLoading && isScreenSharing} // Disable stop if AI is processing? Maybe allow stopping anytime. Let's disable only start when loading.
            // disabled={isLoading} // Simpler: disable toggle if AI is busy
            aria-pressed={isScreenSharing}
            className="flex-1"
          >
            {isScreenSharing ? (
              <MonitorOffIcon className="h-4 w-4 mr-1" />
            ) : (
              <MonitorIcon className="h-4 w-4 mr-1" />
            )}
            {isScreenSharing ? "停止分享/錄製" : "分享螢幕並錄製"}
          </Button>
        </div>
      </div>

      {/* Real-time Analysis & Keywords */}
      <div className="p-4 space-y-3 border-b border-border">
         {/* Pass system audio stream for potential system audio transcription */}
        <RealTimeAnalysis
          onTextResponse={onTextResponse}
          onKeywords={onKeywords}
          systemAudioStream={currentSystemAudioStream || undefined}
        />
        {keywords.length > 0 && (
          <div className="pt-3 space-y-2">
            <h4 className="text-sm font-medium text-muted-foreground">
              偵測到的關鍵字
            </h4>
            <div className="flex flex-wrap gap-1.5">
              {keywords.map((keyword, index) => (
                <Button
                  key={`${keyword}-${index}`} // Use keyword and index for key
                  variant="secondary"
                  size="sm"
                  onClick={() => onKeywordClick(keyword)}
                  disabled={isLoading && selectedKeyword === keyword}
                  className="flex items-center gap-1 text-xs h-6 px-2" // Adjusted size
                   title={`解釋 "${keyword}"`} // Tooltip
                >
                  {keyword}
                  {isLoading && selectedKeyword === keyword && (
                    <Loader2Icon className="h-3 w-3 animate-spin ml-1" /> // Added margin
                  )}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* AI Actions */}
      <div className="p-4 space-y-3 border-b border-border">
        <h3 className="text-base font-semibold text-card-foreground">
          AI 動作
        </h3>
        <div className="grid grid-cols-2 gap-2">
          {aiActions.map(({ action, label, icon: Icon }) => (
            <Button
              key={action}
              variant="outline"
              size="sm"
              disabled={isLoading || !isScreenSharing}
              onClick={() => onAiAction(action)}
              className="flex items-center justify-start gap-2 text-sm" // Ensure consistent text size
               title={label} // Tooltip
            >
              <Icon className="h-4 w-4" />
              <span>{label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Mic Audio Visualizer */}
      <div className="p-4 space-y-3 border-b border-border">
        <h3 className="text-base font-semibold text-card-foreground">
          即時分析 (麥克風)
        </h3>
        <div className="py-2 w-full h-[56px] flex items-center justify-center"> {/* Added fixed height */}
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

      {/* System Audio Visualizer */}
      <div className="p-4 space-y-3 border-b border-border">
        <h3 className="text-base font-semibold text-card-foreground">
          即時分析 (系統音訊)
        </h3>
         <div className="py-2 w-full h-[56px] flex items-center justify-center"> {/* Added fixed height */}
           {isScreenSharing && systemAnalyserNode ? (
             <AudioVisualizer analyserNode={systemAnalyserNode} height={40} />
           ) : (
              <p className="text-xs text-muted-foreground">系統音訊未啟用或未擷取</p>
           )}
        </div>
        {isScreenSharing && (
          <div className="space-y-1">
            <Progress value={systemLevel} className="h-2" />
            <span className="text-xs text-muted-foreground text-right block">音量: {systemLevel.toFixed(0)}%</span>
          </div>
        )}
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
