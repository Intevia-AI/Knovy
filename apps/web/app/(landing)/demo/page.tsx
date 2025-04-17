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
import { Markdown } from "./markdown";
import RealTimeAnalysis from "@/components/RealTimeAnalysis";

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

type AudioSource = "mic" | "system";

// Context structure for AI
type AIContextData = {
  micAudio?: { data: string; mimeType: string };
  systemAudio?: { data: string; mimeType: string };
  video?: { data: string; mimeType: string }; // For screen recordings
  screenshots?: { data: string; mimeType: string }[];
};

// --- Constants ---
const SCREENSHOT_INTERVAL_MS = 5000; // 5 seconds
const REALTIME_ANALYSIS_INTERVAL_MS = 15000; // 15 seconds
const AUDIO_CHUNK_TIMESLICE_MS = 5000; // 3 second chunks
const MAX_SCREENSHOTS = 5;
const MAX_AUDIO_BYTES_FOR_AI = 5 * 1024 * 1024; // 5MB limit for AI audio

// --- Full Code ---
export default function Page() {
  // --- Refs ---
  const videoRef = useRef<HTMLVideoElement>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const audioPlayerRef = useRef<HTMLAudioElement>(null); // Ref for player (plays mic audio)

  const micAudioStreamRef = useRef<MediaStream | null>(null);
  const systemAudioStreamRef = useRef<MediaStream | null>(null);
  const videoStreamRef = useRef<MediaStream | null>(null); // Camera stream
  const screenStreamRef = useRef<MediaStream | null>(null); // Display stream (video part)

  const micAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const systemAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const screenRecorderRef = useRef<MediaRecorder | null>(null); // For screen video

  const realTimeIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const audioTimerRef = useRef<NodeJS.Timeout | null>(null); // Tracks mic recording duration
  const sendContextToAIRef = useRef(
    async (
      _actionType: "real-time" | "answer" | "summary" | "search" | "custom",
      _customQuery?: string
    ) => {}
  ); // Ref for sendContextToAI

  // --- State ---
  const [isRecording, setIsRecording] = useState(false);
  const [captureMode, setCaptureMode] = useState<CaptureMode>("screen");
  const [isLoading, setIsLoading] = useState(false); // Unified loading state
  const [realTimeAnalysisEnabled, setRealTimeAnalysisEnabled] = useState(false);
  const [screenshotsEnabled, setScreenshotsEnabled] = useState(false); // State for screenshot toggle
  const [activeAudioSources, setActiveAudioSources] = useState<AudioSource[]>(
    []
  ); // Track active audio sources

  // Collected data
  const [micAudioChunks, setMicAudioChunks] = useState<MediaChunk[]>([]);
  const [systemAudioChunks, setSystemAudioChunks] = useState<MediaChunk[]>([]);
  const [screenChunks, setScreenChunks] = useState<MediaChunk[]>([]);
  const [screenshots, setScreenshots] = useState<Screenshot[]>([]); // Screenshot state remains
  const [aiMessages, setAiMessages] = useState<Message[]>([]);

  // State for the final audio blob URL (only set after stopping)
  const [finalMicAudioUrl, setFinalMicAudioUrl] = useState<string | null>(null);

  // State for custom prompt
  const [customPrompt, setCustomPrompt] = useState("");

  // State for tracking audio recording time
  const [micRecordingDuration, setMicRecordingDuration] = useState(0);

  // State for keywords
  const [keywords, setKeywords] = useState<string[]>([]);
  const [selectedKeyword, setSelectedKeyword] = useState<string | null>(null);

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
    if (recorderRef.current) {
      console.log(
        `Cleanup: Recorder state before stop: ${recorderRef.current.state}`
      ); // Log state before stopping
      if (recorderRef.current.state !== "inactive") {
        try {
          recorderRef.current.stop();
        } catch (e) {
          console.warn("Error stopping recorder (may already be stopped):", e);
        }
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
      `Audio size (${(blob.size / 1024).toFixed(1)} KB) > limit (${(MAX_AUDIO_BYTES_FOR_AI / 1024).toFixed(1)} KB). Trimming to keep the most recent audio.`
    );
    // Keep the last MAX_AUDIO_BYTES_FOR_AI bytes
    return blob.slice(blob.size - MAX_AUDIO_BYTES_FOR_AI, blob.size, blob.type);
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

  const setupAudioRecorder = useCallback(
    (
      stream: MediaStream,
      source: AudioSource,
      setChunks: React.Dispatch<React.SetStateAction<MediaChunk[]>>,
      recorderRef: React.MutableRefObject<MediaRecorder | null>,
      streamRef: React.MutableRefObject<MediaStream | null>,
      onStopCallback?: () => void
    ): boolean => {
      console.log(`Setting up ${source} audio recorder...`);
      try {
        cleanupRecorder(recorderRef);

        streamRef.current = stream;
        const mimeType = getSupportedMimeType("audio");
        console.log(`Using ${source} audio mimeType: ${mimeType}`);
        const recorder = new MediaRecorder(stream, { mimeType });
        recorderRef.current = recorder;

        // Log track states within the stream being recorded
        stream.getTracks().forEach((track) => {
          console.log(
            `  ${source} Track (${track.kind} - ${track.id}): readyState=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}`
          );
          track.onended = () =>
            console.warn(
              ` >> ${source} Track (${track.kind} - ${track.id}) ended unexpectedly!`
            );
          track.onmute = () =>
            console.log(
              ` >> ${source} Track (${track.kind} - ${track.id}) muted.`
            );
          track.onunmute = () =>
            console.log(
              ` >> ${source} Track (${track.kind} - ${track.id}) unmuted.`
            );
        });

        recorder.ondataavailable = (event: BlobEvent) => {
          if (event.data.size > 0) {
            console.log(
              `${source} chunk received: ${(event.data.size / 1024).toFixed(1)} KB`
            );
            setChunks((prev: MediaChunk[]) => [
              ...prev,
              { blob: event.data, timestamp: Date.now() },
            ]);
          }
        };
        recorder.onerror = (e) => console.error(`${source} recorder error:`, e);
        recorder.onstop = () => {
          console.log(`${source} recorder stopped.`);
          setActiveAudioSources((prev) => prev.filter((s) => s !== source));
          if (onStopCallback) {
            onStopCallback();
          }
        };

        console.log(
          `Starting ${source} recorder. Current state: ${recorder.state}`
        );
        recorder.start(AUDIO_CHUNK_TIMESLICE_MS);
        setActiveAudioSources((prev) => [...new Set([...prev, source])]);
        console.log(
          `${source} recorder started successfully. New state: ${recorder.state}`
        );
        return true;
      } catch (error) {
        console.error(`Failed to setup ${source} audio recorder:`, error);
        setAiMessages((prev: Message[]) => [
          ...prev,
          {
            id: `err-setup-${source}-${Date.now()}`,
            role: "assistant",
            content: `[Error setting up ${source} audio: ${
              error instanceof Error ? error.message : "Unknown error"
            }]`,
          },
        ]);
        cleanupStream(streamRef);
        cleanupRecorder(recorderRef);
        setActiveAudioSources((prev) => prev.filter((s) => s !== source));
        return false;
      }
    },
    [getSupportedMimeType]
  );

  const startMicRecording = useCallback(async (): Promise<boolean> => {
    console.log("Attempting to start microphone recording...");
    if (activeAudioSources.includes("mic")) {
      console.log("Microphone recording already active.");
      return true;
    }
    try {
      cleanupStream(micAudioStreamRef);
      console.log("Requesting microphone access...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      console.log("Microphone stream acquired:", stream.id);
      stream.getAudioTracks().forEach((track) => {
        console.log(
          `  Mic Track (${track.id}): readyState=${track.readyState}, enabled=${track.enabled}`
        );
        track.onended = () =>
          console.warn(` >> Mic Track (${track.id}) ended!`); // Add onended here too
      });

      const success = setupAudioRecorder(
        stream,
        "mic",
        setMicAudioChunks,
        micAudioRecorderRef,
        micAudioStreamRef,
        () => {
          console.log("Processing final mic blob.");
          setMicAudioChunks((prevChunks: MediaChunk[]) => {
            if (prevChunks.length > 0) {
              const mimeType =
                prevChunks[0]?.blob.type || getSupportedMimeType("audio");
              const finalBlob = new Blob(
                prevChunks.map((c) => c.blob),
                { type: mimeType }
              );
              console.log(
                `Final mic audio blob size: ${(finalBlob.size / 1024).toFixed(1)} KB`
              );
              const url = URL.createObjectURL(finalBlob);
              setFinalMicAudioUrl(url);
            } else {
              setFinalMicAudioUrl(null);
            }
            return [];
          });
          if (audioTimerRef.current) {
            clearInterval(audioTimerRef.current);
            audioTimerRef.current = null;
          }
          setMicRecordingDuration(0);
        }
      );

      if (success) {
        setMicRecordingDuration(0);
        if (audioTimerRef.current) clearInterval(audioTimerRef.current);
        audioTimerRef.current = setInterval(() => {
          setMicRecordingDuration((prev: number) => prev + 1);
        }, 1000);
      }
      console.log(`Microphone recording setup result: ${success}`);
      return success;
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
      setActiveAudioSources((prev) => prev.filter((s) => s !== "mic"));
      return false;
    }
  }, [setupAudioRecorder, activeAudioSources, getSupportedMimeType]);

  const startSystemAudioRecording = useCallback(
    async (streamWithAudio: MediaStream): Promise<boolean> => {
      console.log("Attempting to start system audio recording...");
      if (activeAudioSources.includes("system")) {
        console.log("System audio recording already active.");
        return true;
      }

      const audioTracks = streamWithAudio.getAudioTracks();
      if (audioTracks.length === 0) {
        console.log("No audio tracks found in the provided stream.");
        return false;
      }
      console.log(`Found ${audioTracks.length} system audio track(s).`);
      audioTracks.forEach((track) => {
        console.log(
          `  System Audio Track (${track.id}): readyState=${track.readyState}, enabled=${track.enabled}`
        );
        track.onended = () =>
          console.warn(` >> System Audio Track (${track.id}) ended!`); // Add onended here too
      });

      const audioOnlyStream = new MediaStream(audioTracks);
      cleanupStream(systemAudioStreamRef);

      const success = setupAudioRecorder(
        audioOnlyStream,
        "system",
        setSystemAudioChunks,
        systemAudioRecorderRef,
        systemAudioStreamRef,
        () => {
          console.log("Clearing system audio chunks.");
          setSystemAudioChunks([]);
        }
      );
      console.log(`System audio recording setup result: ${success}`);
      return success;
    },
    [setupAudioRecorder, activeAudioSources]
  );

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

    console.log("Stopping recorders...");
    cleanupRecorder(micAudioRecorderRef);
    cleanupRecorder(systemAudioRecorderRef);
    cleanupRecorder(screenRecorderRef);

    console.log("Cleaning up streams...");
    cleanupStream(micAudioStreamRef);
    cleanupStream(systemAudioStreamRef);
    cleanupStream(videoStreamRef);
    cleanupStream(screenStreamRef);

    if (videoRef.current) videoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;

    setRealTimeAnalysisEnabled(false);
    setActiveAudioSources([]);

    setMicAudioChunks([]);
    setSystemAudioChunks([]);
    setScreenChunks([]);

    console.log("Recording stopped and resources cleaned up.");
    setIsLoading(false);
  }, [isRecording, isLoading, cleanupIntervals]);

  const stopRecording = useCallback(stopRecordingInternal, [
    stopRecordingInternal,
  ]);

  const startVideoOrScreenRecording = useCallback(
    async (
      mode: CaptureMode
    ): Promise<{ videoStarted: boolean; audioSources: AudioSource[] }> => {
      console.log(`Starting ${mode} recording setup...`);
      let videoStream: MediaStream | null = null;
      const videoElement =
        mode === "camera" ? videoRef.current : screenVideoRef.current;
      const videoStreamRefToUse =
        mode === "camera" ? videoStreamRef : screenStreamRef;
      let videoStarted = false;
      const startedAudioSources: AudioSource[] = [];

      try {
        if (mode === "camera") {
          console.log("Requesting camera access...");
          videoStream = await navigator.mediaDevices.getUserMedia({
            video: true,
          });
          console.log("Camera stream acquired:", videoStream.id);
          videoStream.getVideoTracks().forEach((track) => {
            console.log(
              `  Camera Video Track (${track.id}): readyState=${track.readyState}, enabled=${track.enabled}`
            );
            track.onended = () =>
              console.warn(` >> Camera Video Track (${track.id}) ended!`);
          });
          const micStarted = await startMicRecording();
          if (micStarted) startedAudioSources.push("mic");
        } else {
          console.log("Requesting display media access...");
          const displayStream = await navigator.mediaDevices.getDisplayMedia({
            video: { frameRate: 10 },
            audio: true,
          });
          console.log("Display stream acquired:", displayStream.id);
          videoStream = displayStream; // Keep the full stream

          // Log initial state of all tracks in displayStream
          displayStream.getTracks().forEach((track) => {
            console.log(
              `  Display Track (${track.kind} - ${track.id}): readyState=${track.readyState}, enabled=${track.enabled}, muted=${track.muted}`
            );
            // Add onended listener immediately
            track.onended = () =>
              console.warn(
                ` >> Display Track (${track.kind} - ${track.id}) ended!`
              );
          });

          // Attempt system audio recording
          if (displayStream.getAudioTracks().length > 0) {
            console.log("System audio track detected. Attempting setup...");
            const systemStarted =
              await startSystemAudioRecording(displayStream);
            if (systemStarted) {
              startedAudioSources.push("system");
            } else {
              console.warn(
                "System audio track present but failed to start recorder. Stopping track(s)."
              );
              // Stop only the audio tracks if recorder failed
              displayStream.getAudioTracks().forEach((track) => track.stop());
            }
          } else {
            console.log(
              "No system audio track captured or user denied permission."
            );
          }

          // Attempt mic audio recording
          const micStarted = await startMicRecording();
          if (micStarted) startedAudioSources.push("mic");

          // Note: The videoTrack.onended handler from the previous step is still here,
          // but we added individual track logging above which might be more informative.
          // const videoTrack = displayStream?.getVideoTracks()[0];
          // if (videoTrack) {
          //   videoTrack.onended = () => { ... }; // Keep this or rely on the loop above
          // }
        }

        // --- Setup Video ---
        const videoTracks = videoStream?.getVideoTracks() ?? [];
        if (videoTracks.length > 0) {
          console.log(`Setting up video element for ${mode}...`);
          cleanupStream(videoStreamRefToUse);
          videoStreamRefToUse.current = videoStream; // Assign the stream containing the video track
          if (videoElement) {
            videoElement.srcObject = videoStream;
            console.log("Playing video element...");
            await videoElement
              .play()
              .then(() => console.log("Video element playing."))
              .catch((e: Error) =>
                console.warn(`${mode} preview play warning:`, e)
              );
          }
          videoStarted = true;
          console.log(`${mode} video stream started successfully.`);

          // --- Setup Screen Video Recorder (only for screen mode) ---
          if (mode === "screen" && videoStream) {
            // Ensure videoStream is not null
            console.log("Setting up screen video recorder...");
            cleanupRecorder(screenRecorderRef);
            const screenMimeType = getSupportedMimeType("video");
            console.log(`Using screen video mimeType: ${screenMimeType}`);
            // Create a new stream with only the video track for the recorder
            // to avoid potential issues with combined streams in MediaRecorder
            const screenVideoStream = new MediaStream(
              videoStream.getVideoTracks()
            );
            const screenRecorder = new MediaRecorder(screenVideoStream, {
              mimeType: screenMimeType,
              // ignoreMutedMedia: true, // May not be needed if stream only has video
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
            console.log(
              `Starting screen recorder. Current state: ${screenRecorder.state}`
            );
            screenRecorder.start(AUDIO_CHUNK_TIMESLICE_MS * 2);
            console.log(
              `Screen recorder started. New state: ${screenRecorder.state}`
            );
          }
        } else if (startedAudioSources.length > 0) {
          console.log(`${mode} started with audio only.`);
        } else {
          console.warn(`No video tracks found for ${mode} mode.`);
        }

        console.log(
          `startVideoOrScreenRecording finished. videoStarted: ${videoStarted}, audioSources: [${startedAudioSources.join(", ")}]`
        );
        return { videoStarted, audioSources: startedAudioSources };
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
        cleanupStream(videoStreamRefToUse);
        cleanupRecorder(screenRecorderRef);
        if (startedAudioSources.includes("mic")) {
          cleanupRecorder(micAudioRecorderRef);
          cleanupStream(micAudioStreamRef);
        }
        if (startedAudioSources.includes("system")) {
          cleanupRecorder(systemAudioRecorderRef);
          cleanupStream(systemAudioStreamRef);
        }
        setActiveAudioSources([]);
        return { videoStarted: false, audioSources: [] };
      }
    },
    [startMicRecording, startSystemAudioRecording, getSupportedMimeType]
  );

  const startRecording = useCallback(async () => {
    if (isRecording || isLoading) return;
    console.log("Initiating start recording sequence...");
    setIsLoading(true);
    setAiMessages([]);
    setMicAudioChunks([]);
    setSystemAudioChunks([]);
    setScreenChunks([]);
    setScreenshots([]);
    if (finalMicAudioUrl) URL.revokeObjectURL(finalMicAudioUrl);
    setFinalMicAudioUrl(null);
    setMicRecordingDuration(0);
    setActiveAudioSources([]);

    const mediaStatus = await startVideoOrScreenRecording(captureMode);

    const overallRecordingStarted =
      mediaStatus.videoStarted || mediaStatus.audioSources.length > 0;

    if (overallRecordingStarted) {
      setIsRecording(true);
      console.log(
        `Recording state set to true. Video: ${mediaStatus.videoStarted}, Audio Sources: [${mediaStatus.audioSources.join(", ")}]`
      );
    } else {
      console.error("Failed to start any recording source. Cleaning up.");
      stopRecordingInternal();
      setIsRecording(false);
      setActiveAudioSources([]);
    }
    setIsLoading(false);
  }, [
    isRecording,
    isLoading,
    captureMode,
    startVideoOrScreenRecording,
    finalMicAudioUrl,
    stopRecordingInternal,
  ]);

  const gatherCurrentContext = useCallback(
    async (type: "real-time" | "manual"): Promise<AIContextData | null> => {
      console.log(`Gathering context for ${type} AI action...`);

      let micAudioBlob: Blob | null = null;
      let systemAudioBlob: Blob | null = null;
      let screenBlob: Blob | null = null;

      if (micAudioChunks.length > 0) {
        const mime =
          micAudioChunks[0]?.blob.type || getSupportedMimeType("audio");
        let tempBlob = new Blob(
          micAudioChunks.map((c) => c.blob),
          { type: mime }
        );
        console.log(
          `Using ${micAudioChunks.length} mic audio chunks. Size: ${(tempBlob.size / 1024).toFixed(1)} KB`
        );
        micAudioBlob = await compressAudioIfNeeded(tempBlob);
      }

      if (systemAudioChunks.length > 0) {
        const mime =
          systemAudioChunks[0]?.blob.type || getSupportedMimeType("audio");
        let tempBlob = new Blob(
          systemAudioChunks.map((c) => c.blob),
          { type: mime }
        );
        console.log(
          `Using ${systemAudioChunks.length} system audio chunks. Size: ${(tempBlob.size / 1024).toFixed(1)} KB`
        );
        systemAudioBlob = await compressAudioIfNeeded(tempBlob);
      }

      if (captureMode === "screen" && screenChunks.length > 0) {
        const screenContextDurationSec = 30;
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

      const numScreenshots = type === "real-time" ? 1 : 3;
      const currentScreenshots = screenshots.slice(0, numScreenshots);

      if (
        !micAudioBlob &&
        !systemAudioBlob &&
        !screenBlob &&
        currentScreenshots.length === 0
      ) {
        console.warn("No context data found to send to AI.");
        return null;
      }

      const context: AIContextData = {};
      try {
        if (micAudioBlob) {
          const base64 = await blobToBase64(micAudioBlob);
          if (base64)
            context.micAudio = {
              data: base64.split(",")[1] || "",
              mimeType: micAudioBlob.type,
            };
        }
        if (systemAudioBlob) {
          const base64 = await blobToBase64(systemAudioBlob);
          if (base64)
            context.systemAudio = {
              data: base64.split(",")[1] || "",
              mimeType: systemAudioBlob.type,
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
        micAudio: !!context.micAudio,
        systemAudio: !!context.systemAudio,
        video: !!context.video,
        screenshots: context.screenshots?.length ?? 0,
      });
      return context;
    },
    [
      micAudioChunks,
      systemAudioChunks,
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
          "Based on the recent context (microphone audio, system audio, screen recording, screenshots), please answer the likely implicit question or address the last point made.",
        summary:
          "Provide a concise bullet-point summary of the key topics, decisions, or action items discussed or shown recently based on the provided context (microphone audio, system audio, screen recording, screenshots).",
        search:
          "Identify key entities, technical terms, or questions raised in the recent context (microphone audio, system audio, screen recording, screenshots). Suggest relevant information or search queries.",
        "real-time":
          "Analyze the latest context (recent audio, screen, latest screenshot). Briefly identify any noteworthy keywords, topic shifts, action items, or potential issues. Be concise.",
        custom:
          customQuery ||
          "Please analyze the provided context (microphone audio, system audio, screen recording, screenshots) according to the user's request.",
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

    console.log("Stopping existing recorders and streams before switch...");
    cleanupRecorder(micAudioRecorderRef);
    cleanupRecorder(systemAudioRecorderRef);
    cleanupRecorder(screenRecorderRef);

    cleanupStream(micAudioStreamRef);
    cleanupStream(systemAudioStreamRef);
    cleanupStream(oldMode === "camera" ? videoStreamRef : screenStreamRef);

    setMicAudioChunks([]);
    setSystemAudioChunks([]);
    setScreenChunks([]);
    if (audioTimerRef.current) clearInterval(audioTimerRef.current);
    setMicRecordingDuration(0);
    setActiveAudioSources([]);
    if (videoRef.current) videoRef.current.srcObject = null;
    if (screenVideoRef.current) screenVideoRef.current.srcObject = null;
    console.log("Cleanup complete.");

    setCaptureMode(newMode);

    console.log(`Starting recording for new mode: ${newMode}`);
    const mediaStatus = await startVideoOrScreenRecording(newMode);

    const overallRecordingStarted =
      mediaStatus.videoStarted || mediaStatus.audioSources.length > 0;

    if (!overallRecordingStarted) {
      console.error(
        "Failed to start recording after mode switch. Stopping session."
      );
      stopRecordingInternal();
      setIsRecording(false);
    } else {
      console.log(
        `Capture mode switched successfully to ${newMode}. Video: ${mediaStatus.videoStarted}, Audio: [${mediaStatus.audioSources.join(", ")}]`
      );
      setIsRecording(true);
    }

    setIsLoading(false);
  }, [
    isRecording,
    isLoading,
    captureMode,
    startVideoOrScreenRecording,
    stopRecordingInternal,
  ]);

  const handleToggleRealTime = () => {
    setRealTimeAnalysisEnabled(!realTimeAnalysisEnabled);
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
    // This effect now only handles component unmount cleanup.
    return () => {
      console.log("Component unmounting: Performing final cleanup...");

      // Directly call cleanup functions instead of stopRecordingInternal
      // to avoid issues with potentially stale state during StrictMode remounts.
      cleanupIntervals();

      console.log("Unmount Cleanup: Stopping recorders...");
      cleanupRecorder(micAudioRecorderRef);
      cleanupRecorder(systemAudioRecorderRef);
      cleanupRecorder(screenRecorderRef);

      console.log("Unmount Cleanup: Cleaning up streams...");
      cleanupStream(micAudioStreamRef);
      cleanupStream(systemAudioStreamRef);
      cleanupStream(videoStreamRef);
      cleanupStream(screenStreamRef);

      // Revoke URL if it exists
      if (finalMicAudioUrl) {
        try {
          URL.revokeObjectURL(finalMicAudioUrl);
          console.log("Unmount Cleanup: Revoked final mic audio URL.");
        } catch (e) {
          console.warn(
            "Unmount Cleanup: Could not revoke final mic audio URL:",
            e
          );
        }
      }

      // Resetting state here might be less critical as the component is unmounting,
      // but good practice to ensure clean state if it were somehow reused.
      // setIsRecording(false); // State updates in unmount are generally discouraged
      // setIsLoading(false);
      // setActiveAudioSources([]);
      console.log("Unmount Cleanup: Finished.");
    };
    // Add cleanupIntervals and finalMicAudioUrl as dependencies
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cleanupIntervals, finalMicAudioUrl]); // Removed stopRecordingInternal dependency

  const handleTextResponse = useCallback((text: string) => {
    setAiMessages((prev) => {
      // Find the last real-time message or create a new one
      const lastMessage = prev[prev.length - 1];
      if (lastMessage?.content.startsWith("[Real-time Transcription]")) {
        // Update the existing message
        return [
          ...prev.slice(0, -1),
          {
            ...lastMessage,
            content: lastMessage.content + text
          }
        ];
      } else {
        // Create a new message
        return [
          ...prev,
          {
            id: `realtime-${Date.now()}`,
            role: "assistant",
            content: `[Real-time Transcription] ${text}`,
          },
        ];
      }
    });
  }, []);

  const handleKeywords = useCallback((newKeywords: string[]) => {
    setKeywords(prev => {
      // Add new keywords that aren't already in the list
      const uniqueNewKeywords = newKeywords.filter(k => !prev.includes(k));
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
              content: `請用簡單易懂的方式解釋這個專業術語：${keyword}`
            }
          ],
          data: {} // Empty data object as we don't need any context for keyword explanation
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get explanation");
      }

      const data = await response.json();
      const explanation = data.content;

      setAiMessages(prev => [
        ...prev,
        {
          id: `explanation-${Date.now()}`,
          role: "assistant",
          content: `[${keyword} 的解釋] ${explanation}`,
        },
      ]);
    } catch (error) {
      console.error("Error getting keyword explanation:", error);
    } finally {
      setIsLoading(false);
      setSelectedKeyword(null);
    }
  }, []);

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
                  Mic: {formatTime(micRecordingDuration)}
                </span>
              )}
              {isRecording && activeAudioSources.length > 0 && (
                <span className="ml-2 text-xs font-mono px-1.5 py-0.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                  Audio:{" "}
                  {activeAudioSources.map((s) => s.toUpperCase()).join(" + ")}
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
                Mic Audio Playback (Available After Stop)
              </h3>
              <audio
                ref={audioPlayerRef}
                controls
                src={finalMicAudioUrl ?? undefined}
                className={`w-full ${!finalMicAudioUrl ? "opacity-50 cursor-not-allowed" : ""}`}
                style={{ pointerEvents: finalMicAudioUrl ? "auto" : "none" }}
              />
              {!finalMicAudioUrl && !isRecording && (
                <p className="text-xs text-slate-500">
                  No mic audio recorded or recording stopped prematurely.
                </p>
              )}
              {isRecording && (
                <p className="text-xs text-slate-500">
                  Mic audio player will be active after recording stops.
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
              <RealTimeAnalysis 
                onTextResponse={handleTextResponse}
                onKeywords={handleKeywords}
              />
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
                  <Markdown>
                    {msg.content.replace(
                      /^(?:\[.*?\]\s*)/,
                      (match) => `**${match.trim()}** `
                    )}
                  </Markdown>
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

      {keywords.length > 0 && (
        <div className="p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Detected Keywords</h2>
          <div className="flex flex-wrap gap-2">
            {keywords.map((keyword, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleKeywordClick(keyword)}
                disabled={isLoading && selectedKeyword === keyword}
                className="flex items-center gap-2"
              >
                {keyword}
                {isLoading && selectedKeyword === keyword && (
                  <Loader2Icon className="h-4 w-4 animate-spin" />
                )}
              </Button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
