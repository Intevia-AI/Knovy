import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  MicIcon,
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
import AudioVisualizer from "./AudioVisualizer";
import { cn } from "@workspace/ui/lib/utils";
import { useSegmentRecorder, SEGMENT_MS } from "@/hooks/useSegmentRecorder";

// --- Types ----------------------------------------------------
interface AIContextData {
  audioInputs?: { data: string; mimeType: string; label: string }[];
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
  const systemAudioChunksRef = useRef<Blob[]>([]);
  const systemAudioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const sendContextToAIRef = useRef<
    (
      action: "real-time" | "answer" | "summary" | "search" | "custom",
      customQuery?: string
    ) => Promise<void>
  >(async () => {});
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Add refs & state for system audio analyser
  const systemAudioContextRef = useRef<AudioContext | null>(null);
  const systemAudioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [systemAnalyserNode, setSystemAnalyserNode] = useState<AnalyserNode | null>(null);

  // --- State --------------------------------------------------
  const [isLoading, setIsLoading] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [systemAudioSegments, setSystemAudioSegments] = useState<Segment[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);
  const [systemAudioMimeType, setSystemAudioMimeType] = useState<string>("");
  const [micAnalyserNode, setMicAnalyserNode] = useState<AnalyserNode | null>(null);

  // --- Hook ---------------------------------------------------
  const {
    start: startMicRecording,
    stop: stopMicRecording,
    mimeType: micMimeType,
    micStream,
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
    if (ref.current && ref.current.state !== "inactive") {
      ref.current.ondataavailable = null;
      ref.current.onstop = null;
      ref.current.onerror = null;
      try {
        ref.current.stop();
      } catch (e) {
        console.warn("Error stopping recorder during cleanup:", e);
      }
    }
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
      if (isLoading || !isScreenSharing) return;
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
    [
      isLoading,
      isScreenSharing,
      segments,
      systemAudioSegments,
      customPrompt,
      micMimeType,
      systemAudioMimeType,
    ]
  );

  // --- Effects ------------------------------------------------
  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isScreenSharing) {
      setRecordingDuration(0);
      t = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(t);
  }, [isScreenSharing]);

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
      screenStreamRef.current?.getVideoTracks().length
    ) {
      const videoStream = new MediaStream(
        screenStreamRef.current.getVideoTracks()
      );
      screenPreviewRef.current.srcObject = videoStream;
      screenPreviewRef.current.muted = true;
      screenPreviewRef.current
        .play()
        .catch((e) => console.error("Video play error:", e));
    } else if (!isScreenSharing && screenPreviewRef.current) {
      screenPreviewRef.current.srcObject = null;
    }
  }, [isScreenSharing, screenStreamRef.current]);

  useEffect(() => {
    if (isScreenSharing && micStream && !micAudioContextRef.current) {
      console.log("Setting up mic analyser...");
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        micAudioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(micStream);
        micSourceNodeRef.current = source;
        const analyser = audioCtx.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 256;
        source.connect(analyser);
        setMicAnalyserNode(analyser);
        console.log("Mic analyser setup complete.");
      } catch (error) {
        console.error("Error setting up mic analyser:", error);
        micSourceNodeRef.current?.disconnect();
        micSourceNodeRef.current = null;
        micAudioContextRef.current?.close().catch(console.error);
        micAudioContextRef.current = null;
        setMicAnalyserNode(null);
      }
    } else if ((!isScreenSharing || !micStream) && micAudioContextRef.current) {
      console.log("Cleaning up mic analyser...");
      micSourceNodeRef.current?.disconnect();
      micSourceNodeRef.current = null;
      if (micAudioContextRef.current.state !== "closed") {
        micAudioContextRef.current.close().catch(console.error);
      }
      micAudioContextRef.current = null;
      setMicAnalyserNode(null);
      console.log("Mic analyser cleaned up.");
    }

    return () => {
      console.log("Unmount cleanup for mic analyser...");
      if (micAudioContextRef.current && micAudioContextRef.current.state !== "closed") {
        micSourceNodeRef.current?.disconnect();
        micSourceNodeRef.current = null;
        micAudioContextRef.current.close().catch(console.error);
        micAudioContextRef.current = null;
      }
    };
  }, [isScreenSharing, micStream]);

  // --- Context ------------------------------------------------
  const gatherContext = async (): Promise<AIContextData | null> => {
    const micSegment =
      segments.length > 0 ? segments[segments.length - 1] : null;
    const systemSegment =
      systemAudioSegments.length > 0
        ? systemAudioSegments[systemAudioSegments.length - 1]
        : null;

    if (!micSegment && !systemSegment) return null;

    const blobsToProcess: { blob: Blob; type: string; label: string }[] = [];
    if (micSegment)
      blobsToProcess.push({
        blob: micSegment.blob,
        type: micMimeType,
        label: "microphone",
      });
    if (systemSegment)
      blobsToProcess.push({
        blob: systemSegment.blob,
        type: systemAudioMimeType,
        label: "system",
      });

    if (!blobsToProcess.length) return null;

    const audioInputs = await Promise.all(
      blobsToProcess.map(async ({ blob, type, label }) => {
        try {
          const full = await blobToBase64(blob);
          const data = full.split(",")[1] || full;
          return { data, mimeType: type, label };
        } catch (error) {
          console.error("Error converting blob to base64:", error);
          return null;
        }
      })
    );

    const validAudioInputs = audioInputs.filter(
      Boolean
    ) as { data: string; mimeType: string; label: string }[];

    if (!validAudioInputs.length) return null;

    return { audioInputs: validAudioInputs };
  };

  const handleTextResponse = useCallback((text: string) => {
    setAiMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (
        lastMessage?.role === "assistant" &&
        lastMessage.content.startsWith("[即時轉錄]")
      ) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + text },
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
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err-explanation-${Date.now()}`,
          role: "assistant",
          content: `[錯誤] 無法取得 ${keyword} 的解釋。`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setSelectedKeyword(null);
    }
  }, []);

  const toggleScreenShare = async () => {
    if (isLoading) return;

    if (isScreenSharing) {
      stopMicRecording();

      if (systemAudioTimerRef.current) {
        clearInterval(systemAudioTimerRef.current);
        systemAudioTimerRef.current = null;
      }

      cleanupRecorder(screenAudioRecorderRef);
      systemAudioChunksRef.current = [];

      cleanupStream(screenStreamRef);

      if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;

      // Cleanup system audio analyser
      systemAudioSourceNodeRef.current?.disconnect();
      systemAudioSourceNodeRef.current = null;
      if (systemAudioContextRef.current && systemAudioContextRef.current.state !== "closed") {
        systemAudioContextRef.current.close().catch(console.error);
      }
      systemAudioContextRef.current = null;
      setSystemAnalyserNode(null);

      setIsScreenSharing(false);
      setRecordingDuration(0);
    } else {
      setSegments([]);
      setSystemAudioSegments([]);
      systemAudioChunksRef.current = [];
      setAiMessages([]);
      setKeywords([]);
      setRecordingDuration(0);

      let capturedMicStream: MediaStream | null = null;
      let displayStream: MediaStream | null = null;

      try {
        capturedMicStream = await startMicRecording();
        if (!capturedMicStream) {
          console.error("Failed to start microphone recording.");
          alert("無法啟動麥克風錄音，請檢查權限。");
          setIsScreenSharing(false);
          return;
        }

        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = displayStream;

        const systemAudioTracks = displayStream.getAudioTracks();
        if (systemAudioTracks.length === 0) {
          console.warn("System audio track not found in screen share stream.");
          alert("無法擷取系統音訊，錄音將只包含麥克風。若要錄製系統音訊，請在分享畫面時確認已勾選分享音訊選項。");
          throw new Error("System audio not available.");
        }

        const systemAudioStream = new MediaStream(systemAudioTracks);
        const combinedAudioStream = new MediaStream([
          ...systemAudioStream.getAudioTracks(),
          ...capturedMicStream.getAudioTracks(),
        ]);

        const availableMime = MediaRecorder.isTypeSupported(
          "audio/webm;codecs=opus"
        )
          ? "audio/webm;codecs=opus"
          : "audio/ogg;codecs=opus";
        setSystemAudioMimeType(availableMime);

        cleanupRecorder(screenAudioRecorderRef);
        const combinedRecorder = new MediaRecorder(combinedAudioStream, {
          mimeType: availableMime,
        });
        screenAudioRecorderRef.current = combinedRecorder;

        combinedRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) systemAudioChunksRef.current.push(e.data);
        };

        combinedRecorder.onstop = () => {
          if (systemAudioChunksRef.current.length > 0) {
            const blob = new Blob(systemAudioChunksRef.current, {
              type: availableMime,
            });
            setSystemAudioSegments((p) => [
              ...p,
              { blob, timestamp: Date.now() },
            ]);
            systemAudioChunksRef.current = [];
          }
          if (screenAudioRecorderRef.current && screenAudioRecorderRef.current.state === 'inactive' && isScreenSharing) {
            try {
              screenAudioRecorderRef.current.start();
            } catch (e) {
              console.error("Error restarting combined recorder:", e);
            }
          }
        };
        combinedRecorder.onerror = (e) => {
          console.error("Combined Recorder Error:", e);
        };

        combinedRecorder.start();
        if (systemAudioTimerRef.current) clearInterval(systemAudioTimerRef.current);
        systemAudioTimerRef.current = setInterval(() => {
          if (screenAudioRecorderRef.current && screenAudioRecorderRef.current.state === 'recording') {
            screenAudioRecorderRef.current.stop();
          }
        }, SEGMENT_MS);

        try {
          const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
          systemAudioContextRef.current = audioCtx;
          const source = audioCtx.createMediaStreamSource(systemAudioStream);
          systemAudioSourceNodeRef.current = source;
          const analyser = audioCtx.createAnalyser();
          analyser.smoothingTimeConstant = 0.3;
          analyser.fftSize = 256;
          source.connect(analyser);
          setSystemAnalyserNode(analyser);
        } catch (error) {
          console.error("Error setting up system audio analyser:", error);
          systemAudioSourceNodeRef.current?.disconnect();
          systemAudioSourceNodeRef.current = null;
          systemAudioContextRef.current?.close().catch(console.error);
          systemAudioContextRef.current = null;
          setSystemAnalyserNode(null);
        }

        setIsScreenSharing(true);
      } catch (e) {
        console.error("Error starting screen share:", e);
        alert(`啟動分享時發生錯誤: ${e instanceof Error ? e.message : String(e)}`);

        stopMicRecording();
        cleanupStream(screenStreamRef);
        cleanupRecorder(screenAudioRecorderRef);
        if (systemAudioTimerRef.current) {
          clearInterval(systemAudioTimerRef.current);
          systemAudioTimerRef.current = null;
        }
        systemAudioChunksRef.current = [];

        systemAudioSourceNodeRef.current?.disconnect();
        systemAudioSourceNodeRef.current = null;
        if (systemAudioContextRef.current && systemAudioContextRef.current.state !== "closed") {
          systemAudioContextRef.current.close().catch(console.error);
        }
        systemAudioContextRef.current = null;
        setSystemAnalyserNode(null);

        setIsScreenSharing(false);
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
          {aiMessages.length === 0 && !isLoading && !isScreenSharing && (
            <p className="text-sm text-center text-muted-foreground py-4">
              點擊「分享螢幕」以啟動 AI 助理並開始錄製。
            </p>
          )}
          {aiMessages.length === 0 && !isLoading && isScreenSharing && (
            <p className="text-sm text-center text-muted-foreground py-4">
              錄製中... AI 分析將在處理音訊後顯示。
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
              placeholder={
                isScreenSharing ? "輸入自訂提示或問題…" : "請先開始分享螢幕"
              }
              className="flex-grow"
              disabled={isLoading || !isScreenSharing}
            />
            <Button
              type="submit"
              variant="default"
              size="icon"
              disabled={isLoading || !isScreenSharing || !customPrompt.trim()}
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
                className={`flex h-3 w-3 rounded-full ${
                  isScreenSharing
                    ? isLoading
                      ? "bg-yellow-400"
                      : "bg-destructive animate-pulse"
                    : "bg-muted"
                }`}
              ></span>
              {isLoading
                ? "處理中..."
                : isScreenSharing
                ? "分享/錄製中"
                : "已停止"}
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
              onClick={toggleScreenShare}
              disabled={isLoading}
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

        <div className="p-4 space-y-3 border-b border-border">
          <h3 className="text-base font-semibold text-card-foreground">
            即時分析 (麥克風)
          </h3>
          <div className="py-2 w-full">
            <AudioVisualizer analyserNode={micAnalyserNode} height={40} />
          </div>
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
            即時分析 (系統音訊)
          </h3>
          <div className="py-2 w-full">
            <AudioVisualizer analyserNode={systemAnalyserNode} height={40} />
          </div>
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
                disabled={isLoading || !isScreenSharing}
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

        {isScreenSharing &&
          screenStreamRef.current?.getVideoTracks().length > 0 && (
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
            麥克風音訊播放 (最新片段)
          </h3>
          <audio
            ref={audioPlayerRef}
            controls
            src={
              segments.length > 0
                ? URL.createObjectURL(segments[segments.length - 1]!.blob)
                : undefined
            }
            className={`w-full h-10 ${
              segments.length === 0 ? "opacity-50 cursor-not-allowed" : ""
            }`}
            key={
              segments.length > 0
                ? segments[segments.length - 1]?.timestamp
                : "no-audio"
            }
          ></audio>
        </div>
      </aside>
    </div>
  );
}
