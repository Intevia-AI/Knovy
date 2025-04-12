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
  SwitchCameraIcon,
  RefreshCwIcon,
  ListCollapseIcon,
  SearchIcon,
} from "lucide-react";
import { Message } from "ai";

// --- Types ---
type Screenshot = {
  data: string; // base64 data URL
  mimeType: string;
  timestamp: number;
  description?: string;
};

type AudioTranscript = {
  content: string;
  timestamp: number;
  source?: string;
};

type CaptureMode = "camera" | "screen";

type MediaChunk = {
  blob: Blob;
  timestamp: number;
};

// Context structure for AI
type AIContextData = {
  audio?: { data: string; mimeType: string };
  video?: { data: string; mimeType: string }; // For screen recordings
  screenshots?: { data: string; mimeType: string }[];
  transcripts?: { content: string; timestamp: string; source: string }[];
};

// --- Constants ---
const SCREENSHOT_INTERVAL_MS = 5000; // 5 seconds
const TRANSCRIPT_INTERVAL_MS = 8000; // 8 seconds
const REALTIME_ANALYSIS_INTERVAL_MS = 15000; // 15 seconds
const AUDIO_CHUNK_TIMESLICE_MS = 1000; // 1 second chunks
const MAX_SCREENSHOTS = 5;
const MAX_TRANSCRIPTS = 10;
const MAX_AUDIO_BYTES_FOR_AI = 5 * 1024 * 1024; // 5MB limit for AI audio

export default function Page() {
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null); // Ref for player

  const audioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null); // Camera stream
  const screenStreamRef = useRef<MediaStream | null>(null); // Display stream

  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null);

  const screenshotIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const transcriptIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const realTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // --- State ---
  const [isRecording, setIsRecording] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("camera");
  const [isLoading, setIsLoading] = useState(false); // Unified loading state
  const [realTimeAnalysisEnabled, setRealTimeAnalysisEnabled] = useState(false);

  // Collected data
  const [audioChunks, setAudioChunks] = useState<MediaChunk[]>([]);
  const [screenChunks, setScreenChunks] = useState<MediaChunk[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]);
  const [transcripts, setTranscripts] = useState<AudioTranscript[]>([]);
  const [aiMessages, setAiMessages] = useState<Message[]>([]);

  // State for the final audio blob URL (only set after stopping)
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);

  // --- Utility Functions ---

  const cleanupStream = (
    streamRef: React.MutableRefObject<MediaStream | null>
  ) => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.onended = null; // Remove listeners
        track.stop();
      });
      streamRef.current = null;
    }
  };

  const cleanupRecorder = (
    recorderRef: React.MutableRefObject<MediaRecorder | null>
  ) => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop(); // onstop should handle the rest
      // Nullify immediately - onstop might be async but we are stopping interaction
      recorderRef.current = null;
    } else {
      recorderRef.current = null; // Ensure it's null if already inactive
    }
  };

  const cleanupIntervals = () => {
    if (screenshotIntervalRef.current)
      clearInterval(screenshotIntervalRef.current);
    if (transcriptIntervalRef.current)
      clearInterval(transcriptIntervalRef.current);
    if (realTimeIntervalRef.current) clearInterval(realTimeIntervalRef.current);
    screenshotIntervalRef.current = null;
    transcriptIntervalRef.current = null;
    realTimeIntervalRef.current = null;
  };

  const getSupportedMimeType = useCallback(
    (kind: "audio" | "video"): string => {
      const audioTypes = [
        "audio/webm;codecs=opus",
        "audio/ogg;codecs=opus",
        "audio/wav",
        "audio/webm",
      ];
      const videoTypes = [
        "video/webm;codecs=vp9,opus",
        "video/webm;codecs=vp8,opus",
        "video/webm",
        "video/mp4",
      ];
      const types = kind === "audio" ? audioTypes : videoTypes;

      for (const type of types) {
        if (MediaRecorder.isTypeSupported(type)) return type;
      }
      console.warn(`No preferred ${kind} MIME type supported.`);
      return kind === "audio" ? "audio/webm" : "video/webm"; // Default fallback
    },
    []
  );

  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      if (!blob || blob.size === 0) {
        resolve("");
        return;
      }
      if (!(blob instanceof Blob)) {
        resolve("");
        return;
      }
      const reader = new FileReader();
      reader.onload = () =>
        typeof reader.result === "string"
          ? resolve(reader.result)
          : reject(new Error("Read result not string"));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };

  // Simple audio compression (trimming to size limit) - consider more advanced later if needed
  const compressAudioIfNeeded = async (blob: Blob): Promise<Blob> => {
    if (!blob || blob.size <= MAX_AUDIO_BYTES_FOR_AI) {
      return blob;
    }
    console.warn(
      `Audio size (${(blob.size / 1024).toFixed(1)} KB) > limit. Trimming (simple approach).`
    );
    // Simplistic approach: just take the first MAX_AUDIO_BYTES_FOR_AI bytes
    // This is NOT ideal for audio quality but avoids complex client-side processing for now.
    // A better approach involves decoding, trimming duration, and re-encoding (like previous attempt).
    return blob.slice(0, MAX_AUDIO_BYTES_FOR_AI, blob.type);
  };

  // --- Recording Logic ---

  const startAudioRecording = useCallback(async () => {
    console.log("Starting audio recording...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      audioStreamRef.current = stream;
      const mimeType = getSupportedMimeType("audio");
      const recorder = new MediaRecorder(stream, { mimeType });
      audioRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data.size > 0) {
          setAudioChunks((prev) => [
            ...prev,
            { blob: event.data, timestamp: Date.now() },
          ]);
        }
      };
      recorder.onerror = (e) => console.error("Audio recorder error:", e);
      recorder.onstop = () => {
        console.log("Audio recorder stopped. Processing final blob.");
        // Process final audio blob *only* when explicitly stopped
        setAudioChunks((prevChunks) => {
          if (prevChunks.length > 0) {
            const finalBlob = new Blob(
              prevChunks.map((c) => c.blob),
              { type: mimeType }
            );
            console.log(
              `Final audio blob size: ${(finalBlob.size / 1024).toFixed(1)} KB`
            );
            const url = URL.createObjectURL(finalBlob);
            setFinalAudioUrl(url); // Set URL for player
            // We don't store the final blob itself in state anymore to avoid issues
          } else {
            setFinalAudioUrl(null);
          }
          return []; // Clear chunks after stopping and processing
        });
      };

      recorder.start(AUDIO_CHUNK_TIMESLICE_MS);
      console.log("Audio recorder started successfully.");
      return true;
    } catch (error) {
      console.error("Failed to start audio recording:", error);
      setAiMessages((prev) => [
        ...prev,
        {
          id: `err-audio-${Date.now()}`,
          role: "assistant",
          content: `[Error starting mic: ${error instanceof Error ? error.message : "Permission denied?"}]`,
        },
      ]);
      cleanupStream(audioStreamRef); // Clean up if failed
      return false;
    }
  }, [getSupportedMimeType]);

  const startVideoOrScreenRecording = useCallback(
    async (mode: CaptureMode) => {
      console.log(`Starting ${mode} recording...`);
      let stream: MediaStream | null = null;
      try {
        if (mode === "camera") {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
          videoStreamRef.current = stream;
          if (videoRef.current) videoRef.current.srcObject = stream;
        } else {
          // screen
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 10 },
            audio: false,
          }); // Keep screen audio separate for simplicity now
          screenStreamRef.current = stream;
          if (screenVideoRef.current) screenVideoRef.current.srcObject = stream;

          // Handle user stopping screen share via browser UI
          const videoTrack = stream.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = () => {
              console.log("Screen share stopped by user.");
              if (isRecording && captureMode === "screen") {
                // Check if still relevant
                stopRecording(); // Stop everything if user stops sharing
                // Optionally switch back to camera automatically here if desired
              }
            };
          }

          // Setup screen recorder if in screen mode
          const screenMimeType = getSupportedMimeType("video");
          const screenRecorder = new MediaRecorder(stream, {
            mimeType: screenMimeType,
          });
          screenRecorderRef.current = screenRecorder;

          screenRecorder.ondataavailable = (event: BlobEvent) => {
            if (event.data.size > 0) {
              setScreenChunks((prev) => [
                ...prev,
                { blob: event.data, timestamp: Date.now() },
              ]);
            }
          };
          screenRecorder.onerror = (e) =>
            console.error("Screen recorder error:", e);
          screenRecorder.onstop = () => {
            console.log("Screen recorder stopped.");
            // Don't process final blob here, let gatherCurrentContext handle chunks
            setScreenChunks([]); // Clear chunks after stopping
          };
          screenRecorder.start(AUDIO_CHUNK_TIMESLICE_MS * 2); // Record screen in slightly larger chunks?
          console.log("Screen recorder started.");
        }

        // Play the preview
        const videoElement =
          mode === "camera" ? videoRef.current : screenVideoRef.current;
        if (videoElement)
          await videoElement
            .play()
            .catch((e) => console.warn(`${mode} preview play warning:`, e));

        console.log(`${mode} recording started successfully.`);
        return true;
      } catch (error) {
        console.error(`Failed to start ${mode} recording:`, error);
        setAiMessages((prev) => [
          ...prev,
          {
            id: `err-video-${Date.now()}`,
            role: "assistant",
            content: `[Error starting ${mode}: ${error instanceof Error ? error.message : "Permission denied?"}]`,
          },
        ]);
        cleanupStream(videoStreamRef);
        cleanupStream(screenStreamRef);
        cleanupRecorder(screenRecorderRef); // Ensure screen recorder is cleaned if it failed mid-setup
        return false;
      }
    },
    [getSupportedMimeType, isRecording, captureMode]
  ); // Added dependencies

  // --- Main Start/Stop ---

  const startRecording = useCallback(async () => {
    if (isRecording || isLoading) return;
    console.log("Initiating start recording sequence...");
    setIsLoading(true);
    setAiMessages([]); // Clear previous messages
    setAudioChunks([]);
    setScreenChunks([]);
    setScreenshots([]);
    setTranscripts([]);
    if (finalAudioUrl) URL.revokeObjectURL(finalAudioUrl); // Clean up previous final URL
    setFinalAudioUrl(null);

    const audioStarted = await startAudioRecording();
    const videoStarted = await startVideoOrScreenRecording(captureMode);

    if (audioStarted || videoStarted) {
      // Start if at least one source works
      setIsRecording(true);
      startDataCaptureIntervals(); // Start screenshots/transcripts
      console.log("Recording is now active.");
    } else {
      console.error("Failed to start any recording source.");
      // Cleanup potentially partially started streams/recorders
      cleanupStream(audioStreamRef);
      cleanupRecorder(audioRecorderRef);
      cleanupStream(videoStreamRef);
      cleanupStream(screenStreamRef);
      cleanupRecorder(screenRecorderRef);
    }
    setIsLoading(false);
  }, [
    isLoading,
    isRecording,
    captureMode,
    startAudioRecording,
    startVideoOrScreenRecording,
    finalAudioUrl,
  ]);

  const stopRecording = useCallback(() => {
    if (!isRecording || isLoading) return;
    console.log("Initiating stop recording sequence...");
    setIsLoading(true); // Prevent actions during stop

    cleanupIntervals(); // Stop data capture first

    // Stop recorders (triggers onstop) and streams
    cleanupRecorder(audioRecorderRef);
    cleanupStream(audioStreamRef);
    cleanupRecorder(screenRecorderRef); // Handles screen recorder if active
    cleanupStream(videoStreamRef); // Handles camera stream if active
    cleanupStream(screenStreamRef); // Handles screen stream if active

    // Clear video previews
    if (videoRef.current) videoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;

    setIsRecording(false);
    setRealTimeAnalysisEnabled(false); // Turn off real-time when stopping

    // Chunks are cleared within the recorder onstop handlers now
    // Final audio URL is also set in the audio recorder's onstop

    console.log("Recording stopped.");
    setIsLoading(false);
  }, [isRecording, isLoading]);

  // --- Data Capture (Screenshots, Transcripts) ---

  const takeScreenshot = useCallback(() => {
    if (!isRecording) return;
    const videoElement =
      captureMode === "camera" ? videoRef.current : screenVideoRef.current;
    if (
      !videoElement ||
      videoElement.readyState < 2 ||
      videoElement.videoWidth === 0
    )
      return;

    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    try {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const description = `${captureMode} view at ${new Date().toLocaleTimeString()}`;
      setScreenshots((prev) =>
        [
          {
            data: dataUrl,
            mimeType: "image/jpeg",
            timestamp: Date.now(),
            description,
          },
          ...prev,
        ].slice(0, MAX_SCREENSHOTS)
      );
    } catch (e) {
      console.error("Screenshot failed:", e);
    }
  }, [isRecording, captureMode]);

  const addTranscript = useCallback(() => {
    // Simple demo transcript logic
    const demoSources = [
      "Team Lead",
      "Developer A",
      "Product Manager",
      "Developer B",
    ];
    const demoContent = [
      "How is the feature progressing?",
      "Making good headway, need to integrate the API.",
      "Is the timeline still feasible?",
      "Found a small bug, might add a day.",
      "Let's sync on the blocker.",
      "Okay, I'll prepare the details.",
      "Client feedback was positive.",
      "Great, let's keep the momentum.",
    ];
    const timestamp = Date.now();
    const newTranscript: AudioTranscript = {
      timestamp: timestamp,
      source:
        demoSources[
          Math.floor(timestamp / TRANSCRIPT_INTERVAL_MS) % demoSources.length
        ],
      content:
        demoContent[
          Math.floor(timestamp / (TRANSCRIPT_INTERVAL_MS * 2)) %
            demoContent.length
        ],
    };
    setTranscripts((prev) => [...prev, newTranscript].slice(-MAX_TRANSCRIPTS));
  }, []); // No dependency on isRecording here, interval controls it

  const startDataCaptureIntervals = () => {
    cleanupIntervals(); // Ensure previous are cleared
    // Initial capture + interval setup
    setTimeout(takeScreenshot, 500); // Take first screenshot quickly
    screenshotIntervalRef.current = setInterval(
      takeScreenshot,
      SCREENSHOT_INTERVAL_MS
    );
    setTimeout(addTranscript, 1000); // Add first transcript quickly
    transcriptIntervalRef.current = setInterval(
      addTranscript,
      TRANSCRIPT_INTERVAL_MS
    );
    console.log("Started screenshot and transcript intervals.");
  };

  // --- AI Interaction ---

  const gatherCurrentContext = useCallback(
    async (type: "real-time" | "manual"): Promise<AIContextData | null> => {
      console.log(`Gathering context for ${type} AI action...`);

      // 1. Select Chunks
      let audioBlob: Blob | null = null;
      let screenBlob: Blob | null = null;
      const now = Date.now();
      const realtimeWindowMs = REALTIME_ANALYSIS_INTERVAL_MS; // Use interval duration as window

      // Select audio chunks
      const relevantAudioChunks =
        type === "real-time"
          ? audioChunks.filter((c) => now - c.timestamp < realtimeWindowMs) // Recent N seconds for real-time
          : audioChunks; // All chunks for manual
      if (relevantAudioChunks.length > 0) {
        const mime =
          relevantAudioChunks[0].blob.type || getSupportedMimeType("audio");
        audioBlob = new Blob(
          relevantAudioChunks.map((c) => c.blob),
          { type: mime }
        );
        console.log(
          `Using ${relevantAudioChunks.length} audio chunks. Blob size: ${(audioBlob.size / 1024).toFixed(1)} KB`
        );
        audioBlob = await compressAudioIfNeeded(audioBlob); // Compress if needed
      }

      // Select screen chunks (only if captureMode is screen)
      if (captureMode === "screen") {
        const relevantScreenChunks =
          type === "real-time"
            ? screenChunks.filter((c) => now - c.timestamp < realtimeWindowMs)
            : screenChunks;
        if (relevantScreenChunks.length > 0) {
          const mime =
            relevantScreenChunks[0].blob.type || getSupportedMimeType("video");
          screenBlob = new Blob(
            relevantScreenChunks.map((c) => c.blob),
            { type: mime }
          );
          console.log(
            `Using ${relevantScreenChunks.length} screen chunks. Blob size: ${(screenBlob.size / 1024).toFixed(1)} KB`
          );
          // Note: No video compression here for simplicity
        }
      }

      // 2. Get Screenshots and Transcripts
      const currentScreenshots = screenshots.slice(
        0,
        type === "real-time" ? 1 : 3
      ); // Fewer for real-time
      const currentTranscripts = transcripts.slice(-5); // Last 5 transcripts

      // 3. Check if any context exists
      if (
        !audioBlob &&
        !screenBlob &&
        currentScreenshots.length === 0 &&
        currentTranscripts.length === 0
      ) {
        console.log("No context data found.");
        return null;
      }

      // 4. Format for AI (including Base64 conversion)
      const context: AIContextData = {};
      if (audioBlob) {
        const base64 = await blobToBase64(audioBlob);
        if (base64)
          context.audio = {
            data: base64.split(",")[1],
            mimeType: audioBlob.type,
          };
      }
      if (screenBlob) {
        const base64 = await blobToBase64(screenBlob);
        if (base64)
          context.video = {
            data: base64.split(",")[1],
            mimeType: screenBlob.type,
          };
      }
      if (currentScreenshots.length > 0) {
        context.screenshots = currentScreenshots.map((ss) => ({
          data: ss.data.split(",")[1],
          mimeType: ss.mimeType,
        }));
      }
      if (currentTranscripts.length > 0) {
        context.transcripts = currentTranscripts.map((t) => ({
          content: t.content,
          timestamp: new Date(t.timestamp).toISOString(),
          source: t.source || "Unknown",
        }));
      }

      console.log("Context gathered:", {
        audio: !!context.audio,
        video: !!context.video,
        screenshots: context.screenshots?.length ?? 0,
        transcripts: context.transcripts?.length ?? 0,
      });
      return context;
    },
    [
      audioChunks,
      screenChunks,
      screenshots,
      transcripts,
      captureMode,
      getSupportedMimeType,
    ]
  );

  const sendContextToAI = useCallback(
    async (actionType: "real-time" | "answer" | "summary" | "search") => {
      if (isLoading) return;
      console.log(`AI Action Triggered: ${actionType}`);
      setIsLoading(true);

      const contextType = actionType === "real-time" ? "real-time" : "manual";
      const contextData = await gatherCurrentContext(contextType);

      if (!contextData) {
        setAiMessages((prev) => [
          ...prev,
          {
            id: `err-noctx-${Date.now()}`,
            role: "assistant",
            content:
              "[Cannot perform AI action: No context data available yet.]",
          },
        ]);
        setIsLoading(false);
        return;
      }

      // Define query based on action
      const queryMap = {
        answer:
          "Based on the recent context (audio, video, screenshots, transcripts), please answer the likely question or address the last point made.",
        summary:
          "Provide a concise summary of the key points discussed or shown recently based on the provided context (audio, video, screenshots, transcripts).",
        search:
          "Identify key topics or entities from the recent context (audio, video, screenshots, transcripts) and suggest relevant information or search queries.",
        "real-time":
          "Analyze the latest context (audio, video, screenshots, transcripts) for noteworthy events, keywords, or changes. Provide a brief update or insight.",
      };
      const query = queryMap[actionType];

      // Add user message for non-real-time actions
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: query,
      };
      if (actionType !== "real-time") {
        setAiMessages((prev) => [...prev, userMessage]);
      }

      try {
        console.log("Sending context to /api/ai...");
        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [userMessage], data: contextData }), // Send context under 'data' key
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`API Error ${response.status}: ${errorText}`);
        }

        const result = await response.json(); // Assuming API returns { content: "..." }
        console.log("AI Response received.");

        if (result && result.content) {
          const prefix = actionType === "real-time" ? "[Real-time] " : "";
          setAiMessages((prev) => [
            ...prev,
            {
              id: `ai-${Date.now()}`,
              role: "assistant",
              content: `${prefix}${result.content}`,
            },
          ]);
        } else {
          setAiMessages((prev) => [
            ...prev,
            {
              id: `warn-noresp-${Date.now()}`,
              role: "assistant",
              content:
                "[AI processed the request but provided no text response.]",
            },
          ]);
        }
      } catch (error) {
        console.error("Error sending context to AI:", error);
        setAiMessages((prev) => [
          ...prev,
          {
            id: `err-ai-${Date.now()}`,
            role: "assistant",
            content: `[Error during AI request: ${error instanceof Error ? error.message : "Unknown error"}]`,
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, gatherCurrentContext]
  );

  // --- Event Handlers ---

  const handleAIAction = (actionType: "answer" | "summary" | "search") => {
    if (!isRecording) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `warn-rec-${Date.now()}`,
          role: "assistant",
          content: "[Please start recording before using AI actions.]",
        },
      ]);
      return;
    }
    sendContextToAI(actionType);
  };

  const handleToggleCaptureMode = useCallback(async () => {
    if (!isRecording || isLoading) return; // Only switch while recording
    setIsLoading(true);
    const newMode = captureMode === "camera" ? "screen" : "camera";
    console.log(`Switching capture mode to ${newMode}`);

    // Stop current video/screen recording parts
    cleanupRecorder(screenRecorderRef); // Stop screen recorder if active
    cleanupStream(videoStreamRef); // Stop camera stream if active
    cleanupStream(screenStreamRef); // Stop screen stream if active
    if (videoRef.current) videoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    setScreenChunks([]); // Clear screen chunks on mode switch

    setCaptureMode(newMode); // Update state

    // Start new video/screen recording
    const success = await startVideoOrScreenRecording(newMode);
    if (!success) {
      console.error("Failed to start recording after mode switch.");
      // Attempt to revert? Or just stop? Let's stop for simplicity.
      stopRecording();
    }

    setIsLoading(false);
  }, [
    isRecording,
    isLoading,
    captureMode,
    startVideoOrScreenRecording,
    stopRecording,
  ]); // Added stopRecording

  const handleToggleRealTime = () => {
    if (isLoading) return;
    setRealTimeAnalysisEnabled((prev) => !prev);
  };

  // --- Real-time Analysis Effect ---
  useEffect(() => {
    cleanupIntervals(); // Clear all intervals when dependencies change

    if (isRecording && realTimeAnalysisEnabled && !isLoading) {
      console.log("Starting real-time analysis interval.");
      // Initial run delayed slightly
      const initialTimeout = setTimeout(() => {
        if (isRecording && realTimeAnalysisEnabled && !isLoading) {
          // Re-check state
          sendContextToAI("real-time");
        }
      }, 3000); // Initial delay 3s

      realTimeIntervalRef.current = setInterval(() => {
        if (isRecording && realTimeAnalysisEnabled && !isLoading) {
          // Re-check state
          sendContextToAI("real-time");
        } else if (realTimeIntervalRef.current) {
          // Stop interval if conditions no longer met
          clearInterval(realTimeIntervalRef.current);
          realTimeIntervalRef.current = null;
        }
      }, REALTIME_ANALYSIS_INTERVAL_MS);

      // Cleanup for this effect instance
      return () => {
        clearTimeout(initialTimeout);
        if (realTimeIntervalRef.current) {
          clearInterval(realTimeIntervalRef.current);
          realTimeIntervalRef.current = null;
          console.log("Cleared real-time analysis interval.");
        }
      };
    } else {
      console.log(
        "Real-time analysis conditions not met, interval not started."
      );
    }
    // Rerun when recording status, toggle, or loading state changes
  }, [isRecording, realTimeAnalysisEnabled, isLoading, sendContextToAI]);

  // --- Unmount Cleanup Effect ---
  useEffect(() => {
    return () => {
      console.log("Component unmounting: Cleaning up...");
      cleanupStream(audioStreamRef);
      cleanupStream(videoStreamRef);
      cleanupStream(screenStreamRef);
      cleanupRecorder(audioRecorderRef);
      cleanupRecorder(screenRecorderRef);
      cleanupIntervals();
      if (finalAudioUrl) URL.revokeObjectURL(finalAudioUrl);
    };
  }, [finalAudioUrl]); // Include finalAudioUrl dependency

  // --- Render ---
  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
        AI Meeting Assistant (Refactored)
      </h1>

      {/* Controls Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span
                className={`flex h-3 w-3 rounded-full ${isRecording ? (isLoading ? "bg-yellow-500" : "bg-red-500 animate-pulse") : "bg-slate-400"}`}
                title={
                  isRecording
                    ? isLoading
                      ? "Processing..."
                      : "Recording Active"
                    : "Inactive"
                }
              ></span>
              <span>
                Status:{" "}
                {isLoading
                  ? "Processing..."
                  : isRecording
                    ? "Recording"
                    : "Stopped"}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {isRecording && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleCaptureMode}
                  disabled={isLoading}
                  title="Switch Camera/Screen"
                >
                  <SwitchCameraIcon className="h-4 w-4 mr-2" />{" "}
                  {captureMode === "camera" ? "Share Screen" : "Use Camera"}
                </Button>
              )}
              {isRecording ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                  disabled={isLoading}
                  title="Stop Recording"
                >
                  <PauseIcon className="h-4 w-4 mr-2" /> Stop
                </Button>
              ) : (
                <Button
                  variant="default"
                  size="sm"
                  onClick={startRecording}
                  disabled={isLoading}
                  title="Start Recording"
                >
                  {isLoading ? (
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <PlayIcon className="h-4 w-4 mr-2" />
                  )}{" "}
                  Start
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      {/* Media Previews and Data Card */}
      <Card className="mb-6">
        <CardContent className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Video Preview */}
          <div className="space-y-2">
            <h3 className="font-medium text-sm">
              {captureMode === "camera" ? "Camera Feed" : "Screen Preview"}
            </h3>
            <div className="aspect-video bg-slate-800 rounded border relative">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`w-full h-full object-cover ${captureMode === "camera" ? "" : "hidden"}`}
              />
              <video
                ref={screenVideoRef}
                muted
                playsInline
                className={`w-full h-full object-contain ${captureMode === "screen" ? "" : "hidden"}`}
              />
              {!isRecording && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm">
                  Preview Area
                </div>
              )}
            </div>
          </div>

          {/* Audio & Screenshots */}
          <div className="space-y-4">
            {/* Audio Player */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">
                Audio Playback (After Stop)
              </h3>
              <audio
                ref={audioPlayerRef}
                controls
                src={finalAudioUrl ?? undefined}
                className="w-full"
                disabled={!finalAudioUrl}
              />
              {!finalAudioUrl && (
                <p className="text-xs text-slate-500">
                  Audio player active after recording stops.
                </p>
              )}
            </div>
            {/* Screenshots */}
            <div className="space-y-2">
              <h3 className="font-medium text-sm">
                Recent Screenshots ({screenshots.length}/{MAX_SCREENSHOTS})
              </h3>
              <div className="grid grid-cols-3 gap-2 min-h-[50px]">
                {screenshots.length > 0 ? (
                  screenshots.map((ss) => (
                    <div
                      key={ss.timestamp}
                      className="aspect-video bg-slate-700 rounded overflow-hidden border border-slate-600"
                    >
                      <img
                        src={ss.data}
                        alt="screenshot"
                        className="w-full h-full object-cover"
                        loading="lazy"
                        title={ss.description}
                      />
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-center text-xs text-slate-500 pt-4">
                    No screenshots yet...
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transcripts */}
          <div className="md:col-span-2 space-y-2">
            <h3 className="font-medium text-sm">
              Simulated Transcripts ({transcripts.length}/{MAX_TRANSCRIPTS})
            </h3>
            <div className="bg-slate-100 dark:bg-slate-800 p-3 rounded-lg max-h-48 overflow-y-auto border border-slate-200 dark:border-slate-700 scrollbar-thin">
              {transcripts.length > 0 ? (
                <ul className="space-y-1.5">
                  {" "}
                  {transcripts.map((t) => (
                    <li key={t.timestamp} className="text-xs">
                      {" "}
                      <span className="font-semibold text-sky-600 dark:text-sky-400">
                        {t.source || "System"} (
                        {new Date(t.timestamp).toLocaleTimeString()}):
                      </span>{" "}
                      <span className="text-slate-700 dark:text-slate-300 ml-1">
                        {t.content}
                      </span>{" "}
                    </li>
                  ))}{" "}
                </ul>
              ) : (
                <p className="text-center text-xs text-slate-500 py-3">
                  No transcripts yet...
                </p>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* AI Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-4">
            <span>AI Assistant</span>
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Real-time Analysis:</span>
              <Button
                variant={realTimeAnalysisEnabled ? "default" : "outline"}
                size="sm"
                onClick={handleToggleRealTime}
                disabled={isLoading || !isRecording}
                title={
                  isRecording
                    ? `Turn ${realTimeAnalysisEnabled ? "Off" : "On"}`
                    : "Start recording first"
                }
              >
                {realTimeAnalysisEnabled ? "ON" : "OFF"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* AI Action Buttons */}
          <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            <Button
              variant="outline"
              onClick={() => handleAIAction("answer")}
              disabled={isLoading || !isRecording}
              title={
                !isRecording
                  ? "Start recording"
                  : "Ask AI to answer based on current context"
              }
            >
              <MicIcon className="h-4 w-4 mr-2" /> AI Answer
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAIAction("summary")}
              disabled={isLoading || !isRecording}
              title={
                !isRecording
                  ? "Start recording"
                  : "Ask AI to summarize current context"
              }
            >
              <ListCollapseIcon className="h-4 w-4 mr-2" /> AI Summary
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAIAction("search")}
              disabled={isLoading || !isRecording}
              title={
                !isRecording
                  ? "Start recording"
                  : "Ask AI for topics from current context"
              }
            >
              <SearchIcon className="h-4 w-4 mr-2" /> AI Search
            </Button>
            {/* Maybe add manual 'Process Now' button back later if needed */}
          </div>

          {/* AI Output Area */}
          <div className="space-y-3 min-h-[100px]">
            <h3 className="font-semibold text-sm">Output:</h3>
            {isLoading &&
              aiMessages.length === 0 && ( // Show loading only if no messages yet
                <div className="flex items-center text-sm text-slate-500">
                  {" "}
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" /> Waiting
                  for AI...{" "}
                </div>
              )}
            {aiMessages.length === 0 && !isLoading && (
              <div className="text-center text-sm text-slate-400 py-4">
                AI responses will appear here.
              </div>
            )}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin">
              {aiMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2.5 rounded text-sm border-l-4 ${
                    msg.role === "assistant"
                      ? msg.content.startsWith("[Error") ||
                        msg.content.startsWith("[Cannot perform")
                        ? "bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300"
                        : msg.content.startsWith("[Warn")
                          ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-300"
                          : "bg-slate-100 dark:bg-slate-800 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200" // Default AI
                      : "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-800 dark:text-blue-300" // User
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {msg.content}
                  </p>
                </div>
              ))}
              {isLoading &&
                aiMessages.length > 0 && ( // Show loading indicator at the bottom if messages exist
                  <div className="flex items-center text-sm text-slate-500 pt-2">
                    {" "}
                    <Loader2Icon className="h-4 w-4 mr-2 animate-spin" />{" "}
                    Waiting for AI...{" "}
                  </div>
                )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
