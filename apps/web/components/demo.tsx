"use client";

/**
 * @fileoverview Demo Component - Main interactive demo interface for the Intevia AI application
 * @module DemoSection
 * @description This component provides a comprehensive demo interface that allows users to:
 * - Share their screen and record audio (microphone + system audio)
 * - Get real-time AI analysis and transcription
 * - Interact with AI through various actions (answer, summary, search)
 * - View audio visualizations and keyword extraction
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  MicIcon,
  Loader2Icon,
  ClockIcon,
  ListCollapseIcon,
  SearchIcon,
  SendIcon,
} from "lucide-react";
import { Message } from "ai";
import { Input } from "@workspace/ui/components/input";
import { Markdown } from "./markdown";
import RealTimeAnalysis from "@/components/RealTimeAnalysis";
import AudioVisualizer from "./AudioVisualizer";
import { cn } from "@workspace/ui/lib/utils";
import { useSegmentRecorder } from "@/hooks/useSegmentRecorder";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";

/**
 * @interface AIContextData
 * @description Data structure for AI context containing audio inputs
 */
interface AIContextData {
  audioInputs?: { data: string; mimeType: string; label: string; }[];
}

/**
 * @interface Segment
 * @description Represents an audio segment with its blob data and timestamp
 */
interface Segment {
  blob: Blob;
  timestamp: number;
}

/**
 * @component DemoSection
 * @description Main demo component that provides screen sharing, audio recording, and AI analysis functionality
 */
export function DemoSection() {
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [systemAudioSegments, setSystemAudioSegments] = useState<Segment[]>([]);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isSessionActive, setIsSessionActive] = useState(false);
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

  const [micAnalyserNode, setMicAnalyserNode] = useState<AnalyserNode | null>(null);
  const [systemAnalyserNode, setSystemAnalyserNode] = useState<AnalyserNode | null>(null);

  const {
    start: startMicRecording,
    stop: stopMicRecording,
    mimeType: micMimeType,
    currentMicChunks,
  } = useSegmentRecorder();

  const startMicRef = useRef(startMicRecording);
  startMicRef.current = startMicRecording;
  const stopMicRef = useRef(stopMicRecording);
  stopMicRef.current = stopMicRecording;

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

  const gatherContext = async (): Promise<AIContextData | null> => {
    const lastMicSegment = segments.length > 0 ? segments[segments.length - 1] : null;
    const lastSystemSegment = systemAudioSegments.length > 0 ? systemAudioSegments[systemAudioSegments.length - 1] : null;
    const currentMicRecordingChunks = currentMicChunks;

    const blobsToProcess: { blob: Blob; type: string; label: string; }[] = [];

    if (lastMicSegment) {
      blobsToProcess.push({
        blob: lastMicSegment.blob,
        type: micMimeType,
        label: "microphone-last",
      });
    }
    if (lastSystemSegment) {
      blobsToProcess.push({
        blob: lastSystemSegment.blob,
        type: "audio/webm",
        label: "system-last",
      });
    }
    if (currentMicRecordingChunks.length > 0) {
      const currentBlob = new Blob(currentMicRecordingChunks, { type: micMimeType });
      if (currentBlob.size > 0) {
        blobsToProcess.push({
          blob: currentBlob,
          type: micMimeType,
          label: "microphone-current",
        });
      }
    }

    if (!blobsToProcess.length) return null;

    const audioInputs = await Promise.all(
      blobsToProcess.map(async ({ blob, type, label }) => {
        try {
          if (blob.size === 0) return null;
          const full = await blobToBase64(blob);
          const data = full.split(",")[1] || full;
          if (!data) return null;
          return { data, mimeType: type, label };
        } catch (error) {
          console.error(`Error converting blob (${label}) to base64:`, error);
          return null;
        }
      }),
    );

    const validAudioInputs = audioInputs.filter(Boolean) as {
      data: string;
      mimeType: string;
      label: string;
    }[];

    if (!validAudioInputs.length) return null;
    return { audioInputs: validAudioInputs };
  };

  const sendContextToAI = useCallback(
    async (action: "answer" | "summary" | "search" | "custom", customQuery?: string) => {
      if (isLoading || !isSessionActive) return;
      setIsLoading(true);

      const ctx = await gatherContext();
      if (!ctx) {
        setIsLoading(false);
        return;
      }

      const promptMap = {
        answer: "根據最近音訊中的對話內容，回答音訊中最後提出的問題。因為會有兩種音訊，一種是麥克風音訊，一種是系統音訊，請先回答麥克風音訊再回答系統音訊的問題。有必要請上網查詢。",
        summary: "提供最近音訊片段中捕捉到的對話內容的簡明摘要。請用中文回答。若是麥克風音訊沒有可總結的對話內容，請不用針對該音訊回答。",
        search: "根據最近音訊片段中討論的主題，建議相關的搜尋關鍵字或查找相關資訊。請用中文回答。若是麥克風音訊沒有可搜尋的對話內容，請不用針對該音訊回答。",
        custom: customQuery || "根據以下要求分析最近音訊片段中捕捉到的對話內容。請用中文回答。",
      };

      const displayPromptMap = {
        answer: "根據語音內容回答問題",
        summary: "根據過去語音內容產生摘要",
        search: "根據語音內容搜尋主題",
        custom: customPrompt,
      };

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: action === "custom" ? customPrompt : promptMap[action],
      };

      const displayMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: action === "custom" ? customPrompt : displayPromptMap[action],
      };

      setAiMessages((p) => [...p, displayMsg]);

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
        setAiMessages((p) => [
          ...p,
          {
            id: `err-ai-${Date.now()}`,
            role: "assistant",
            content: "[AI 錯誤] 無法處理您的請求。請檢查您的網路連線或稍後再試。音訊品質不佳也可能導致處理失敗。",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isSessionActive, segments, systemAudioSegments, customPrompt, micMimeType, currentMicChunks],
  );

  useEffect(() => {
    let t: NodeJS.Timeout;
    if (isSessionActive) {
      setRecordingDuration(0);
      t = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => clearInterval(t);
  }, [isSessionActive]);

  useEffect(() => {
    const h = (e: CustomEvent<Blob>) =>
      setSegments((p) => [...p, { blob: e.detail, timestamp: Date.now() }]);
    window.addEventListener("segment", h as EventListener);
    return () => window.removeEventListener("segment", h as EventListener);
  }, []);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  const handleTextResponse = useCallback((text: string) => {
    setAiMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.role === "assistant" && lastMessage.content.startsWith("[即時轉錄]")) {
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: [{ role: "user", content: `請用簡單易懂的方式解釋這個專業術語：${keyword}` }],
          data: {},
        }),
      });
      if (!response.ok) throw new Error("無法取得解釋");
      const data = await response.json();
      setAiMessages((prev) => [
        ...prev,
        {
          id: `explanation-${Date.now()}`,
          role: "assistant",
          content: `[${keyword} 的解釋] ${data.content}`,
        },
      ]);
    } catch (error) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err-explanation-${Date.now()}`,
          role: "assistant",
          content: `[錯誤] 無法取得 ${keyword} 的解釋。請檢查您的網路連線或稍後再試。`,
        },
      ]);
    } finally {
      setIsLoading(false);
      setSelectedKeyword(null);
    }
  }, []);

  const handleIsActiveChange = useCallback((isActive: boolean) => {
    setIsSessionActive(isActive);
    if (isActive) {
      setAiMessages([]);
      setKeywords([]);
      setSegments([]);
      setSystemAudioSegments([]);
      startMicRef.current();
    } else {
      stopMicRef.current();
    }
  }, []);

  const handleStreamsReady = useCallback(
    (streams: { mic: MediaStream | null; system: MediaStream | null; screen: MediaStream | null; }) => {
      if (streams.mic) {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(streams.mic);
        const analyser = audioCtx.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 256;
        source.connect(analyser);
        setMicAnalyserNode(analyser);
      } else {
        setMicAnalyserNode(null);
      }

      if (streams.system) {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(streams.system);
        const analyser = audioCtx.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 256;
        source.connect(analyser);
        setSystemAnalyserNode(analyser);
      } else {
        setSystemAnalyserNode(null);
      }

      if (streams.screen && screenPreviewRef.current) {
        const videoStream = new MediaStream(streams.screen.getVideoTracks());
        screenPreviewRef.current.srcObject = videoStream;
        screenPreviewRef.current.muted = true;
        screenPreviewRef.current.play().catch(console.error);
      } else if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = null;
      }
    },
    [],
  );

  return (
    <section id="demo">
      <div className="flex flex-col gap-16 mx-auto max-w-5xl p-6 mt-12 lg:mt-16">
        <div className="h-px w-full bg-border my-8"></div>
        <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
          Try our web demo!
        </h2>

        <div className="flex flex-1 overflow-hidden border rounded-lg shadow-lg bg-card max-h-[75vh]">
          <main className="flex flex-col flex-1 overflow-hidden">
            <div
              ref={messagesContainerRef}
              className="flex-1 p-4 space-y-4 overflow-y-auto bg-muted/30"
            >
              {aiMessages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    "p-3 rounded-lg text-sm border w-fit max-w-[85%]",
                    m.role === "user"
                      ? "bg-primary ml-auto text-primary-foreground"
                      : "bg-muted mr-auto text-foreground",
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
              {aiMessages.length === 0 && !isLoading && !isSessionActive && (
                <p className="text-sm text-center text-muted-foreground py-4">
                  點擊「開始錄製」以啟動 AI 助理並開始錄製。
                </p>
              )}
              {aiMessages.length === 0 && !isLoading && isSessionActive && (
                <p className="text-sm text-center text-muted-foreground py-4">
                  錄製中...。
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
                    isSessionActive ? "輸入自訂提示或問題…" : "請先開始錄製"
                  }
                  className="flex-grow"
                  disabled={isLoading || !isSessionActive}
                />
                <Button
                  type="submit"
                  variant="default"
                  size="icon"
                  disabled={isLoading || !isSessionActive || !customPrompt.trim()}
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
                    className={`flex h-3 w-3 rounded-full ${isSessionActive
                      ? isLoading
                        ? "bg-yellow-400"
                        : "bg-destructive animate-pulse"
                      : "bg-muted"
                      }`}
                  ></span>
                  {isLoading
                    ? "處理中..."
                    : isSessionActive
                      ? "錄製中"
                      : "錄製已停止"}
                </span>
                {isSessionActive && (
                  <span className="text-sm font-semibold tabular-nums text-foreground">
                    <ClockIcon className="inline h-4 w-4 mr-1 align-[-2px]" />
                    {formatTime(recordingDuration)}
                  </span>
                )}
              </div>
              <RealTimeAnalysis
                onTextResponse={handleTextResponse}
                onKeywords={handleKeywords}
                onStreamsReady={handleStreamsReady}
                onIsActiveChange={handleIsActiveChange}
              />
            </div>

            {keywords.length > 0 && (
              <div className="p-4 space-y-3 border-b border-border">
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
                    disabled={isLoading || !isSessionActive}
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

            <div className="p-4 space-y-3 border-b border-border">
              <h3 className="text-base font-semibold text-card-foreground">
                即時分析 (麥克風)
              </h3>
              <div className="py-2 w-full">
                <AudioVisualizer analyserNode={micAnalyserNode} height={40} />
              </div>
            </div>

            <div className="p-4 space-y-3 border-b border-border">
              <h3 className="text-base font-semibold text-card-foreground">
                即時分析 (系統音訊)
              </h3>
              <div className="py-2 w-full">
                <AudioVisualizer analyserNode={systemAnalyserNode} height={40} />
              </div>
            </div>

            {/* {isSessionActive && (
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
            )} */}
          </aside>
        </div>

        <div className="max-w-3xl mx-auto text-left border rounded-lg p-6 bg-card w-3/4 md:w-full">
          <h3 className="text-2xl font-semibold mb-4 text-center">
            操作說明
          </h3>
          <p className="text-muted-foreground text-center mb-6">
            本版本提供基礎核心功能，協助您初步感受我們的即時語音分析與互動能力。
          </p>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="w-full text-xl">使用建議</AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap w-full">
                <ul className="list-disc list-inside space-y-2 pl-4">
                  <li className="text-lg"><span className="text-lg font-bold">請使用電腦操作</span>，以確保功能穩定與完整體驗。</li>
                  <li className="text-lg"><span className="text-lg font-bold">建議使用 Chrome 瀏覽器</span>，並確認開啟麥克風與鏡頭權限。</li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="w-full text-xl">操作步驟</AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap w-full">
                <ol className="list-decimal list-inside space-y-2 pl-4">
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">點擊「開始錄製」</span>
                    <br />
                    系統將要求您選擇畫面來源，並請允許使用麥克風與攝影機。
                  </li>
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">開始對話或播放音訊</span>
                    <br />
                    開始對鏡頭說話，或播放任何語音/影片內容。
                  </li>
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">與 AI 互動</span>
                    <br />
                    觀察即時逐字稿、點擊關鍵字，或使用右側的 AI 動作按鈕。
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="w-full text-xl">功能介紹</AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap w-full">
                <p className="mb-2 pl-4 text-lg">當您開始說話，INTEVIA AI 將：</p>
                <ul className="list-disc list-inside space-y-2 pl-4">
                  <li className="text-lg">即時產生<span className="text-lg font-bold">逐字稿</span>。</li>
                  <li className="text-lg">顯示下方動態<span className="text-lg font-bold">關鍵字 Keyword</span>，可點擊查詢。</li>
                  <li className="text-lg">
                    提供 3 項互動工具列功能，可點擊使用：
                    <ul className="list-disc list-inside ml-4 mt-2">
                      <li className="text-lg mt-2"><span className="text-lg font-bold">回答問題</span>：針對內容自動生成回應。</li>
                      <li className="text-lg mt-2"><span className="text-lg font-bold">即時統整</span>：摘要最近段落的重點。</li>
                      <li className="text-lg mt-2"><span className="text-lg font-bold">查詢資料</span>：延伸查找相關資訊。</li>
                    </ul>
                  </li>
                </ul>
                <p className="mt-2 pl-4 text-lg">您也可以在輸入框中輸入任何 Prompt，自由提問或下指令。</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="w-full text-xl">使用情境</AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap w-full">
                <p className="mb-2 pl-4 text-lg">以下是推薦的使用情境，您也可以自由發揮：</p>
                <ol className="list-decimal list-inside space-y-2 pl-4">
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">背景播放影片 + 自言自語</span>
                    <br />
                    播放一段有聲的影片（例如演講、課程、Podcast），一邊提問、一邊看逐字稿變化並嘗試使用三個功能。
                  </li>
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">與朋友閒聊</span>
                    <br />
                    找朋友聊天或自己講話，分享近況或討論新聞，觀察 INTEVIA AI 如何即時處理內容，並測試功能按鈕。
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        </div>
      </div>
    </section>
  );
}
