"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@workspace/ui/components/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@workspace/ui/components/card";
import {
  MicIcon,
  PauseIcon,
  PlayIcon,
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

// --- Types ----------------------------------------------------
interface MediaChunk {
  blob: Blob;
  timestamp: number;
}

interface AIContextData {
  micAudio?: { data: string; mimeType: string };
  systemAudio?: { data: string; mimeType: string };
}

// --- Constants -----------------------------------------------
const AUDIO_CHUNK_TIMESLICE_MS = 5000; // 5‑second chunks
const MAX_AUDIO_BYTES_FOR_AI = 5 * 1024 * 1024; // 5 MB

// Helper to choose a supported MIME type for MediaRecorder
const getSupportedMimeType = (kind: "audio"): string => {
  const audioTypes = [
    "audio/webm;codecs=opus",
    "audio/ogg;codecs=opus",
    "audio/webm",
  ];
  for (const type of audioTypes) if (MediaRecorder.isTypeSupported(type)) return type;
  return "audio/webm"; // fallback
};

// =============================================================
export default function Page() {
  // --- Refs ----------------------------------------------------
  const micAudioStreamRef = useRef<MediaStream | null>(null);
  const systemAudioStreamRef = useRef<MediaStream | null>(null);
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const systemRecorderRef = useRef<MediaRecorder | null>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const realTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sendContextToAIRef = useRef<(
    action: "real-time" | "answer" | "summary" | "search" | "custom",
    customQuery?: string
  ) => Promise<void>>(async () => {});

  // --- State --------------------------------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [micChunks, setMicChunks] = useState<MediaChunk[]>([]);
  const [systemChunks, setSystemChunks] = useState<MediaChunk[]>([]);
  const [micDuration, setMicDuration] = useState(0); // in seconds
  const [finalMicUrl, setFinalMicUrl] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");

  // --- Utils --------------------------------------------------
  const cleanupStream = (ref: React.MutableRefObject<MediaStream | null>) => {
    ref.current?.getTracks().forEach(t => t.stop());
    ref.current = null;
  };
  const cleanupRecorder = (ref: React.MutableRefObject<MediaRecorder | null>) => {
    if (ref.current && ref.current.state !== "inactive") ref.current.stop();
    ref.current = null;
  };
  const blobToBase64 = (b: Blob): Promise<string> => new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? res(reader.result) : rej();
    reader.onerror = rej;
    reader.readAsDataURL(b);
  });
  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Collect the last valid chunks whose total size ≤ limit (avoid slicing raw bytes)
  const buildLimitedBlob = (chunks: MediaChunk[], mime: string): Blob | null => {
    if (!chunks.length) return null;
    let size = 0;
    const selected: Blob[] = [];
    for (let i = chunks.length - 1; i >= 0; i--) {
      const blob= chunks[i]?.blob
      if (!blob) continue;
      if (size + blob.size > MAX_AUDIO_BYTES_FOR_AI) break;
      selected.unshift(blob);
      size += blob.size;
    }
    return selected.length ? new Blob(selected, { type: mime }) : null;
  };

  // --- Audio Recording ---------------------------------------
  const setupRecorder = (
    stream: MediaStream,
    destState: React.Dispatch<React.SetStateAction<MediaChunk[]>>,
    ref: React.MutableRefObject<MediaRecorder | null>,
    label: "mic" | "system"
  ) => {
    const mime = getSupportedMimeType("audio");
    const rec = new MediaRecorder(stream, { mimeType: mime });
    rec.ondataavailable = e => {
      if (e.data.size > 0) destState(p => [...p, { blob: e.data, timestamp: Date.now() }]);
    };
    rec.onerror = e => console.error(`${label} recorder error`, e);
    rec.start(AUDIO_CHUNK_TIMESLICE_MS);
    ref.current = rec;
  };

  const startMicRecording = async (): Promise<boolean> => {
    if (micRecorderRef.current) return true;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micAudioStreamRef.current = stream;
      setupRecorder(stream, setMicChunks, micRecorderRef, "mic");
      setMicDuration(0);
      return true;
    } catch (e) {
      console.error("mic getUserMedia error", e);
      return false;
    }
  };

  const startSystemAudioRecording = async (): Promise<boolean> => {
    if (systemRecorderRef.current) return true;
    try {
      // NOTE: on most browsers this triggers the screen‑share dialog; user can choose "Chrome Tab" to capture tab audio.
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: false, audio: true });
      if (stream.getAudioTracks().length === 0) return false;
      const audioOnly = new MediaStream(stream.getAudioTracks());
      systemAudioStreamRef.current = audioOnly;
      setupRecorder(audioOnly, setSystemChunks, systemRecorderRef, "system");
      return true;
    } catch (e) {
      console.warn("system audio capture unavailable", e);
      return false;
    }
  };

  const stopAllRecording = () => {
    cleanupRecorder(micRecorderRef);
    cleanupRecorder(systemRecorderRef);
    cleanupStream(micAudioStreamRef);
    cleanupStream(systemAudioStreamRef);
    if (finalMicUrl) URL.revokeObjectURL(finalMicUrl);
    setIsRecording(false);
  };

  // --- Start/Stop button handlers ----------------------------
  const startRecording = async () => {
    if (isRecording || isLoading) return;
    setIsLoading(true);
    setAiMessages([]);
    setMicChunks([]);
    setSystemChunks([]);
    const micOK = await startMicRecording();
    const sysOK = await startSystemAudioRecording();
    if (micOK || sysOK) {
      setIsRecording(true);
      // mic duration timer
      const timer = setInterval(() => setMicDuration(d => d + 1), 1000);
      realTimeIntervalRef.current = timer;
    } else {
      stopAllRecording();
    }
    setIsLoading(false);
  };

  const stopRecording = () => {
    stopAllRecording();
    // build final mic URL for playback
    if (micChunks.length) {
      const mime = micChunks[0]?.blob.type || getSupportedMimeType("audio");
      const blob = new Blob(micChunks.map(c => c.blob), { type: mime });
      setFinalMicUrl(URL.createObjectURL(blob));
    }
    clearInterval(realTimeIntervalRef.current!);
    setMicDuration(0);
  };

  // --- Context builder ---------------------------------------
  const gatherContext = async (): Promise<AIContextData | null> => {
    const ctx: AIContextData = {};

    if (micChunks.length) {
      const mime = micChunks[0]?.blob.type || getSupportedMimeType("audio");
      const micBlob = buildLimitedBlob(micChunks, mime);
      if (micBlob) ctx.micAudio = { data: (await blobToBase64(micBlob)).split(",")[1]!, mimeType: micBlob.type };
    }
    if (systemChunks.length) {
      const mime = systemChunks[0]?.blob.type || getSupportedMimeType("audio");
      const sysBlob = buildLimitedBlob(systemChunks, mime);
      if (sysBlob) ctx.systemAudio = { data: (await blobToBase64(sysBlob)).split(",")[1]!, mimeType: sysBlob.type };
    }

    return Object.keys(ctx).length ? ctx : null;
  };

  // --- AI interaction ----------------------------------------
  const sendContextToAI = useCallback<(
    action: "real-time" | "answer" | "summary" | "search" | "custom",
    customQuery?: string
  ) => Promise<void>>(async (action, customQuery) => {
    if (isLoading) return;
    setIsLoading(true);
    const ctx = await gatherContext();
    if (!ctx) {
      setAiMessages(p => [...p, { id: `err-noctx-${Date.now()}`, role: "assistant", content: "[No audio context yet – record longer]" }]);
      setIsLoading(false);
      return;
    }
    const promptMap: Record<typeof action, string> = {
      "real-time": "Analyze the latest audio context and highlight keywords or action items concisely.",
      answer: "Based on the recent audio, answer the user's implicit question.",
      summary: "Provide a concise bullet summary of the recent discussion.",
      search: "Suggest useful search queries for the topics mentioned in the audio.",
      custom: customQuery || "Please analyze the audio context as requested.",
    } as const;
    const userMsg: Message = { id: `user-${Date.now()}`, role: "user", content: action === "custom" ? customPrompt : promptMap[action] };
    if (action !== "real-time") setAiMessages(p => [...p, userMsg]);

    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [userMsg], data: ctx }),
      });
      if (!res.ok) throw new Error(await res.text());
      const ai: Message = await res.json();
      setAiMessages(p => [...p, { id: ai.id || `ai-${Date.now()}`, role: "assistant", content: ai.content }]);
    } catch (e: any) {
      setAiMessages(p => [...p, { id: `err-ai-${Date.now()}`, role: "assistant", content: `[AI error] ${e.message || e}` }]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, micChunks, systemChunks, customPrompt]);

  // expose ref
  useEffect(() => { sendContextToAIRef.current = sendContextToAI; }, [sendContextToAI]);

  // --- UI -----------------------------------------------------
  return (
    <div className="container mx-auto max-w-3xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">AI Meeting Assistant – Audio Only</h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span className={`flex h-3 w-3 rounded-full ${isRecording ? (isLoading ? "bg-yellow-500" : "bg-red-500 animate-pulse") : "bg-slate-400"}`}></span>
              Status: {isLoading ? "Processing…" : isRecording ? "Recording" : "Stopped"}
            </span>
            {isRecording && (
              <span className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                <ClockIcon className="h-4 w-4 mr-1" /> {formatTime(micDuration)}
              </span>) }
            <div className="flex gap-2">
              {isRecording ? (
                <Button variant="destructive" size="sm" disabled={isLoading} onClick={stopRecording}><PauseIcon className="h-4 w-4 mr-2"/>Stop</Button>
              ) : (
                <Button variant="default" size="sm" disabled={isLoading} onClick={startRecording}>{isLoading ? <Loader2Icon className="h-4 w-4 mr-2 animate-spin"/> : <PlayIcon className="h-4 w-4 mr-2"/>}Start</Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="mb-6">
        <CardContent className="space-y-4">
          <div>
            <h3 className="font-medium text-sm mb-1">Mic Audio Playback (after stop)</h3>
            <audio ref={audioPlayerRef} controls src={finalMicUrl ?? undefined} className={`w-full ${!finalMicUrl ? "opacity-50" : ""}`}></audio>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-4">
            <span>AI Assistant</span>
            <RealTimeAnalysis onTextResponse={txt => setAiMessages(p => [...p, { id:`rt-${Date.now()}`, role:"assistant", content:`[Real-time] ${txt}` }]) } onKeywords={()=>{}}/>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            {[{action:"answer",label:"AI Answer",icon:MicIcon},{action:"summary",label:"AI Summary",icon:ListCollapseIcon},{action:"search",label:"AI Topics",icon:SearchIcon}].map(({action,label,icon:Icon})=> (
              <Button key={action} variant="outline" size="sm" disabled={isLoading||!isRecording} onClick={()=>sendContextToAI(action as any)}><Icon className="h-4 w-4 mr-2"/>{label}</Button>
            ))}
          </div>

          <form onSubmit={e=>{e.preventDefault(); if(!customPrompt.trim()) return; sendContextToAI("custom", customPrompt); setCustomPrompt("");}} className="flex gap-2 mb-4">
            <Input value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} placeholder="Custom prompt…" className="flex-grow" disabled={isLoading||!isRecording}/>
            <Button type="submit" variant="default" size="icon" disabled={isLoading||!isRecording||!customPrompt.trim()}><SendIcon className="h-4 w-4"/></Button>
          </form>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 border rounded p-2 bg-white dark:bg-black">
            {aiMessages.map(m=> (
              <div key={m.id} className="p-2 rounded text-sm border-l-4 bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200"><Markdown>{m.content}</Markdown></div>
            ))}
            {isLoading && <div className="flex items-center text-sm text-slate-500"><Loader2Icon className="h-4 w-4 mr-2 animate-spin"/>Waiting…</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
