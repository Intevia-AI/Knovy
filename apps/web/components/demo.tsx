"use client";

/**
 * @fileoverview Demo Component - Main interactive demo interface for the Knovy application
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@workspace/ui/components/accordion";
import { useLanguage } from "@/context/language-context";

/**
 * @interface AIContextData
 * @description Data structure for AI context containing audio inputs
 */
interface AIContextData {
  audioInputs?: { data: string; mimeType: string; label: string }[];
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
  const { t } = useLanguage();
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
      reader.onload = () => (typeof reader.result === "string" ? res(reader.result) : rej());
      reader.onerror = rej;
      reader.readAsDataURL(b);
    });

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const gatherContext = useCallback(async (): Promise<AIContextData | null> => {
    const lastMicSegment = segments.length > 0 ? segments[segments.length - 1] : null;
    const lastSystemSegment =
      systemAudioSegments.length > 0 ? systemAudioSegments[systemAudioSegments.length - 1] : null;
    const currentMicRecordingChunks = currentMicChunks;

    console.log(
      "[Demo] gatherContext - Mic segments:",
      segments.length,
      "System segments:",
      systemAudioSegments.length,
    );

    const blobsToProcess: { blob: Blob; type: string; label: string }[] = [];

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
  }, [segments, systemAudioSegments, currentMicChunks, micMimeType]);

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
        answer: t("demo.prompt.answer"),
        summary: t("demo.prompt.summary"),
        search: t("demo.prompt.search"),
        custom: customQuery || t("demo.prompt.custom"),
      };

      const displayPromptMap = {
        answer: t("demo.display_prompt.answer"),
        summary: t("demo.display_prompt.summary"),
        search: t("demo.display_prompt.search"),
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
      } catch {
        setAiMessages((p) => [
          ...p,
          {
            id: `err-ai-${Date.now()}`,
            role: "assistant",
            content: t("demo.ai_error"),
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isSessionActive, customPrompt, isLoading, gatherContext, t],
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
    const h = (e: CustomEvent<Blob>) => {
      console.log("[Demo] Received system audio segment:", e.detail.size, "bytes");
      setSystemAudioSegments((p) => [...p, { blob: e.detail, timestamp: Date.now() }]);
    };
    window.addEventListener("systemAudioSegment", h as EventListener);
    return () => window.removeEventListener("systemAudioSegment", h as EventListener);
  }, []);

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  const handleTextResponse = useCallback(
    (text: string) => {
      setAiMessages((prev) => {
        const lastMessage = prev[prev.length - 1];
        if (
          lastMessage?.role === "assistant" &&
          lastMessage.content.startsWith(t("demo.transcription_prefix"))
        ) {
          return [...prev.slice(0, -1), { ...lastMessage, content: lastMessage.content + text }];
        } else {
          return [
            ...prev,
            {
              id: `realtime-${Date.now()}`,
              role: "assistant",
              content: t("demo.transcription_prefix") + ` ${text}`,
            },
          ];
        }
      });
    },
    [t],
  );

  const handleKeywords = useCallback((newKeywords: string[]) => {
    setKeywords((prev) => {
      const uniqueNewKeywords = newKeywords.filter((k) => !prev.includes(k));
      return [...prev, ...uniqueNewKeywords];
    });
  }, []);

  const handleKeywordClick = useCallback(
    async (keyword: string) => {
      setSelectedKeyword(keyword);
      setIsLoading(true);
      try {
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [
              {
                role: "user",
                content: t("demo.keyword_explanation.prompt").replace("{keyword}", keyword),
              },
            ],
            data: {},
          }),
        });
        if (!response.ok) throw new Error(t("demo.keyword_explanation.error_fetch"));
        const data = await response.json();
        setAiMessages((prev) => [
          ...prev,
          {
            id: `explanation-${Date.now()}`,
            role: "assistant",
            content:
              t("demo.keyword_explanation_prefix").replace("{keyword}", keyword) + data.content,
          },
        ]);
      } catch {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `err-explanation-${Date.now()}`,
            role: "assistant",
            content: t("demo.keyword_explanation_error").replace("{keyword}", keyword),
          },
        ]);
      } finally {
        setIsLoading(false);
        setSelectedKeyword(null);
      }
    },
    [t],
  );

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
    (streams: {
      mic: MediaStream | null;
      system: MediaStream | null;
      screen: MediaStream | null;
    }) => {
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
    <section id="demo" className="hidden lg:block">
      <div className="flex flex-col gap-16 mx-auto max-w-5xl p-6 mt-12 lg:mt-16">
        <div className="h-px w-full bg-border my-8"></div>
        <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
          {t("demo.title")}
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
                  {t("demo.loading")}
                </div>
              )}
              {aiMessages.length === 0 && !isLoading && !isSessionActive && (
                <p className="text-sm text-center text-muted-foreground py-4">
                  {t("demo.start_prompt")}
                </p>
              )}
              {aiMessages.length === 0 && !isLoading && isSessionActive && (
                <p className="text-sm text-center text-muted-foreground py-4">
                  {t("demo.recording_prompt")}
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
                    isSessionActive
                      ? t("demo.custom_prompt_placeholder")
                      : t("demo.custom_prompt_disabled_placeholder")
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
                    className={`flex h-3 w-3 rounded-full ${
                      isSessionActive
                        ? isLoading
                          ? "bg-yellow-400"
                          : "bg-destructive animate-pulse"
                        : "bg-muted"
                    }`}
                  ></span>
                  {isLoading
                    ? t("demo.status.processing")
                    : isSessionActive
                      ? t("demo.status.recording")
                      : t("demo.status.stopped")}
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
                  {t("demo.keywords_detected")}
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
                {t("demo.ai_actions")}
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { action: "answer", label: t("demo.action.answer"), icon: MicIcon },
                  { action: "summary", label: t("demo.action.summary"), icon: ListCollapseIcon },
                  { action: "search", label: t("demo.action.search"), icon: SearchIcon },
                ].map(({ action, label, icon: Icon }) => (
                  <Button
                    key={action}
                    variant="outline"
                    size="sm"
                    disabled={isLoading || !isSessionActive}
                    onClick={() => sendContextToAI(action as "answer" | "summary" | "search")}
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
                {t("demo.analysis.mic")}
              </h3>
              <div className="py-2 w-full">
                <AudioVisualizer analyserNode={micAnalyserNode} height={40} />
              </div>
            </div>

            <div className="p-4 space-y-3 border-b border-border">
              <h3 className="text-base font-semibold text-card-foreground">
                {t("demo.analysis.system")}
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

        <div className="max-w-3xl mx-auto text-left border rounded-lg p-6 bg-card w-full">
          <h3 className="text-2xl font-semibold mb-4 text-center">
            {t("demo.instructions.title")}
          </h3>
          <p className="text-muted-foreground text-center mb-6">
            {t("demo.instructions.description")}
          </p>
          <Accordion type="single" collapsible className="w-full">
            <AccordionItem value="item-1">
              <AccordionTrigger className="w-full text-xl">
                {t("demo.instructions.recommendations.title")}
              </AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap w-full">
                <ul className="list-disc list-inside space-y-2 pl-4">
                  <li className="text-lg">
                    <span className="text-lg font-bold">
                      {t("demo.instructions.recommendations.item1")}
                    </span>
                    {t("demo.instructions.recommendations.item1_suffix")}
                  </li>
                  <li className="text-lg">
                    <span className="text-lg font-bold">
                      {t("demo.instructions.recommendations.item2")}
                    </span>
                    {t("demo.instructions.recommendations.item2_suffix")}
                  </li>
                </ul>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-2">
              <AccordionTrigger className="w-full text-xl">
                {t("demo.instructions.steps.title")}
              </AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap w-full">
                <ol className="list-decimal list-inside space-y-2 pl-4">
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">
                      {t("demo.instructions.steps.item1_action")}
                    </span>
                    <br />
                    {t("demo.instructions.steps.item1_description")}
                  </li>
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">
                      {t("demo.instructions.steps.item2_action")}
                    </span>
                    <br />
                    {t("demo.instructions.steps.item2_description")}
                  </li>
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">
                      {t("demo.instructions.steps.item3_action")}
                    </span>
                    <br />
                    {t("demo.instructions.steps.item3_description")}
                  </li>
                </ol>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-3">
              <AccordionTrigger className="w-full text-xl">
                {t("demo.instructions.features.title")}
              </AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap w-full">
                <p className="mb-2 pl-4 text-lg">{t("demo.instructions.features.intro")}</p>
                <ul className="list-disc list-inside space-y-2 pl-4">
                  <li className="text-lg">
                    {t("demo.instructions.features.item1_part1")}
                    <span className="text-lg font-bold">
                      {t("demo.instructions.features.item1_part2")}
                    </span>
                    {t("demo.instructions.features.item1_part3")}
                  </li>
                  <li className="text-lg">
                    {t("demo.instructions.features.item2_part1")}
                    <span className="text-lg font-bold">
                      {t("demo.instructions.features.item2_part2")}
                    </span>
                    {t("demo.instructions.features.item2_part3")}
                  </li>
                  <li className="text-lg">
                    {t("demo.instructions.features.item3_intro")}
                    <ul className="list-disc list-inside ml-4 mt-2">
                      <li className="text-lg mt-2">
                        <span className="text-lg font-bold">
                          {t("demo.instructions.features.item3_action1")}
                        </span>
                        {t("demo.instructions.features.item3_action1_desc")}
                      </li>
                      <li className="text-lg mt-2">
                        <span className="text-lg font-bold">
                          {t("demo.instructions.features.item3_action2")}
                        </span>
                        {t("demo.instructions.features.item3_action2_desc")}
                      </li>
                      <li className="text-lg mt-2">
                        <span className="text-lg font-bold">
                          {t("demo.instructions.features.item3_action3")}
                        </span>
                        {t("demo.instructions.features.item3_action3_desc")}
                      </li>
                    </ul>
                  </li>
                </ul>
                <p className="mt-2 pl-4 text-lg">{t("demo.instructions.features.outro")}</p>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="item-4">
              <AccordionTrigger className="w-full text-xl">
                {t("demo.instructions.scenarios.title")}
              </AccordionTrigger>
              <AccordionContent className="whitespace-pre-wrap w-full">
                <p className="mb-2 pl-4 text-lg">{t("demo.instructions.scenarios.intro")}</p>
                <ol className="list-decimal list-inside space-y-2 pl-4">
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">
                      {t("demo.instructions.scenarios.item1_title")}
                    </span>
                    <br />
                    {t("demo.instructions.scenarios.item1_desc")}
                  </li>
                  <li className="text-lg my-4">
                    <span className="text-lg font-bold">
                      {t("demo.instructions.scenarios.item2_title")}
                    </span>
                    <br />
                    {t("demo.instructions.scenarios.item2_desc")}
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
