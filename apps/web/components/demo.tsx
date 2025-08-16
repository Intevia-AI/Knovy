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
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@workspace/ui/components/accordion";

/**
 * @interface AIContextData
 * @description Data structure for AI context containing audio inputs
 * @property {Array} [audioInputs] - Array of audio input objects with data, mimeType, and label
 */
interface AIContextData {
  audioInputs?: { data: string; mimeType: string; label: string; }[];
}

/**
 * @interface Segment
 * @description Represents an audio segment with its blob data and timestamp
 * @property {Blob} blob - The audio blob data
 * @property {number} timestamp - Unix timestamp when the segment was created
 */
interface Segment {
  blob: Blob;
  timestamp: number;
}

/**
 * @component DemoSection
 * @description Main demo component that provides screen sharing, audio recording, and AI analysis functionality
 * 
 * @features
 * - Screen sharing with system audio capture
 * - Microphone recording with real-time analysis
 * - AI-powered transcription and analysis
 * - Keyword extraction and explanation
 * - Audio visualization for both microphone and system audio
 * - Multiple AI actions: answer questions, generate summaries, search topics
 * - Custom prompt input for flexible AI interaction
 * 
 * @returns {JSX.Element} The complete demo interface
 * 
 * @example
 * ```tsx
 * <DemoSection />
 * ```
 */
export function DemoSection() {
  // --- Refs: Used to persist values across renders without causing re-renders ---
  const screenStreamRef = useRef<MediaStream | null>(null); // Holds the screen share stream (video + system audio)
  const screenAudioRecorderRef = useRef<MediaRecorder | null>(null); // MediaRecorder for system audio
  const systemAudioChunksRef = useRef<Blob[]>([]); // Chunks of system audio for segmenting
  const systemAudioTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer for segmenting system audio
  const audioPlayerRef = useRef<HTMLAudioElement>(null); // (Unused in main UI, for audio playback)
  const screenPreviewRef = useRef<HTMLVideoElement>(null); // For showing screen preview
  const messagesContainerRef = useRef<HTMLDivElement>(null); // For auto-scrolling chat/messages
  // Ref to always have latest sendContextToAI function for event handlers
  const sendContextToAIRef = useRef<
    (
      action: "real-time" | "answer" | "summary" | "search" | "custom",
      customQuery?: string,
    ) => Promise<void>
  >(async () => { });
  // For mic audio visualization (Web Audio API context and source node)
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // System audio visualization (Web Audio API context and source node)
  const systemAudioContextRef = useRef<AudioContext | null>(null);
  const systemAudioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [systemAnalyserNode, setSystemAnalyserNode] = useState<AnalyserNode | null>(null); // For system audio visualization
  const [currentSystemAudioStream, setCurrentSystemAudioStream] = useState<MediaStream | null>(null); // For passing to visualizer

  // --- State: React state for UI and logic ---
  const [isLoading, setIsLoading] = useState(false); // True when waiting for AI response
  const [segments, setSegments] = useState<Segment[]>([]); // Mic audio segments (for context)
  const [systemAudioSegments, setSystemAudioSegments] = useState<Segment[]>([]); // System audio segments (for context)
  const [recordingDuration, setRecordingDuration] = useState(0); // Elapsed time for UI
  const [aiMessages, setAiMessages] = useState<Message[]>([]); // Chat/AI messages for display
  const [customPrompt, setCustomPrompt] = useState(""); // User's custom prompt input
  const [isScreenSharing, setIsScreenSharing] = useState(false); // True if currently sharing/recording
  const [keywords, setKeywords] = useState<string[]>([]); // Extracted keywords from AI
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null); // For showing keyword explanation loading
  const [systemAudioMimeType, setSystemAudioMimeType] = useState<string>(""); // Chosen mime type for system audio recording
  const [micAnalyserNode, setMicAnalyserNode] = useState<AnalyserNode | null>(null); // For mic audio visualization

  // --- Custom hook for mic recording and chunking ---
  // Provides start/stop, mimeType, micStream, and current chunks
  const {
    start: startMicRecording,
    stop: stopMicRecording,
    mimeType: micMimeType,
    micStream,
    currentMicChunks, // Array of Blob parts for current mic segment
  } = useSegmentRecorder();

  // --- Utility: Apply a low-pass filter to a MediaStream (removes high-frequency noise) ---
  const applyNoiseFilter = (stream: MediaStream): MediaStream => {
    const audioCtx = new AudioContext(); // Create a new audio context for processing
    const source = audioCtx.createMediaStreamSource(stream); // Use the input stream as a source node
    const filter = audioCtx.createBiquadFilter(); // Create a biquad filter node
    filter.type = "lowpass"; // Set filter type to lowpass (attenuates high frequencies)
    filter.frequency.setValueAtTime(3000, audioCtx.currentTime); // Set cutoff frequency to 3kHz
    source.connect(filter); // Route input through the filter
    const dest = audioCtx.createMediaStreamDestination(); // Create a destination node that outputs a MediaStream
    filter.connect(dest); // Route filtered audio to the destination
    return dest.stream; // Return the processed stream
  };

  // --- Utility: Stop and clean up a MediaStream (stops all tracks) ---
  const cleanupStream = (ref: React.MutableRefObject<MediaStream | null>) => {
    ref.current?.getTracks().forEach((t) => t.stop()); // Stop all tracks
    ref.current = null; // Clear the ref
  };

  // --- Utility: Stop and clean up a MediaRecorder ---
  const cleanupRecorder = (
    ref: React.MutableRefObject<MediaRecorder | null>,
  ) => {
    if (ref.current && ref.current.state !== "inactive") {
      ref.current.ondataavailable = null; // Remove event handlers
      ref.current.onstop = null;
      ref.current.onerror = null;
      try {
        ref.current.stop(); // Stop recording
      } catch (e) {
        // Ignore errors if already stopped
      }
    }
    ref.current = null; // Clear the ref
  };

  // --- Utility: Convert a Blob to a base64 string (for sending to API) ---
  const blobToBase64 = (b: Blob): Promise<string> =>
    new Promise((res, rej) => {
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string" ? res(reader.result) : rej();
      reader.onerror = rej;
      reader.readAsDataURL(b); // Read as data URL (base64)
    });

  // --- Utility: Format seconds as mm:ss for UI ---
  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // --- Constants for segment durations ---
  const SEGMENT_MS = 20_000; // 20 seconds for regular segments
  const ANSWER_SEGMENT_MS = 10_000; // 10 seconds for "answer" action

  // --- Main function to send context and prompt to AI backend ---
  const sendContextToAI = useCallback<
    (
      action: "real-time" | "answer" | "summary" | "search" | "custom",
      customQuery?: string,
    ) => Promise<void>
  >(
    async (action, customQuery) => {
      if (isLoading || !isScreenSharing) return; // Prevent duplicate requests
      setIsLoading(true);

      const ctx = await gatherContext(); // Gather latest audio context (mic/system)
      if (!ctx) {
        setIsLoading(false);
        return;
      }

      // Map action to prompt for the AI
      const promptMap: Record<typeof action, string> = {
        "real-time": "轉錄最新的語音內容，並識別其中提到的關鍵點、關鍵字或待辦事項。",
        answer: "根據最近音訊中的對話內容，回答音訊中最後提出的問題。因為會有兩種音訊，一種是麥克風音訊，一種是系統音訊，請先回答麥克風音訊再回答系統音訊的問題。有必要請上網查詢。",
        summary: "提供最近音訊片段中捕捉到的對話內容的簡明摘要。請用中文回答。若是麥克風音訊沒有可總結的對話內容，請不用針對該音訊回答。",
        search: "根據最近音訊片段中討論的主題，建議相關的搜尋關鍵字或查找相關資訊。請用中文回答。若是麥克風音訊沒有可搜尋的對話內容，請不用針對該音訊回答。",
        custom: customQuery || "根據以下要求分析最近音訊片段中捕捉到的對話內容。請用中文回答。",
      } as const;

      // Map action to display prompt for UI
      const displayPromptMap: Record<typeof action, string> = {
        "real-time": "即時轉錄",
        answer: "根據語音內容回答問題",
        summary: "根據過去語音內容產生摘要",
        search: "根據語音內容搜尋主題",
        custom: customPrompt,
      } as const;

      // Compose user message for API and display
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: action === "custom" ? customPrompt : promptMap[action],
      };

      // Display a simplified prompt in the UI
      const displayMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: action === "custom" ? customPrompt : displayPromptMap[action],
      };

      // Only show user message in chat for non-realtime actions
      if (action !== "real-time") setAiMessages((p) => [...p, displayMsg]);

      try {
        // Send request to backend API with prompt and audio context
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
        // On error, show a generic error message in chat
        setAiMessages((p) => [
          ...p,
          {
            id: `err-ai-${Date.now()}`,
            role: "assistant",
            content:
              "[AI 錯誤] 無法處理您的請求。請檢查您的網路連線或稍後再試。音訊品質不佳也可能導致處理失敗。",
          },
        ]);
      } finally {
        setIsLoading(false); // Always clear loading state
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
    ],
  );

  // --- Effects: React lifecycle hooks for timers, analyzers, and UI updates ---

  // Timer for recording duration (increments every second while sharing)
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

  // Listen for new mic audio segments (from custom event, e.g. from useSegmentRecorder)
  useEffect(() => {
    const h = (e: CustomEvent<Blob>) =>
      setSegments((p) => [...p, { blob: e.detail, timestamp: Date.now() }]);
    window.addEventListener("segment", h as any);
    return () => window.removeEventListener("segment", h as any);
  }, []);

  // Keep sendContextToAIRef in sync with latest function (for use in event handlers)
  useEffect(() => {
    sendContextToAIRef.current = sendContextToAI;
  }, [sendContextToAI]);

  // Show screen preview in video element when sharing
  useEffect(() => {
    if (
      isScreenSharing &&
      screenPreviewRef.current &&
      screenStreamRef.current?.getVideoTracks().length
    ) {
      const videoStream = new MediaStream(
        screenStreamRef.current.getVideoTracks(),
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

  // Setup/cleanup mic analyser for visualization
  useEffect(() => {
    if (isScreenSharing && micStream && !micAudioContextRef.current) {
      try {
        const audioCtx = new window.AudioContext(); // Create a new audio context for processing
        micAudioContextRef.current = audioCtx; // Set the current audio context
        const source = audioCtx.createMediaStreamSource(micStream); // Create a source node from the mic stream
        micSourceNodeRef.current = source; // Set the current source node
        const analyser = audioCtx.createAnalyser(); // Create an analyser node for visualization
        analyser.smoothingTimeConstant = 0.3; // Set the smoothing time constant
        analyser.fftSize = 256; // Set the FFT size
        source.connect(analyser); // Connect the source node to the analyser node
        setMicAnalyserNode(analyser); // Set the current analyser node
      } catch (error) {
        micSourceNodeRef.current?.disconnect(); // Disconnect the source node
        micSourceNodeRef.current = null; // Clear the source node ref
        micAudioContextRef.current?.close().catch(console.error); // Close the audio context
        micAudioContextRef.current = null; // Clear the audio context ref
        setMicAnalyserNode(null);
      }
    } else if ((!isScreenSharing || !micStream) && micAudioContextRef.current) {
      micSourceNodeRef.current?.disconnect();
      micSourceNodeRef.current = null;
      if (micAudioContextRef.current.state !== "closed") {
        micAudioContextRef.current.close().catch(console.error);
      }
      micAudioContextRef.current = null;
      setMicAnalyserNode(null);
    }
    return () => {
      if (
        micAudioContextRef.current &&
        micAudioContextRef.current.state !== "closed"
      ) {
        micSourceNodeRef.current?.disconnect();
        micSourceNodeRef.current = null;
        micAudioContextRef.current.close().catch(console.error);
        micAudioContextRef.current = null;
      }
    };
  }, [isScreenSharing, micStream]);

  // Auto-scroll chat/messages to bottom when new message arrives
  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  // --- Context ------------------------------------------------
  const gatherContext = async (): Promise<AIContextData | null> => {
    // Debug: log current state of audio buffers and segments
    console.log("Checking audio recording status...");
    console.log("Mic chunks length:", currentMicChunks.length);
    console.log("System chunks length:", systemAudioChunksRef.current.length);
    console.log(
      "Last mic segment:",
      segments.length > 0 ? segments[segments.length - 1] : null,
    );
    console.log(
      "Last system segment:",
      systemAudioSegments.length > 0
        ? systemAudioSegments[systemAudioSegments.length - 1]
        : null,
    );

    // Get the most recent completed mic and system audio segments
    const lastMicSegment =
      segments.length > 0 ? segments[segments.length - 1] : null;
    const lastSystemSegment =
      systemAudioSegments.length > 0
        ? systemAudioSegments[systemAudioSegments.length - 1]
        : null;

    // Get the current, in-progress audio chunks (not yet finalized as segments)
    const currentMicRecordingChunks = currentMicChunks; // From the hook
    const currentSystemRecordingChunks = systemAudioChunksRef.current; // From ref

    // Convert current chunks to blobs if they exist
    const currentMicBlob =
      currentMicRecordingChunks.length > 0
        ? new Blob(currentMicRecordingChunks, { type: micMimeType })
        : null;
    const currentSystemBlob =
      currentSystemRecordingChunks.length > 0
        ? new Blob(currentSystemRecordingChunks, { type: systemAudioMimeType })
        : null;

    console.log("Current mic blob size:", currentMicBlob?.size);
    console.log("Current system blob size:", currentSystemBlob?.size);

    // Collect all blobs to process (mic/system, segment/current)
    const blobsToProcess: { blob: Blob; type: string; label: string; }[] = [];

    // For "answer" action: only use the most recent 10 seconds of audio
    if (lastMicSegment) {
      const currentTime = Date.now();
      const segmentAge = currentTime - lastMicSegment.timestamp;
      // If last segment is recent, use it
      if (segmentAge <= ANSWER_SEGMENT_MS) {
        blobsToProcess.push({
          blob: lastMicSegment.blob,
          type: micMimeType,
          label: "microphone-last",
        });
      } else {
        // If not, only use if timestamp is within last 10s
        const startTime = currentTime - ANSWER_SEGMENT_MS;
        if (lastMicSegment.timestamp >= startTime) {
          blobsToProcess.push({
            blob: lastMicSegment.blob,
            type: micMimeType,
            label: "microphone-last",
          });
        }
      }
    }

    if (lastSystemSegment) {
      const segmentDuration =
        lastSystemSegment.timestamp -
        (lastSystemSegment.timestamp - ANSWER_SEGMENT_MS);
      if (segmentDuration <= ANSWER_SEGMENT_MS) {
        blobsToProcess.push({
          blob: lastSystemSegment.blob,
          type: systemAudioMimeType,
          label: "system-last",
        });
      }
    }

    // Always include current, in-progress chunks if available
    if (currentMicRecordingChunks.length > 0) {
      const currentBlob = new Blob(currentMicRecordingChunks, {
        type: micMimeType,
      });
      if (currentBlob.size > 0) {
        blobsToProcess.push({
          blob: currentBlob,
          type: micMimeType,
          label: "microphone-current",
        });
      }
    }
    if (currentSystemBlob && currentSystemBlob.size > 0) {
      blobsToProcess.push({
        blob: currentSystemBlob,
        type: systemAudioMimeType,
        label: "system-current",
      });
    }

    // If nothing to send, bail out
    if (!blobsToProcess.length) return null;

    // Convert all blobs to base64 for API (async)
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

    // Filter out any failed conversions
    const validAudioInputs = audioInputs.filter(Boolean) as {
      data: string;
      mimeType: string;
      label: string;
    }[];

    if (!validAudioInputs.length) return null;

    // Return the context object for the AI API
    return { audioInputs: validAudioInputs };
  };

  const handleTextResponse = useCallback((text: string) => {
    setAiMessages((prev) => {
      const lastMessage = prev[prev.length - 1];
      // If the last message is a real-time transcript, append to it
      if (
        lastMessage?.role === "assistant" &&
        lastMessage.content.startsWith("[即時轉錄]")
      ) {
        return [
          ...prev.slice(0, -1),
          { ...lastMessage, content: lastMessage.content + text },
        ];
      } else {
        // Otherwise, add a new real-time transcript message
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
      // Only add keywords that are not already present
      const uniqueNewKeywords = newKeywords.filter((k) => !prev.includes(k));
      return [...prev, ...uniqueNewKeywords];
    });
  }, []);

  const handleKeywordClick = useCallback(async (keyword: string) => {
    setSelectedKeyword(keyword); // Mark as loading in UI
    setIsLoading(true);

    try {
      // Ask the AI backend to explain the keyword
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

      // Add the explanation to the chat
      setAiMessages((prev) => [
        ...prev,
        {
          id: `explanation-${Date.now()}`,
          role: "assistant",
          content: `[${keyword} 的解釋] ${explanation}`,
        },
      ]);
    } catch (error) {
      console.error("取得關鍵字解釋時發生錯誤:", error); // Log original error
      // Show a generic error message in chat
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
      setSelectedKeyword(null); // Clear loading state
    }
  }, []);

  const toggleScreenShare = async () => {
    if (isLoading) return; // Prevent toggling while busy

    if (isScreenSharing) {
      // --- Stop all streams, recorders, and analyzers ---
      stopMicRecording();

      // Stop system audio recording timer if it exists
      if (systemAudioTimerRef.current) {
        clearInterval(systemAudioTimerRef.current);
        systemAudioTimerRef.current = null;
      }

      // Cleanup screen audio recorder
      cleanupRecorder(screenAudioRecorderRef);
      // Clear system audio chunks
      systemAudioChunksRef.current = [];
      // Cleanup screen stream
      cleanupStream(screenStreamRef);

      // Clear screen preview
      if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;

      // Cleanup system audio source node
      systemAudioSourceNodeRef.current?.disconnect();
      systemAudioSourceNodeRef.current = null;

      // Cleanup system audio context
      if (
        systemAudioContextRef.current &&
        systemAudioContextRef.current.state !== "closed"
      ) {
        systemAudioContextRef.current.close().catch(console.error);
      }
      systemAudioContextRef.current = null;
      setSystemAnalyserNode(null);
      setCurrentSystemAudioStream(null);

      setIsScreenSharing(false);
      setRecordingDuration(0);
    } else {
      // --- Start screen sharing and audio recording ---
      setSegments([]);
      setSystemAudioSegments([]);
      systemAudioChunksRef.current = [];
      setAiMessages([]);
      setKeywords([]);
      setRecordingDuration(0);

      let capturedMicStream: MediaStream | null = null;
      let displayStream: MediaStream | null = null;
      let systemAudioStream: MediaStream | null = null;

      try {
        // 1. Get screen (display) stream with system audio
        // Popup a permission request dialog in the browser to share the screen
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = displayStream;

        // 2. Get mic stream
        capturedMicStream = await startMicRecording();
        if (!capturedMicStream) {
          console.error("Failed to start microphone recording.");
          alert("無法啟動麥克風錄音，請檢查權限。");
          cleanupStream(screenStreamRef);
          setIsScreenSharing(false);
          return;
        }

        // 3. Extract system audio tracks from display stream
        const systemAudioTracks = displayStream.getAudioTracks();
        if (systemAudioTracks.length === 0) {
          console.warn("System audio track not found in screen share stream.");
          alert(
            "無法擷取系統音訊，錄音將只包含麥克風。若要錄製系統音訊，請在分享畫面時確認已勾選分享音訊選項。",
          );
          systemAudioStream = null;
        } else {
          systemAudioStream = new MediaStream(systemAudioTracks);
          setCurrentSystemAudioStream(systemAudioStream);
        }

        // 4. Combine mic + system audio for recording
        const audioTracksToRecord = [
          ...(systemAudioStream ? systemAudioStream.getAudioTracks() : []),
          ...capturedMicStream.getAudioTracks(),
        ];

        if (audioTracksToRecord.length > 0) {
          const combinedAudioStream = new MediaStream(audioTracksToRecord);

          const availableMime = MediaRecorder.isTypeSupported(
            "audio/webm;codecs=opus",
          )
            ? "audio/webm;codecs=opus"
            : "audio/ogg;codecs=opus";
          setSystemAudioMimeType(availableMime);

          cleanupRecorder(screenAudioRecorderRef);

          // Setup system audio recorder
          if (systemAudioStream) {
            const systemRecorder = new MediaRecorder(systemAudioStream, {
              mimeType: availableMime,
            });

            systemRecorder.ondataavailable = (e) => {
              if (e.data.size > 0) {
                systemAudioChunksRef.current.push(e.data);
                // On each chunk, update the system audio segments
                const currentBlob = new Blob(systemAudioChunksRef.current, {
                  type: availableMime,
                });
                if (currentBlob.size > 0) {
                  setSystemAudioSegments((p) => [
                    ...p,
                    { blob: currentBlob, timestamp: Date.now() },
                  ]);
                }
              }
            };

            systemRecorder.start(1000); // Collect data every second
            screenAudioRecorderRef.current = systemRecorder;

            // Restart recording every 20s to segment
            if (systemAudioTimerRef.current) {
              clearInterval(systemAudioTimerRef.current);
            }
            systemAudioTimerRef.current = setInterval(() => {
              if (systemRecorder.state === "recording") {
                systemRecorder.stop();
                systemRecorder.start(1000);
              }
            }, 20000);
          }
        } else {
          console.warn("No audio tracks available to record.");
        }

        // 5. Setup system audio analyser for visualization
        if (systemAudioStream) {
          try {
            const audioCtx = new window.AudioContext();
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
        } else {
          setSystemAnalyserNode(null);
        }

        // 6. Finalize state
        setIsScreenSharing(true);
      } catch (e) {
        // On error, clean up everything
        console.error("Error starting screen share:", e);
        alert(
          `啟動分享時發生錯誤: ${e instanceof Error ? e.message : String(e)}`,
        );

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
        if (
          systemAudioContextRef.current &&
          systemAudioContextRef.current.state !== "closed"
        ) {
          systemAudioContextRef.current.close().catch(console.error);
        }
        systemAudioContextRef.current = null;
        setCurrentSystemAudioStream(null);
        setSystemAnalyserNode(null);

        setIsScreenSharing(false);
      }
    }
  };

  return (
    <div className="flex flex-col gap-16 mx-auto max-w-5xl p-6 mt-12 lg:mt-16">
      {/* Add a divider */}
      <div className="h-px w-full bg-border my-8"></div>
      <h2 className="text-balance text-3xl font-semibold lg:text-4xl text-center">
        Try our web demo!
      </h2>

      <div className="flex flex-1 overflow-hidden border rounded-lg shadow-lg bg-card max-h-[70vh]">
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
                  className={`flex h-3 w-3 rounded-full ${isScreenSharing
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
            <RealTimeAnalysis
              onTextResponse={handleTextResponse}
              onKeywords={handleKeywords}
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
                {
                  action: "summary",
                  label: "產生摘要",
                  icon: ListCollapseIcon,
                },
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

          {isScreenSharing && screenStreamRef.current?.getVideoTracks() && (
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

          {/* <div className="p-4 mt-auto space-y-2">
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
          </div> */}
        </aside>
      </div>

      {/* 測試版體驗指南 */}
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
                  <span className="text-lg font-bold">點擊「開始錄製」與「分享螢幕」</span>
                  <br />
                  系統將要求您選擇畫面來源，並請允許使用麥克風與攝影機。
                </li>
                <li className="text-lg my-4">
                  <span className="text-lg font-bold">點擊「開始分析」</span>
                  <br />
                  開始對鏡頭說話，或播放任何語音/影片內容。
                </li>
                <li className="text-lg my-4">
                  <span className="text-lg font-bold">模擬情境自由發揮</span>
                  <br />
                  可以自由工作、提問、討論新聞或日常對話。
                  <br />
                  也可以播放 YouTube 講座、聊天影片等內容。
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
  );
}
