import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  MicIcon,
  PauseIcon,
  PlayIcon,
  Loader2Icon,
  ClockIcon,
  ListCollapseIcon,
  SearchIcon,
  SendIcon,
  MonitorIcon,
  MonitorOffIcon,
} from "lucide-react";
import { Message } from "ai";
import { Input } from "@workspace/ui/components/input";
import { Markdown } from "./markdown";
import RealTimeAnalysis from "@/components/RealTimeAnalysis";
import { cn } from "@workspace/ui/lib/utils";
import { useSegmentRecorder } from "@/hooks/useSegmentRecorder";

// --- Types ----------------------------------------------------
interface AIContextData {
  audioInput?: { data: string; mimeType: string };
}

interface Segment {
  blob: Blob;
  timestamp: number;
}

// =============================================================
export function DemoComponent() {
  // --- Refs ----------------------------------------------------
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const sendContextToAIRef = useRef<
    (
      action: "real-time" | "answer" | "summary" | "search" | "custom",
      customQuery?: string
    ) => Promise<void>
  >(async () => {});

  // --- State --------------------------------------------------
  const [isLoading, setIsLoading] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [micDuration, setMicDuration] = useState(0); // in seconds
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  // --- Hook ---------------------------------------------------
  const {
    recording: isRecording,
    start: startRecording,
    stop: stopRecording,
    mimeType,
  } = useSegmentRecorder();

  // --- Utils --------------------------------------------------
  const applyNoiseFilter = (stream: MediaStream): MediaStream => {
    const audioCtx = new AudioContext();
    const source = audioCtx.createMediaStreamSource(stream);
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(3000, audioCtx.currentTime);
    source.connect(filter);
    const dest = audioCtx.createMediaStreamDestination();
    filter.connect(dest);
    return dest.stream;
  };

  const cleanupStream = (ref: React.MutableRefObject<MediaStream | null>) => {
    ref.current?.getTracks().forEach((t) => t.stop());
    ref.current = null;
  };
  const cleanupRecorder = (
    ref: React.MutableRefObject<MediaRecorder | null>
  ) => {
    if (ref.current && ref.current.state !== "inactive") ref.current.stop();
    ref.current = null;
  };
  const blobToBase64 = (b: Blob): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string" ? res(reader.result) : rej();
      reader.onerror = rej;
      reader.readAsDataURL(b);
    });
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const sendContextToAI = useCallback<
    (
      action: "real-time" | "answer" | "summary" | "search" | "custom",
      customQuery?: string
    ) => Promise<void>
  >(
    async (action, customQuery) => {
      if (isLoading) return;
      setIsLoading(true);

      const ctx = await gatherContext();

      if (!ctx) {
        setIsLoading(false);
        return;
      }

      const promptMap: Record<typeof action, string> = {
        "real-time": "簡潔地分析最新的音訊內容，並標示關鍵字或待辦事項。",
        answer: "根據最近處理過的音訊片段，直接回答使用者潛在的問題。",
        summary: "提供最近處理過的音訊片段的簡明摘要。",
        search:
          "針對最近處理過的音訊片段中提到的主題，建議有用的搜尋關鍵字或直接搜尋相關資訊。",
        custom: customQuery || "請依要求分析最近處理過的音訊片段。",
      } as const;
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: action === "custom" ? customPrompt : promptMap[action],
      };
      if (action !== "real-time") setAiMessages((p) => [...p, userMsg]);

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [userMsg], data: ctx }),
        });
        if (!res.ok) throw new Error(await res.text());
        const ai: Message = await res.json();
        setAiMessages((p) => [
          ...p,
          {
            id: ai.id || `ai-${Date.now()}`,
            role: "assistant",
            content: ai.content,
          },
        ]);
      } catch (e: unknown) {
        const errorMessage = e instanceof Error ? e.message : String(e);
        setAiMessages((p) => [
          ...p,
          {
            id: `err-ai-${Date.now()}`,
            role: "assistant",
            content: `[AI 錯誤] ${errorMessage}`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, segments, customPrompt]
  );

  // --- Effects ------------------------------------------------
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isRecording) {
      setMicDuration(0);
      t = setInterval(() => setMicDuration((d) => d + 1), 1000);
    }
    return () => clearInterval(t);
  }, [isRecording]);

  useEffect(() => {
    const h = (e: CustomEvent<Blob>) =>
      setSegments((p) => [...p, { blob: e.detail, timestamp: Date.now() }]);
    window.addEventListener("segment", h as any);
    return () => window.removeEventListener("segment", h as any);
  }, []);

  useEffect(() => {
    sendContextToAIRef.current = sendContextToAI;
  }, [sendContextToAI]);

  useEffect(() => {
    if (
      isScreenSharing &&
      screenPreviewRef.current &&
      screenStreamRef.current
    ) {
      screenPreviewRef.current.srcObject = screenStreamRef.current;
      screenPreviewRef.current.muted = true;
      screenPreviewRef.current
        .play()
        .catch((e) => console.error("Video play error:", e));
    }
  }, [isScreenSharing]);

  // --- Context ------------------------------------------------
  const gatherContext = async (): Promise<AIContextData | null> => {
    if (!segments.length) return null;
    const last = segments[segments.length - 1]?.blob;
    if (!last) return null;
    const full = await blobToBase64(last);
    const data = full.split(",")[1] || full;
    return { audioInput: { data, mimeType } };
  };

  const handleTextResponse = useCallback((text: string) => {
    setAiMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.content.startsWith("[即時轉錄]")) {
        return [
          ...prev.slice(0, -1),
          {
            ...lastMessage,
            content: lastMessage.content + text,
          },
        ];
      } else {
        return [
          ...prev,
          {
            id: `realtime-${Date.now()}`,
            role: "assistant",
            content: `[即時轉錄] ${text}`,
          },
        ];
      }
    });
  }, []);

  const handleKeywords = useCallback((newKeywords: string[]) => {
    setKeywords((prev) => {
      const uniqueNewKeywords = newKeywords.filter((k) => !prev.includes(k));
      return [...prev, ...uniqueNewKeywords];
    });
  }, []);

  const handleKeywordClick = useCallback(async (keyword: string) => {
    setSelectedKeyword(keyword);
    setIsLoading(true);

    try {
      const response = await fetch("/api/ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content: `請用簡單易懂的方式解釋這個專業術語：${keyword}`,
            },
          ],
          data: {},
        }),
      });

      if (!response.ok) {
        throw new Error("無法取得解釋");
      }

      const data = await response.json();
      const explanation = data.content;

      setAiMessages((prev) => [
        ...prev,
        {
          id: `explanation-${Date.now()}`,
          role: "assistant",
          content: `[${keyword} 的解釋] ${explanation}`,
        },
      ]);
    } catch (error) {
      console.error("取得關鍵字解釋時發生錯誤:", error);
    } finally {
      setIsLoading(false);
      setSelectedKeyword(null);
    }
  }, []);

  const toggleScreenShare = async () => {
    if (isLoading) return;
    if (isScreenSharing) {
      cleanupRecorder(screenAudioRecorderRef);
      cleanupStream(screenStreamRef);
      if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;
      setIsScreenSharing(false);
    } else {
      try {
        const stream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = stream;

        let audioStarted = false;
        let videoStarted = false;

        if (stream.getAudioTracks().length > 0) {
          const audioOnly = new MediaStream(stream.getAudioTracks());
          const filteredAudio = applyNoiseFilter(audioOnly);
          audioStarted = true;
        } else {
          console.warn("No audio track captured from screen share.");
        }

        if (stream.getVideoTracks().length > 0) {
          setIsScreenSharing(true);
          videoStarted = true;
        } else {
          console.warn("No video track captured from screen share.");
          if (!audioStarted) cleanupStream(screenStreamRef);
        }
      } catch (e) {
        console.warn("Screen capture failed or cancelled", e);
        cleanupStream(screenStreamRef);
      }
    }
  };

  return (
    <div className="flex flex-1 overflow-hidden border rounded-lg shadow-lg bg-card max-h-[70vh]">
      <main className="flex flex-col flex-1 overflow-hidden">
        <div className="flex-1 p-4 space-y-4 overflow-y-auto bg-muted/30">
          {aiMessages.map((m) => (
            <div
              key={m.id}
              className={cn(
                "p-3 rounded-lg text-sm border w-fit max-w-[85%]",
                m.role === "user"
                  ? "bg-primary ml-auto text-primary-foreground"
                  : "bg-muted mr-auto text-foreground"
              )}
            >
              <Markdown>{m.content}</Markdown>
            </div>
          ))}
          {isLoading && (
            <div className="flex items-center justify-center text-sm text-muted-foreground p-2">
              <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
              處理中，請稍候...
            </div>
          )}
          {aiMessages.length === 0 && !isLoading && (
            <p className="text-sm text-center text-muted-foreground py-4">
              點擊「開始錄製」或「分享螢幕」以啟動 AI 助理。
            </p>
          )}
        </div>

        <div className="p-4 border-t bg-card border-border">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!customPrompt.trim()) return;
              sendContextToAI("custom", customPrompt);
              setCustomPrompt("");
            }}
            className="flex gap-2"
          >
            <Input
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="輸入自訂提示或問題…"
              className="flex-grow"
              disabled={isLoading || !segments.length}
            />
            <Button
              type="submit"
              variant="default"
              size="icon"
              disabled={isLoading || !segments.length || !customPrompt.trim()}
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <SendIcon className="h-4 w-4" />
            </Button>
          </form>
        </div>
      </main>

      <aside className="flex flex-col w-full max-w-sm border-l border-border bg-card overflow-y-auto shrink-0">
        <div className="p-4 space-y-3 border-b border-border">
          <div className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <span
                className={`flex h-3 w-3 rounded-full ${isRecording ? (isLoading ? "bg-yellow-400" : "bg-destructive animate-pulse") : "bg-muted"}`}
              ></span>
              {isLoading ? "處理中..." : isRecording ? "錄製中" : "已停止"}
            </span>
            {isRecording && (
              <span className="text-sm font-semibold tabular-nums text-foreground">
                <ClockIcon className="inline h-4 w-4 mr-1 align-[-2px]" />
                {formatTime(micDuration)}
              </span>
            )}
          </div>
          <div className="flex gap-2">
            {isRecording ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={stopRecording}
                disabled={isLoading}
                className="flex-1"
              >
                <PauseIcon className="h-4 w-4 mr-1" /> 停止
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={startRecording}
                disabled={isLoading}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <PlayIcon className="h-4 w-4 mr-1" /> 開始錄製
              </Button>
            )}
            <Button
              variant={isScreenSharing ? "destructive" : "outline"}
              size="sm"
              onClick={toggleScreenShare}
              disabled={isLoading || (!isRecording && isScreenSharing)}
              aria-pressed={isScreenSharing}
              className="flex-1"
            >
              {isScreenSharing ? (
                <MonitorOffIcon className="h-4 w-4 mr-1" />
              ) : (
                <MonitorIcon className="h-4 w-4 mr-1" />
              )}
              {isScreenSharing ? "停止分享" : "分享螢幕"}
            </Button>
          </div>
        </div>

        <div className="p-4 space-y-3 border-b border-border">
          <h3 className="text-base font-semibold text-card-foreground">
            即時分析
          </h3>
          <RealTimeAnalysis
            onTextResponse={handleTextResponse}
            onKeywords={handleKeywords}
          />
          {keywords.length > 0 && (
            <div className="pt-3 space-y-2">
              <h4 className="text-sm font-medium text-muted-foreground">
                偵測到的關鍵字
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {keywords.map((keyword, index) => (
                  <Button
                    key={index}
                    variant="secondary"
                    size="sm"
                    onClick={() => handleKeywordClick(keyword)}
                    disabled={isLoading && selectedKeyword === keyword}
                    className="flex items-center gap-1 text-xs"
                  >
                    {keyword}
                    {isLoading && selectedKeyword === keyword && (
                      <Loader2Icon className="h-3 w-3 animate-spin" />
                    )}
                  </Button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="p-4 space-y-3 border-b border-border">
          <h3 className="text-base font-semibold text-card-foreground">
            AI 動作
          </h3>
          <div className="grid grid-cols-2 gap-2">
            {[
              { action: "answer", label: "回答問題", icon: MicIcon },
              { action: "summary", label: "產生摘要", icon: ListCollapseIcon },
              { action: "search", label: "搜尋主題", icon: SearchIcon },
            ].map(({ action, label, icon: Icon }) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                disabled={isLoading || !segments.length}
                onClick={() =>
                  sendContextToAI(action as "answer" | "summary" | "search")
                }
                className="flex items-center justify-start gap-2"
              >
                <Icon className="h-4 w-4" />
                <span>{label}</span>
              </Button>
            ))}
          </div>
        </div>

        {isScreenSharing && (
          <div className="p-4 space-y-2 border-b border-border">
            <h3 className="text-base font-semibold text-card-foreground">
              螢幕預覽
            </h3>
            <video
              ref={screenPreviewRef}
              className="w-full aspect-video rounded border border-border bg-muted"
              autoPlay
              playsInline
              muted
            />
          </div>
        )}

        <div className="p-4 mt-auto space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">
            音訊播放 (停止後)
          </h3>
          <audio
            ref={audioPlayerRef}
            controls
            src={
              segments[segments.length - 1]?.blob
                ? URL.createObjectURL(segments[segments.length - 1]!.blob)
                : undefined
            }
            className={`w-full h-10 ${!segments.length ? "opacity-50 cursor-not-allowed" : ""}`}
          ></audio>
        </div>
      </aside>
    </div>
  );
}
