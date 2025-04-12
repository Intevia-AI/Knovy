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
  ListCollapseIcon,
  SearchIcon,
  SendIcon,
  CameraIcon,
  CameraOffIcon,
  ClockIcon,
} from "lucide-react";
import { Message } from "ai";
import { Input } from "@workspace/ui/components/input";

// --- Types ---
type Screenshot = {
  data: string; // base64 data URL
  mimeType: string;
  timestamp: number;
  description?: string;
};

type CaptureMode = "camera" | "screen";

type MediaChunk = {
  blob: Blob;
  timestamp: number;
};

type AudioSource = "mic" | "system" | "none";

// Context structure for AI
type AIContextData = {
  audio?: { data: string; mimeType: string };
  video?: { data: string; mimeType: string }; // For screen recordings
  screenshots?: { data: string; mimeType: string }[];
};

// --- Constants ---
const SCREENSHOT_INTERVAL_MS = 5000; // 5 seconds
const REALTIME_ANALYSIS_INTERVAL_MS = 15000; // 15 seconds
const AUDIO_CHUNK_TIMESLICE_MS = 3000; // 3 second chunks
const MAX_SCREENSHOTS = 5;
const MAX_AUDIO_BYTES_FOR_AI = 5 * 1024 * 1024; // 5MB limit for AI audio

// --- Full Code ---
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

  const realTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const sendContextToAIRef = useRef(
    async (
      _actionType: "real-time" | "answer" | "summary" | "search" | "custom",
      _customQuery?: string
    ) => {}
  ); // Ref for sendContextToAI

  // --- State ---
  const [isRecording, setIsRecording] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("camera");
  const [isLoading, setIsLoading] = useState(false); // Unified loading state
  const [realTimeAnalysisEnabled, setRealTimeAnalysisEnabled] = useState(false);
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false); // State for screenshot toggle
  const [activeAudioSource, setActiveAudioSource] =
    useState<AudioSource>("none"); // Track active audio source

  // Collected data
  const [audioChunks, setAudioChunks] = useState<MediaChunk[]>([]);
  const [screenChunks, setScreenChunks] = useState<MediaChunk[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]); // Screenshot state remains
  const [aiMessages, setAiMessages] = useState<Message[]>([]);

  // State for the final audio blob URL (only set after stopping)
  const [finalAudioUrl, setFinalAudioUrl] = useState<string | null>(null);

  // State for custom prompt
  const [customPrompt, setCustomPrompt] = useState("");

  // State for tracking audio recording time
  const [recordingDuration, setRecordingDuration] = useState(0);

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
      try {
        recorderRef.current.stop();
      } catch (e) {
        console.warn("Error stopping recorder (may already be stopped):", e);
      }
    }
    recorderRef.current = null; // Ensure it's null
  };

  const cleanupIntervals = useCallback(() => {
    if (realTimeIntervalRef.current) clearInterval(realTimeIntervalRef.current);
    if (audioTimerRef.current) clearInterval(audioTimerRef.current); // Make sure this is cleared
    realTimeIntervalRef.current = null;
    audioTimerRef.current = null;
  }, []);

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
      if (!blob || !(blob instanceof Blob) || blob.size === 0) {
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

  const formatTime = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const compressAudioIfNeeded = async (blob: Blob): Promise<Blob> => {
    if (!blob || blob.size <= MAX_AUDIO_BYTES_FOR_AI) {
      return blob;
    }
    console.warn(
      `Audio size (${(blob.size / 1024).toFixed(1)} KB) > limit (${(MAX_AUDIO_BYTES_FOR_AI / 1024).toFixed(1)} KB). Trimming (simple slice).`
    );
    return blob.slice(0, MAX_AUDIO_BYTES_FOR_AI, blob.type);
  };

  const takeScreenshot = useCallback(() => {
    const videoElement =
      captureMode === "camera" ? videoRef.current : screenVideoRef.current;

    if (
      !videoElement ||
      videoElement.readyState < 2 ||
      videoElement.videoWidth === 0 ||
      videoElement.videoHeight === 0
    ) {
      console.warn(
        "Screenshot skipped: Video element not ready or has no dimensions."
      );
      return;
    }

    const canvas = document.createElement("canvas");
    canvas.width = videoElement.videoWidth;
    canvas.height = videoElement.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      console.error("Screenshot failed: Could not get 2D context.");
      return;
    }

    try {
      ctx.drawImage(videoElement, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.8);
      const description = `${captureMode} view at ${new Date().toLocaleTimeString()}`;
      console.log("Taking screenshot...");

      setScreenshots((prev: Screenshot[]) =>
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
      console.error("Screenshot failed during draw/conversion:", e);
    }
  }, [captureMode, setScreenshots]);

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let initialTimeoutId: NodeJS.Timeout | null = null;

    if (isRecording && screenshotsEnabled) {
      const startDelay = 2500;
      console.log(
        `Screenshots enabled & recording. Setting ${startDelay}ms initial timeout.`
      );

      initialTimeoutId = setTimeout(() => {
        if (isRecording && screenshotsEnabled) {
          takeScreenshot();
          intervalId = setInterval(takeScreenshot, SCREENSHOT_INTERVAL_MS);
          console.log(
            `Screenshot interval started (every ${SCREENSHOT_INTERVAL_MS}ms).`
          );
        } else {
          console.log(
            "Conditions changed during initial screenshot delay, not starting interval."
          );
        }
        initialTimeoutId = null;
      }, startDelay);
    } else {
      console.log(
        `Screenshot interval conditions not met (isRecording: ${isRecording}, screenshotsEnabled: ${screenshotsEnabled}).`
      );
    }

    return () => {
      if (initialTimeoutId) {
        clearTimeout(initialTimeoutId);
        console.log("Cleared initial screenshot timeout.");
      }
      if (intervalId) {
        clearInterval(intervalId);
        console.log("Cleared screenshot interval.");
      }
    };
  }, [isRecording, screenshotsEnabled, takeScreenshot]);

  const startAudioRecording = useCallback(
    async (stream: MediaStream, source: AudioSource): Promise<boolean> => {
      console.log(`Starting ${source} audio recording...`);
      try {
        cleanupRecorder(audioRecorderRef);
        cleanupStream(audioStreamRef);

        audioStreamRef.current = stream;
        const mimeType = getSupportedMimeType("audio");
        const recorder = new MediaRecorder(stream, { mimeType });
        audioRecorderRef.current = recorder;

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            setAudioChunks((prev: MediaChunk[]) => [
              ...prev,
              { blob: event.data, timestamp: Date.now() },
            ]);
          }
        };
        recorder.onerror = (e) => console.error(`${source} recorder error:`, e);
        recorder.onstop = () => {
          console.log(`${source} recorder stopped. Processing final blob.`);
          setActiveAudioSource("none");
          setAudioChunks((prevChunks: MediaChunk[]) => {
            if (prevChunks.length > 0) {
              const finalBlob = new Blob(
                prevChunks.map((c) => c.blob),
                { type: mimeType }
              );
              console.log(
                `Final ${source} audio blob size: ${(finalBlob.size / 1024).toFixed(1)} KB`
              );
              const url = URL.createObjectURL(finalBlob);
              setFinalAudioUrl(url);
            } else {
              setFinalAudioUrl(null);
            }
            return [];
          });
          if (audioTimerRef.current) {
            clearInterval(audioTimerRef.current);
            audioTimerRef.current = null;
          }
          setRecordingDuration(0);
        };

        setRecordingDuration(0);

        audioTimerRef.current = setInterval(() => {
          setRecordingDuration((prev: number) => prev + 1);
        }, 1000);

        recorder.start(AUDIO_CHUNK_TIMESLICE_MS);
        setActiveAudioSource(source);
        console.log(`${source} recorder started successfully.`);
        return true;
      } catch (error) {
        console.error(`Failed to start ${source} audio recording:`, error);
        setAiMessages((prev: Message[]) => [
          ...prev,
          {
            id: `err-audio-${source}-${Date.now()}`,
            role: "assistant",
            content: `[Error starting ${source} audio: ${
              error instanceof Error ? error.message : "Unknown error"
            }]`,
          },
        ]);
        cleanupStream(audioStreamRef);
        cleanupRecorder(audioRecorderRef);
        setActiveAudioSource("none");
        if (audioTimerRef.current) {
          clearInterval(audioTimerRef.current);
          audioTimerRef.current = null;
        }
        return false;
      }
    },
    [getSupportedMimeType]
  );

  const startMicRecording = useCallback(async (): Promise<boolean> => {
    console.log("Attempting to start microphone recording...");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      return await startAudioRecording(stream, "mic");
    } catch (error) {
      console.error("Failed to get microphone stream:", error);
      setAiMessages((prev: Message[]) => [
        ...prev,
        {
          id: `err-mic-getUserMedia-${Date.now()}`,
          role: "assistant",
          content: `[Error getting microphone: ${
            error instanceof Error ? error.message : "Permission denied?"
          }]`,
        },
      ]);
      setActiveAudioSource("none");
      return false;
    }
  }, [startAudioRecording]);

  const stopRecordingInternal = useCallback(() => {
    if (!isRecording && !isLoading) {
      console.log("Stop recording called but not recording.");
      return;
    }
    console.log("Initiating stop recording sequence...");
    setIsLoading(true);

    setIsRecording(false);
    console.log(
      "Recording state set to false. Effects should handle interval cleanup."
    );

    cleanupIntervals();

    cleanupRecorder(audioRecorderRef);
    cleanupRecorder(screenRecorderRef);

    cleanupStream(audioStreamRef);
    cleanupStream(videoStreamRef);
    cleanupStream(screenStreamRef);

    if (videoRef.current) videoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;

    setRealTimeAnalysisEnabled(false);
    setRecordingDuration(0);

    setAudioChunks([]);
    setScreenChunks([]);

    console.log("Recording stopped.");
    setIsLoading(false);
  }, [isRecording, isLoading, cleanupIntervals]);

  const stopRecording = useCallback(stopRecordingInternal, [
    stopRecordingInternal,
  ]);

  const startVideoOrScreenRecording = useCallback(
    async (
      mode: CaptureMode
    ): Promise<{ videoStarted: boolean; audioStarted: boolean }> => {
      console.log(`Starting ${mode} recording setup...`);
      let stream: MediaStream | null = null;
      const videoElement =
        mode === "camera" ? videoRef.current : screenVideoRef.current;
      const streamRef = mode === "camera" ? videoStreamRef : screenStreamRef;
      let videoStarted = false;
      let audioStarted = false;

      try {
        if (mode === "camera") {
          stream = await navigator.mediaDevices.getUserMedia({ video: true });
        } else {
          stream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 10 },
            audio: true,
          });

          if (stream && stream.getAudioTracks().length > 0) {
            console.log("System audio track detected in display media stream.");
            audioStarted = await startAudioRecording(stream, "system");
            if (!audioStarted) {
              console.warn(
                "System audio track present but failed to start recorder."
              );
              stream.getAudioTracks().forEach((track) => track.stop());
            }
          } else {
            console.log(
              "No system audio track captured or user denied permission."
            );
          }

          const videoTrack = stream?.getVideoTracks()[0];
          if (videoTrack) {
            videoTrack.onended = () => {
              console.log("Screen share stopped by user via browser UI.");
              if (isRecording && captureMode === "screen") {
                console.log(
                  "Stopping recording session because screen share ended."
                );
                stopRecording();
              }
            };
          }

          if (stream && stream.getVideoTracks().length > 0) {
            cleanupRecorder(screenRecorderRef);
            const screenMimeType = getSupportedMimeType("video");
            const screenRecorder = new MediaRecorder(stream, {
              mimeType: screenMimeType,
              ignoreMutedMedia: true,
            });
            screenRecorderRef.current = screenRecorder;

            screenRecorder.ondataavailable = (event: BlobEvent) => {
              if (event.data.size > 0) {
                setScreenChunks((prev: MediaChunk[]) => [
                  ...prev,
                  { blob: event.data, timestamp: Date.now() },
                ]);
              }
            };
            screenRecorder.onerror = (e) =>
              console.error("Screen recorder error:", e);
            screenRecorder.onstop = () => {
              console.log("Screen recorder stopped.");
              setScreenChunks([]);
            };
            screenRecorder.start(AUDIO_CHUNK_TIMESLICE_MS * 2);
            console.log("Screen recorder (video) started.");
          }
        }

        if (stream && stream.getVideoTracks().length > 0) {
          streamRef.current = stream;
          if (videoElement) {
            videoElement.srcObject = stream;
            await videoElement
              .play()
              .catch((e: Error) =>
                console.warn(`${mode} preview play warning:`, e)
              );
          }
          videoStarted = true;
          console.log(`${mode} video stream started successfully.`);
        } else if (mode === "screen" && audioStarted) {
          console.log("Screen share started with audio only.");
        } else {
          console.warn(`No video tracks found for ${mode} mode.`);
        }

        return { videoStarted, audioStarted };
      } catch (error) {
        console.error(`Failed to start ${mode} recording:`, error);
        setAiMessages((prev: Message[]) => [
          ...prev,
          {
            id: `err-${mode}-${Date.now()}`,
            role: "assistant",
            content: `[Error starting ${mode}: ${
              error instanceof Error ? error.message : "Permission denied?"
            }]`,
          },
        ]);
        cleanupStream(streamRef);
        if (mode === "screen") {
          cleanupRecorder(screenRecorderRef);
          if (audioStreamRef.current && activeAudioSource === "system") {
            cleanupStream(audioStreamRef);
            cleanupRecorder(audioRecorderRef);
            setActiveAudioSource("none");
          }
        }
        return { videoStarted: false, audioStarted: false };
      }
    },
    [
      getSupportedMimeType,
      stopRecording,
      isRecording,
      captureMode,
      startAudioRecording,
      activeAudioSource,
    ]
  );

  const startRecording = useCallback(async () => {
    if (isRecording || isLoading) return;
    console.log("Initiating start recording sequence...");
    setIsLoading(true);
    setAiMessages([]);
    setAudioChunks([]);
    setScreenChunks([]);
    setScreenshots([]);
    if (finalAudioUrl) URL.revokeObjectURL(finalAudioUrl);
    setFinalAudioUrl(null);
    setRecordingDuration(0);
    setActiveAudioSource("none");

    const mediaStatus = await startVideoOrScreenRecording(captureMode);
    let micAudioStarted = false;

    if (
      !mediaStatus.audioStarted &&
      (captureMode === "screen" || captureMode === "camera")
    ) {
      console.log(
        `System audio not started (${captureMode} mode), attempting microphone...`
      );
      micAudioStarted = await startMicRecording();
    }

    const overallAudioStarted = mediaStatus.audioStarted || micAudioStarted;
    const overallRecordingStarted =
      mediaStatus.videoStarted || overallAudioStarted;

    if (overallRecordingStarted) {
      setIsRecording(true);
      console.log(
        `Recording state set to true. Video: ${mediaStatus.videoStarted}, Audio: ${overallAudioStarted} (${activeAudioSource})`
      );
    } else {
      console.error("Failed to start any recording source. Cleaning up.");
      cleanupStream(audioStreamRef);
      cleanupRecorder(audioRecorderRef);
      cleanupStream(videoStreamRef);
      cleanupStream(screenStreamRef);
      cleanupRecorder(screenRecorderRef);
      cleanupIntervals();
      setIsRecording(false);
      setActiveAudioSource("none");
    }
    setIsLoading(false);
  }, [
    isRecording,
    isLoading,
    captureMode,
    startVideoOrScreenRecording,
    startMicRecording,
    finalAudioUrl,
    cleanupIntervals,
    activeAudioSource,
  ]);

  const gatherCurrentContext = useCallback(
    async (type: "real-time" | "manual"): Promise<AIContextData | null> => {
      console.log(`Gathering context for ${type} AI action...`);

      let audioBlob: Blob | null = null;
      let screenBlob: Blob | null = null;

      // --- Audio Processing ---
      // Use all collected audio chunks
      const relevantAudioChunks = audioChunks; // Use all chunks

      if (relevantAudioChunks.length > 0) {
        const mime =
          relevantAudioChunks[0]?.blob.type || getSupportedMimeType("audio");
        let tempAudioBlob = new Blob(
          relevantAudioChunks.map((c) => c.blob),
          { type: mime }
        );
        console.log(
          `Using all ${relevantAudioChunks.length} audio chunks. Original size: ${(tempAudioBlob.size / 1024).toFixed(1)} KB` // Updated log message
        );
        // Still compress/trim if the total size exceeds the byte limit
        audioBlob = await compressAudioIfNeeded(tempAudioBlob);
        if (audioBlob.size !== tempAudioBlob.size) {
          console.log(
            `Compressed/Trimmed audio size: ${(audioBlob.size / 1024).toFixed(1)} KB`
          );
        }
      }

      // --- Screen Processing (Remains the same - still uses a time window for video) ---
      if (captureMode === "screen") {
        const screenContextDurationSec = 30; // Keep video context limited for performance
        const screenChunksNeeded = Math.ceil(
          screenContextDurationSec / ((AUDIO_CHUNK_TIMESLICE_MS * 2) / 1000)
        );
        const relevantScreenChunks = screenChunks.slice(-screenChunksNeeded);

        if (relevantScreenChunks.length > 0) {
          const mime =
            relevantScreenChunks[0]?.blob.type || getSupportedMimeType("video");
          screenBlob = new Blob(
            relevantScreenChunks.map((c) => c.blob),
            { type: mime }
          );
          console.log(
            `Using last ${relevantScreenChunks.length} screen chunks (~${screenContextDurationSec}s). Blob size: ${(screenBlob.size / 1024).toFixed(1)} KB`
          );
        }
      }

      // --- Screenshot Processing (Remains the same) ---
      const numScreenshots = type === "real-time" ? 1 : 3;
      const currentScreenshots = screenshots.slice(0, numScreenshots);

      // --- Final Check & Conversion ---
      if (!audioBlob && !screenBlob && currentScreenshots.length === 0) {
        console.warn("No context data found to send to AI.");
        return null;
      }

      const context: AIContextData = {};
      try {
        if (audioBlob) {
          const base64 = await blobToBase64(audioBlob);
          if (base64)
            context.audio = {
              data: base64.split(",")[1] || "",
              mimeType: audioBlob.type,
            };
        }
        if (screenBlob) {
          const base64 = await blobToBase64(screenBlob);
          if (base64)
            context.video = {
              data: base64.split(",")[1] || "",
              mimeType: screenBlob.type,
            };
        }
        if (currentScreenshots.length > 0) {
          context.screenshots = currentScreenshots.map((ss) => ({
            data: ss.data.split(",")[1] || "",
            mimeType: ss.mimeType,
          }));
        }
      } catch (error) {
        console.error("Error converting blob to base64:", error);
        return null;
      }

      console.log("Context gathered:", {
        audio: !!context.audio,
        video: !!context.video,
        screenshots: context.screenshots?.length ?? 0,
      });
      return context;
    },
    [
      audioChunks, // Keep dependency
      screenChunks,
      screenshots,
      captureMode,
      getSupportedMimeType,
      compressAudioIfNeeded,
      blobToBase64,
    ]
  );

  const sendContextToAI = useCallback(
    async (
      actionType: "real-time" | "answer" | "summary" | "search" | "custom",
      customQuery?: string
    ) => {
      if (isLoading) {
        console.log(`AI Action (${actionType}) skipped: Already loading.`);
        return;
      }
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
            content: `[Cannot perform AI action '${actionType}': No context data available (audio, video, screenshots). Try recording for longer.]`,
          },
        ]);
        setIsLoading(false);
        return;
      }

      const queryMap = {
        answer:
          "Based on the recent context (audio, screen recording, screenshots), please answer the likely implicit question or address the last point made by a participant.",
        summary:
          "Provide a concise bullet-point summary of the key topics, decisions, or action items discussed or shown recently based on the provided context (audio, screen recording, screenshots).",
        search:
          "Identify key entities, technical terms, or questions raised in the recent context (audio, screen recording, screenshots). Suggest relevant information or search queries related to them.",
        "real-time":
          "Analyze the latest context (last ~15s of audio, screen, latest screenshot). Briefly identify any noteworthy keywords, topic shifts, action items, or potential issues. Be concise.",
        custom:
          customQuery ||
          "Please analyze the provided context (audio, screen recording, screenshots) according to the user's request.",
      };
      const query = queryMap[actionType];

      const userMessageContent = actionType === "custom" ? customPrompt : query;
      const userMessage: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessageContent || "Analyze context.",
      };

      if (actionType !== "real-time") {
        setAiMessages((prev) => [...prev, userMessage]);
      }

      try {
        console.log("Sending context to /api/ai...");

        const messageHistory =
          actionType === "real-time"
            ? [userMessage]
            : [...aiMessages, userMessage];

        const payload = {
          messages: messageHistory,
          data: contextData,
        };

        console.log(
          `Sending ${messageHistory.length} messages to AI (${actionType})`
        );

        const response = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(
            `API Error ${response.status}: ${errorText || response.statusText}`
          );
        }

        const result: Message = await response.json();
        console.log("AI Response received:", result);

        if (result && result.content) {
          const prefix =
            actionType === "real-time" ? "[Real-time Analysis] " : "";
          setAiMessages((prev) => [
            ...prev,
            {
              id: result.id || `ai-${Date.now()}`,
              role: "assistant",
              content: `${prefix}${result.content}`,
            },
          ]);
        } else {
          console.warn(
            "AI processed the request but provided no text content in response."
          );
          setAiMessages((prev) => [
            ...prev,
            {
              id: `warn-noresp-${Date.now()}`,
              role: "assistant",
              content:
                "[AI analysis complete, but no text response was generated.]",
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
    [isLoading, gatherCurrentContext, aiMessages, customPrompt]
  );

  useEffect(() => {
    sendContextToAIRef.current = sendContextToAI;
  }, [sendContextToAI]);

  const handleAIAction = (actionType: "answer" | "summary" | "search") => {
    if (!isRecording) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `warn-rec-${Date.now()}`,
          role: "assistant",
          content: "[Please start recording before using manual AI actions.]",
        },
      ]);
      return;
    }
    sendContextToAI(actionType);
  };

  const handleToggleCaptureMode = useCallback(async () => {
    if (!isRecording || isLoading) return;
    setIsLoading(true);
    const oldMode = captureMode;
    const newMode = oldMode === "camera" ? "screen" : "camera";
    console.log(`Switching capture mode from ${oldMode} to ${newMode}`);

    console.log("Stopping existing recorders and streams...");
    cleanupRecorder(audioRecorderRef);
    cleanupRecorder(screenRecorderRef);

    cleanupStream(audioStreamRef);
    cleanupStream(oldMode === "camera" ? videoStreamRef : screenStreamRef);

    setAudioChunks([]);
    setScreenChunks([]);
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    setRecordingDuration(0);
    setActiveAudioSource("none");
    if (videoRef.current) videoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    console.log("Cleanup complete.");

    setCaptureMode(newMode);

    console.log(`Starting recording for new mode: ${newMode}`);
    const mediaStatus = await startVideoOrScreenRecording(newMode);
    let micAudioStarted = false;

    if (
      !mediaStatus.audioStarted &&
      (newMode === "screen" || newMode === "camera")
    ) {
      console.log(
        `System audio not started (${newMode} mode), attempting microphone...`
      );
      micAudioStarted = await startMicRecording();
    }

    const overallAudioStarted = mediaStatus.audioStarted || micAudioStarted;
    const overallRecordingStarted =
      mediaStatus.videoStarted || overallAudioStarted;

    if (!overallRecordingStarted) {
      console.error(
        "Failed to start recording after mode switch. Stopping session."
      );
      stopRecording();
    } else {
      console.log(
        `Capture mode switched successfully to ${newMode}. Video: ${mediaStatus.videoStarted}, Audio: ${overallAudioStarted} (${activeAudioSource})`
      );
      setIsRecording(true);
    }

    setIsLoading(false);
  }, [
    isRecording,
    isLoading,
    captureMode,
    startVideoOrScreenRecording,
    startMicRecording,
    stopRecording,
    activeAudioSource,
  ]);

  const handleToggleRealTime = () => {
    if (isLoading || !isRecording) return;
    setRealTimeAnalysisEnabled((prev) => !prev);
  };

  const handleToggleScreenshots = () => {
    if (isLoading) return;
    setScreenshotsEnabled((prev) => !prev);
    console.log(`Screenshots toggled ${!screenshotsEnabled ? "ON" : "OFF"}`);
  };

  const handleCustomPromptSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customPrompt.trim()) return;

    if (!isRecording) {
      setAiMessages((prev) => [
        ...prev,
        {
          id: `warn-rec-${Date.now()}`,
          role: "assistant",
          content: "[Please start recording before sending a custom prompt.]",
        },
      ]);
      return;
    }

    sendContextToAI("custom", customPrompt);
    setCustomPrompt("");
  };

  useEffect(() => {
    let intervalId: NodeJS.Timeout | null = null;
    let initialTimeoutId: NodeJS.Timeout | null = null;

    if (isRecording && realTimeAnalysisEnabled && !isLoading) {
      console.log("Real-time analysis conditions met. Setting up interval.");

      const initialDelay = 4000;
      console.log(
        `Setting initial ${initialDelay}ms timeout for real-time analysis.`
      );

      initialTimeoutId = setTimeout(() => {
        if (isRecording && realTimeAnalysisEnabled && !isLoading) {
          console.log(
            "Initial real-time analysis timeout fired. Sending context..."
          );
          sendContextToAIRef.current("real-time");
        } else {
          console.log(
            "Conditions changed during initial delay, skipping first analysis."
          );
        }
        initialTimeoutId = null;

        if (isRecording && realTimeAnalysisEnabled && !isLoading) {
          console.log(
            `Setting real-time analysis interval (${REALTIME_ANALYSIS_INTERVAL_MS}ms).`
          );
          intervalId = setInterval(() => {
            if (isRecording && realTimeAnalysisEnabled && !isLoading) {
              console.log(
                "Real-time analysis interval triggered. Sending context..."
              );
              sendContextToAIRef.current("real-time");
            } else {
              console.log(
                "Conditions changed, stopping real-time interval from within."
              );
              if (intervalId) {
                clearInterval(intervalId);
                intervalId = null;
              }
            }
          }, REALTIME_ANALYSIS_INTERVAL_MS);
        }
      }, initialDelay);
    } else {
      console.log(
        `Real-time analysis conditions not met initially (isRecording: ${isRecording}, enabled: ${realTimeAnalysisEnabled}, loading: ${isLoading}). Interval not started.`
      );
    }

    return () => {
      console.log("Cleaning up real-time analysis effect.");
      if (initialTimeoutId) {
        clearTimeout(initialTimeoutId);
        console.log("Cleared initial real-time timeout.");
        initialTimeoutId = null;
      }
      if (intervalId) {
        clearInterval(intervalId);
        console.log("Cleared real-time interval.");
        intervalId = null;
      }
    };
  }, [isRecording, realTimeAnalysisEnabled, isLoading]);

  useEffect(() => {
    return () => {
      console.log("Component unmounting: Performing final cleanup...");
      cleanupStream(audioStreamRef);
      cleanupStream(videoStreamRef);
      cleanupStream(screenStreamRef);
      cleanupRecorder(audioRecorderRef);
      cleanupRecorder(screenRecorderRef);
      cleanupIntervals();
      if (realTimeIntervalRef.current)
        clearInterval(realTimeIntervalRef.current);

      if (finalAudioUrl) {
        try {
          URL.revokeObjectURL(finalAudioUrl);
          console.log("Revoked final audio URL.");
        } catch (e) {
          console.warn("Could not revoke final audio URL:", e);
        }
      }
      setIsRecording(false);
      setIsLoading(false);
    };
  }, [finalAudioUrl, cleanupIntervals]);

  return (
    <div className="container mx-auto max-w-4xl py-8 px-4">
      <h1 className="text-3xl font-bold mb-6 text-center">
        AI Meeting Assistant (Refactored)
      </h1>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span className="flex items-center gap-2">
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
              </span>

              {isRecording && (
                <span className="flex items-center text-sm text-slate-600 dark:text-slate-400">
                  <ClockIcon className="h-4 w-4 mr-1" />
                  Audio: {formatTime(recordingDuration)}
                </span>
              )}
              {isRecording && (
                <span className="ml-2 text-xs font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  Audio: {activeAudioSource.toUpperCase()}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleToggleScreenshots}
                disabled={isLoading}
                className={`${screenshotsEnabled ? "border-green-500 text-green-700 dark:text-green-400 dark:border-green-600 hover:bg-green-50 dark:hover:bg-green-900/20" : ""} ${isLoading ? "opacity-50 cursor-not-allowed" : ""}`}
                title={`${screenshotsEnabled ? "Disable" : "Enable"} Screenshots`}
              >
                {screenshotsEnabled ? (
                  <CameraIcon className="h-4 w-4 mr-2" />
                ) : (
                  <CameraOffIcon className="h-4 w-4 mr-2" />
                )}
                {screenshotsEnabled ? "Screenshots ON" : "Screenshots OFF"}
              </Button>

              {isRecording && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleToggleCaptureMode}
                  disabled={isLoading}
                  title={
                    captureMode === "screen"
                      ? "Switch to Camera"
                      : "Switch to Screen Share"
                  }
                >
                  <SwitchCameraIcon className="h-4 w-4 mr-2" />
                  {captureMode === "camera"
                    ? "Switch to Screen"
                    : "Switch to Camera"}
                </Button>
              )}
              {isRecording ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={stopRecording}
                  disabled={isLoading && !isRecording}
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
                  )}
                  Start
                </Button>
              )}
            </div>
          </CardTitle>
        </CardHeader>
      </Card>

      <Card className="mb-6">
        <CardContent className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <h3 className="font-medium text-sm">
              {captureMode === "camera" ? "Camera Feed" : "Screen Preview"}
            </h3>
            <div className="aspect-video bg-slate-800 rounded border border-slate-700 relative overflow-hidden">
              <video
                ref={videoRef}
                muted
                playsInline
                className={`w-full h-full object-cover absolute inset-0 transition-opacity duration-300 ${captureMode === "camera" && isRecording ? "opacity-100 z-10" : "opacity-0 z-0"}`}
              />
              <video
                ref={screenVideoRef}
                muted
                playsInline
                className={`w-full h-full object-contain absolute inset-0 transition-opacity duration-300 ${captureMode === "screen" && isRecording ? "opacity-100 z-10" : "opacity-0 z-0"}`}
              />
              {(!isRecording || isLoading) && (
                <div className="absolute inset-0 flex items-center justify-center text-slate-500 text-sm z-0">
                  {isLoading ? "Starting..." : "Preview Area"}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <h3 className="font-medium text-sm">
                Audio Playback (Available After Stop)
              </h3>
              <audio
                ref={audioPlayerRef}
                controls
                src={finalAudioUrl ?? undefined}
                className={`w-full ${!finalAudioUrl ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{ pointerEvents: finalAudioUrl ? "auto" : "none" }}
              />
              {!finalAudioUrl && !isRecording && (
                <p className="text-xs text-slate-500">
                  No audio recorded or recording stopped prematurely.
                </p>
              )}
              {isRecording && (
                <p className="text-xs text-slate-500">
                  Audio player will be active after recording stops.
                </p>
              )}
            </div>
            <div className="space-y-2">
              <h3 className="font-medium text-sm flex items-center justify-between">
                <span>
                  Recent Screenshots ({screenshots.length}/{MAX_SCREENSHOTS})
                </span>
                {!screenshotsEnabled && (
                  <span className="text-xs text-red-500 font-normal">
                    (Disabled)
                  </span>
                )}
              </h3>
              <div
                className={`grid grid-cols-3 gap-2 min-h-[60px] p-2 rounded bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 ${!screenshotsEnabled ? "opacity-60" : ""}`}
              >
                {screenshots.length > 0 ? (
                  screenshots.map((ss) => (
                    <div
                      key={ss.timestamp}
                      className="aspect-video bg-slate-700 rounded overflow-hidden border border-slate-600 group relative"
                    >
                      <img
                        src={ss.data}
                        alt="screenshot"
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                      <div
                        className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] px-1 py-0.5 opacity-0 group-hover:opacity-100 transition-opacity truncate"
                        title={ss.description}
                      >
                        {ss.description}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="col-span-3 text-center text-xs text-slate-500 py-4">
                    {screenshotsEnabled
                      ? "No screenshots captured yet..."
                      : "Screenshot capture is disabled."}
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

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
                    : "Start recording to enable"
                }
                className={`w-[60px] ${isLoading || !isRecording ? "opacity-50 cursor-not-allowed" : ""}`}
              >
                {realTimeAnalysisEnabled ? "ON" : "OFF"}
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3 mb-4 pb-4 border-b border-slate-200 dark:border-slate-700">
            {[
              {
                action: "answer",
                label: "AI Answer",
                icon: MicIcon,
                title: "Ask AI to answer based on context",
              },
              {
                action: "summary",
                label: "AI Summary",
                icon: ListCollapseIcon,
                title: "Ask AI to summarize context",
              },
              {
                action: "search",
                label: "AI Topics",
                icon: SearchIcon,
                title: "Ask AI for topics/keywords",
              },
            ].map(({ action, label, icon: Icon, title }) => (
              <Button
                key={action}
                variant="outline"
                size="sm"
                onClick={() =>
                  handleAIAction(action as "answer" | "summary" | "search")
                }
                disabled={isLoading || !isRecording}
                title={!isRecording ? "Start recording first" : title}
                className={
                  isLoading || !isRecording
                    ? "opacity-50 cursor-not-allowed"
                    : ""
                }
              >
                <Icon className="h-4 w-4 mr-2" /> {label}
              </Button>
            ))}
          </div>

          <form onSubmit={handleCustomPromptSubmit} className="flex gap-2 mb-4">
            <Input
              placeholder="Enter custom prompt (e.g., 'What were the action items?')"
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              disabled={isLoading || !isRecording}
              className="flex-grow disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <Button
              type="submit"
              variant="default"
              size="icon"
              disabled={isLoading || !isRecording || !customPrompt.trim()}
              title={
                !isRecording
                  ? "Start recording first"
                  : "Send custom prompt to AI"
              }
              className="disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <SendIcon className="h-4 w-4" />
            </Button>
          </form>

          <div className="space-y-3 min-h-[100px]">
            <h3 className="font-semibold text-sm">Output:</h3>
            {isLoading && aiMessages.length === 0 && (
              <div className="flex items-center text-sm text-slate-500">
                {" "}
                <Loader2Icon className="h-4 w-4 mr-2 animate-spin" /> Waiting
                for first AI response...{" "}
              </div>
            )}
            {aiMessages.length === 0 && !isLoading && (
              <div className="text-center text-sm text-slate-400 py-4">
                AI responses will appear here. Start recording and use AI
                actions.
              </div>
            )}
            <div className="space-y-2 max-h-[40vh] overflow-y-auto pr-2 scrollbar-thin border rounded p-2 border-slate-200 dark:border-slate-700 bg-white dark:bg-black">
              {aiMessages.map((msg) => (
                <div
                  key={msg.id}
                  className={`p-2 rounded text-sm border-l-4 mb-2 last:mb-0 ${
                    msg.role === "assistant"
                      ? msg.content.startsWith("[Error") ||
                        msg.content.startsWith("[Cannot perform")
                        ? "bg-red-50 dark:bg-red-900/30 border-red-500 text-red-700 dark:text-red-300"
                        : msg.content.startsWith("[Warn") ||
                            msg.content.includes("no text response")
                          ? "bg-yellow-50 dark:bg-yellow-900/30 border-yellow-500 text-yellow-700 dark:text-yellow-300"
                          : msg.content.startsWith("[Real-time")
                            ? "bg-purple-50 dark:bg-purple-900/30 border-purple-500 text-purple-800 dark:text-purple-300"
                            : "bg-slate-100 dark:bg-slate-800/60 border-slate-400 dark:border-slate-600 text-slate-800 dark:text-slate-200"
                      : "bg-blue-50 dark:bg-blue-900/30 border-blue-500 text-blue-800 dark:text-blue-300"
                  }`}
                >
                  <p className="whitespace-pre-wrap break-words">
                    {msg.content.replace(
                      /^(?:\[.*?\]\s*)/,
                      (match) => `**${match.trim()}** `
                    )}
                  </p>
                </div>
              ))}
              {isLoading && aiMessages.length > 0 && (
                <div className="flex items-center text-sm text-slate-500 pt-2">
                  <Loader2Icon className="h-4 w-4 mr-2 animate-spin" /> Waiting
                  for AI response...
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
