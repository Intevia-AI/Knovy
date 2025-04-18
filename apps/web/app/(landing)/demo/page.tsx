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

// Updated: Expect only one audio input for the AI API
interface AIContextData {
  audioInput?: { data: string; mimeType: string };
}

// --- Constants -----------------------------------------------
const AUDIO_CHUNK_TIMESLICE_MS = 5000; // 5‑second chunks

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
  const screenStreamRef = useRef<MediaStream | null>(null); // Renamed from systemAudioStreamRef
  const micRecorderRef = useRef<MediaRecorder | null>(null);
  const screenAudioRecorderRef = useRef<MediaRecorder | null>(null); // Renamed from systemRecorderRef
  const audioPlayerRef = useRef<HTMLAudioElement>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null); // Added for video preview
  const realTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const sendContextToAIRef = useRef<(
    action: "real-time" | "answer" | "summary" | "search" | "custom",
    customQuery?: string
  ) => Promise<void>>(async () => {});

  // --- State --------------------------------------------------
  const [isRecording, setIsRecording] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isProcessingAudio, setIsProcessingAudio] = useState(false); // New state for audio processing
  const [micChunks, setMicChunks] = useState<MediaChunk[]>([]);
  const [screenAudioChunks, setScreenAudioChunks] = useState<MediaChunk[]>([]); // Renamed from systemChunks
  const [micDuration, setMicDuration] = useState(0); // in seconds
  const [finalMicUrl, setFinalMicUrl] = useState<string | null>(null);
  const [aiMessages, setAiMessages] = useState<Message[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isScreenSharing, setIsScreenSharing] = useState(false); // Added state for screen share

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

  // --- Audio Recording ---------------------------------------
  const setupRecorder = (
    stream: MediaStream,
    destState: React.Dispatch<React.SetStateAction<MediaChunk[]>>,
    ref: React.MutableRefObject<MediaRecorder | null>,
    label: "mic" | "screen" // Updated label
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

  // Renamed from startSystemAudioRecording
  const startScreenCapture = async (): Promise<boolean> => {
    if (screenStreamRef.current) return true; // Check screenStreamRef
    try {
      // Request video and audio
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = stream; // Store the full stream

      let audioStarted = false;
      let videoStarted = false;

      // Setup audio recording if audio track exists
      if (stream.getAudioTracks().length > 0) {
        const audioOnly = new MediaStream(stream.getAudioTracks());
        // Use renamed state setter and ref
        setupRecorder(audioOnly, setScreenAudioChunks, screenAudioRecorderRef, "screen");
        audioStarted = true;
      } else {
        console.warn("No audio track captured from screen share.");
      }

      // Setup video preview if video track exists
      if (stream.getVideoTracks().length > 0) {
        if (screenPreviewRef.current) {
          screenPreviewRef.current.srcObject = stream;
          screenPreviewRef.current.muted = true; // Mute preview locally
          screenPreviewRef.current.play().catch(e => console.error("Video play error:", e));
          setIsScreenSharing(true); // Set screen sharing state
          videoStarted = true;
        }
      } else {
        console.warn("No video track captured from screen share.");
        // Clean up stream if only audio was requested but failed, and no video either
        if (!audioStarted) cleanupStream(screenStreamRef);
      }

      // Return true if either audio or video capture started
      return audioStarted || videoStarted;
    } catch (e) {
      console.warn("Screen capture failed or cancelled", e);
      cleanupStream(screenStreamRef); // Ensure cleanup on error
      return false;
    }
  };

  const stopScreenCapture = () => {
    cleanupRecorder(screenAudioRecorderRef);
    cleanupStream(screenStreamRef);
    if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;
    setIsScreenSharing(false);
  };

  const stopAllRecording = () => {
    cleanupRecorder(micRecorderRef);
    cleanupRecorder(screenAudioRecorderRef); // Use renamed ref
    cleanupStream(micAudioStreamRef);
    cleanupStream(screenStreamRef); // Use renamed ref

    // Clear video preview
    if (screenPreviewRef.current) {
      screenPreviewRef.current.srcObject = null;
    }
    setIsScreenSharing(false); // Reset screen sharing state

    if (finalMicUrl) URL.revokeObjectURL(finalMicUrl);
    setIsRecording(false);
  };

  const toggleScreenShare = async () => {
    if (isLoading || isProcessingAudio) return;
    if (isScreenSharing) {
      stopScreenCapture();
    } else {
      if (!isRecording) {
        await startRecording();
      } else {
        await startScreenCapture();
      }
    }
  };

  // --- Start/Stop button handlers ----------------------------
  const startRecording = async () => {
    if (isRecording || isLoading || isProcessingAudio) return; // Check isProcessingAudio
    setIsLoading(true);
    setAiMessages([]);
    setMicChunks([]);
    setScreenAudioChunks([]); // Use renamed state setter
    const micOK = await startMicRecording();
    const screenOK = await startScreenCapture(); // Call renamed function
    if (micOK || screenOK) { // Check screenOK
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
    // 1) Select raw chunks (mic preferred)
    const rawChunks = micChunks.length ? micChunks : screenAudioChunks;
    if (!rawChunks.length) return null;

    // 2) Merge into one blob
    const originalMimeType = rawChunks[0]?.blob.type || getSupportedMimeType("audio");
    const mergedBlob = new Blob(rawChunks.map(c => c.blob), { type: originalMimeType });
    console.log("Merged raw blob size:", mergedBlob.size, "Type:", originalMimeType);

    setIsProcessingAudio(true); // Set processing state
    try {
      // 3) Convert merged blob to base64
      const base64Full = await blobToBase64(mergedBlob);
      const base64Data = base64Full.split(",")[1]; // Extract data part

      if (!base64Data) {
        throw new Error("Failed to convert blob to base64 data.");
      }

      // 4) Send to server for processing (trimming, encoding)
      const processResponse = await fetch("/api/process-audio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          audioData: base64Data,
          originalMimeType: originalMimeType,
        }),
      });

      if (!processResponse.ok) {
        const errorBody = await processResponse.text();
        throw new Error(`Audio processing API failed: ${processResponse.status} ${errorBody}`);
      }

      const { processedAudioData, processedMimeType } = await processResponse.json();

      if (!processedAudioData || !processedMimeType) {
        throw new Error("Invalid response from audio processing API.");
      }

      console.log("Received processed audio. MimeType:", processedMimeType);

      // 5) Use processed data for AI context
      ctx.audioInput = { data: processedAudioData, mimeType: processedMimeType };
      return ctx;
    } catch (err) {
      console.error("gatherContext audio processing failed:", err);
      setAiMessages(p => [...p, { id: `err-proc-${Date.now()}`, role: "assistant", content: `[Audio Processing Error] ${err instanceof Error ? err.message : String(err)}` }]);
      return null; // Indicate failure
    } finally {
      setIsProcessingAudio(false); // Clear processing state
    }
  };

  // --- AI interaction ----------------------------------------
  const sendContextToAI = useCallback<(
    action: "real-time" | "answer" | "summary" | "search" | "custom",
    customQuery?: string
  ) => Promise<void>>(async (action, customQuery) => {
    if (isLoading || isProcessingAudio) return; // Check isProcessingAudio
    setIsLoading(true); // Keep isLoading for the AI part

    const ctx = await gatherContext(); // This now includes the API call and sets isProcessingAudio

    if (!ctx) {
      // Error message is now potentially set within gatherContext
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
        body: JSON.stringify({ messages: [userMsg], data: ctx }), // Send the processed context
      });
      if (!res.ok) throw new Error(await res.text());
      const ai: Message = await res.json();
      setAiMessages(p => [...p, { id: ai.id || `ai-${Date.now()}`, role: "assistant", content: ai.content }]);
    } catch (e: any) {
      setAiMessages(p => [...p, { id: `err-ai-${Date.now()}`, role: "assistant", content: `[AI error] ${e.message || e}` }]);
    } finally {
      setIsLoading(false); // Clear AI loading state
    }
  }, [isLoading, isProcessingAudio, micChunks, screenAudioChunks, customPrompt]); // Add isProcessingAudio dependency

  // expose ref
  useEffect(() => { sendContextToAIRef.current = sendContextToAI; }, [sendContextToAI]);

  // --- UI -----------------------------------------------------
  return (
    <div className="container mx-auto max-w-3xl py-8 px-4 space-y-6">
      <h1 className="text-3xl font-bold text-center">AI Meeting Assistant – Audio & Screen</h1>

      <Card className="flex items-center justify-between gap-2">
        {/* status & record button */}
        <CardHeader className="flex-1">
          <CardTitle className="flex flex-wrap items-center justify-between gap-4">
            <span className="flex items-center gap-2">
              <span className={`flex h-3 w-3 rounded-full ${isRecording ? (isLoading || isProcessingAudio ? "bg-warning" : "bg-destructive animate-pulse") : "bg-muted"}`}></span>
              Status: {isProcessingAudio ? "Processing Audio…" : isLoading ? "Calling AI…" : isRecording ? `Recording ${isScreenSharing ? " (Mic + Screen)" : "(Mic Only)"}` : "Stopped"}
            </span>
            {isRecording && (
              <span className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                <ClockIcon className="h-4 w-4 mr-1" /> {formatTime(micDuration)}
              </span>) }
          </CardTitle>
        </CardHeader>
        <CardContent className="flex gap-2">
          {/* existing Start/Stop */}
          {isRecording ? (
            <Button variant="destructive" size="sm" onClick={stopRecording} disabled={isLoading||isProcessingAudio}>
              <PauseIcon /> Stop
            </Button>
          ) : (
            <Button variant="default" size="sm" onClick={startRecording} disabled={isLoading||isProcessingAudio}>
              <PlayIcon /> Start
            </Button>
          )}
          {/* new Toggle Screen button */}
          <Button
            variant={isScreenSharing ? "destructive" : "outline"}
            size="sm"
            onClick={toggleScreenShare}
            disabled={isRecording || isLoading || isProcessingAudio}
          >
            {isScreenSharing ? <PauseIcon /> : <PlayIcon />} {isScreenSharing ? "Stop Screen" : "Share Screen"}
          </Button>
        </CardContent>
      </Card>

      {/* move preview up so it’s always visible when sharing */}
      {isScreenSharing && (
        <Card>
          <CardHeader>
            <CardTitle>Live Screen Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <video
              ref={screenPreviewRef}
              className="w-full aspect-video rounded border"
              autoPlay
              playsInline
              muted
            />
          </CardContent>
        </Card>
      )}

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
              <Button key={action} variant="outline" size="sm" disabled={isLoading||isProcessingAudio||!isRecording} onClick={()=>sendContextToAI(action as any)}><Icon className="h-4 w-4 mr-2"/>{label}</Button>
            ))}
          </div>

          <form onSubmit={e=>{e.preventDefault(); if(!customPrompt.trim()) return; sendContextToAI("custom", customPrompt); setCustomPrompt("");}} className="flex gap-2 mb-4">
            <Input value={customPrompt} onChange={e=>setCustomPrompt(e.target.value)} placeholder="Custom prompt…" className="flex-grow" disabled={isLoading||isProcessingAudio||!isRecording}/>
            <Button type="submit" variant="default" size="icon" disabled={isLoading||isProcessingAudio||!isRecording||!customPrompt.trim()}><SendIcon className="h-4 w-4"/></Button>
          </form>

          <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 border border-border rounded p-2 bg-background">
            {aiMessages.map(m=> (
              <div key={m.id} className="p-2 rounded text-sm border-l-4 border-border bg-muted text-foreground"><Markdown>{m.content}</Markdown></div>
            ))}
            {(isLoading || isProcessingAudio) && <div className="flex items-center text-sm text-muted-foreground"><Loader2Icon className="h-4 w-4 mr-2 animate-spin"/>{isProcessingAudio ? "Processing audio..." : "Waiting for AI..."}</div>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
