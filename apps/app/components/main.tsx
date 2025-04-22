"use client";
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
  MinusIcon,
  XIcon,
  LightbulbIcon, // <-- Import LightbulbIcon
  PinIcon, // <-- Import PinIcon
  PinOffIcon, // <-- Import PinOffIcon
} from "lucide-react";
import { Message } from "ai";
import { Input } from "@workspace/ui/components/input";
import { Markdown } from "./markdown";
import RealTimeAnalysis from "@/components/RealTimeAnalysis";
import AudioVisualizer from "./AudioVisualizer";
import { cn } from "@workspace/ui/lib/utils";
import { useSegmentRecorder } from "@/hooks/useSegmentRecorder";
import { getCurrentWindow } from "@tauri-apps/api/window";

// --- Types ----------------------------------------------------
interface AIContextData {
  audioInputs?: { data: string; mimeType: string; label: string }[];
}

interface Segment {
  blob: Blob;
  timestamp: number;
}

// =============================================================
export function Main() {
  // --- Refs ----------------------------------------------------
  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const systemAudioChunksRef = useRef<Blob[]>([]);
  const systemAudioTimerRef = useRef<NodeJS.Timeout | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const sendContextToAIRef = useRef<
    (
      action: "real-time" | "answer" | "summary" | "search" | "custom" | "find-clue", // <-- Add "find-clue"
      customQuery?: string
    ) => Promise<void>
  >(async () => {});
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);

  // Add refs & state for system audio analyser
  const systemAudioContextRef = useRef<AudioContext | null>(null);
  const systemAudioSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(
    null
  );
  const [systemAnalyserNode, setSystemAnalyserNode] =
    useState<AnalyserNode | null>(null);
  const [currentSystemAudioStream, setCurrentSystemAudioStream] =
    useState<MediaStream | null>(null);

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
  const [micAnalyserNode, setMicAnalyserNode] = useState<AnalyserNode | null>(
    null
  );
  const [isAlwaysOnTop, setIsAlwaysOnTop] = useState(false); // <-- Add state for always on top

  // --- Hook ---------------------------------------------------
  const {
    start: startMicRecording,
    stop: stopMicRecording,
    mimeType: micMimeType,
    micStream,
    currentMicChunks, // <-- Add currentMicChunks
  } = useSegmentRecorder();

  // --- Utils --------------------------------------------------

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

  const SEGMENT_MS = 20_000;
  const ANSWER_SEGMENT_MS = 10_000; // 10 seconds for answer action

  const sendContextToAI = useCallback<
    (
      action: "real-time" | "answer" | "summary" | "search" | "custom" | "find-clue", // <-- Add "find-clue"
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
        "real-time":
          "轉錄最新的語音內容，並識別其中提到的關鍵點、關鍵字或待辦事項。",
        answer:
          "根據最近音訊中的對話內容，回答音訊中最後提出的問題。因為會有兩種音訊，一種是麥克風音訊，一種是系統音訊，請先回答麥克風音訊再回答系統音訊的問題。有必要請上網查詢。",
        summary:
          "提供最近音訊片段中捕捉到的對話內容的簡明摘要。請用中文回答。若是麥克風音訊沒有可總結的對話內容，請不用針對該音訊回答。",
        search:
          "根據最近音訊片段中討論的主題，建議相關的搜尋關鍵字或查找相關資訊。請用中文回答。若是麥克風音訊沒有可搜尋的對話內容，請不用針對該音訊回答。",
        "find-clue": // <-- Add prompt for find-clue
          "根據最近的音訊內容，找出其中可能存在的線索、疑點或需要進一步探討的資訊。請用中文回答。",
        custom:
          customQuery ||
          "根據以下要求分析最近音訊片段中捕捉到的對話內容。請用中文回答。",
      } as const;

      // 簡化的顯示用 prompt
      const displayPromptMap: Record<typeof action, string> = {
        "real-time": "即時轉錄",
        answer: "根據語音內容回答問題",
        summary: "根據過去語音內容產生摘要",
        search: "根據語音內容搜尋主題",
        "find-clue": "根據語音內容找尋線索", // <-- Add display prompt for find-clue
        custom: customPrompt,
      } as const;

      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: action === "custom" ? customPrompt : promptMap[action],
      };

      // 使用簡化的 prompt 顯示
      const displayMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: action === "custom" ? customPrompt : displayPromptMap[action],
      };

      if (action !== "real-time") setAiMessages((p) => [...p, displayMsg]);

      try {
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages: [userMsg], data: ctx }),
        });
        if (!res.ok) throw new Error(await res.text()); // Keep throwing the original error for console logging
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
        // Log the actual error for debugging
        console.error("AI request failed:", e);
        // Display a generic error message to the user
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
        const audioCtx = new window.AudioContext();
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

  useEffect(() => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [aiMessages]);

  const toggleAlwaysOnTop = async () => {
    const currentWindow = getCurrentWindow();
    const newAlwaysOnTopState = !isAlwaysOnTop;
    await currentWindow.setAlwaysOnTop(newAlwaysOnTopState);
    setIsAlwaysOnTop(newAlwaysOnTopState);
  };

  useEffect(() => {
    // set is content protected true and get initial always on top state
    const initializeWindow = async () => {
      const currentWindow = getCurrentWindow();
      await currentWindow.setContentProtected(true);
      const alwaysOnTop = await currentWindow.isAlwaysOnTop();
      setIsAlwaysOnTop(alwaysOnTop);
    };
    initializeWindow();
  }, []);

  // --- Context ------------------------------------------------
  const gatherContext = async (): Promise<AIContextData | null> => {
    console.log("Checking audio recording status...");
    console.log("Mic chunks length:", currentMicChunks.length);
    console.log("System chunks length:", systemAudioChunksRef.current.length);
    console.log(
      "Last mic segment:",
      segments.length > 0 ? segments[segments.length - 1] : null
    );
    console.log(
      "Last system segment:",
      systemAudioSegments.length > 0
        ? systemAudioSegments[systemAudioSegments.length - 1]
        : null
    );

    // Last completed segments
    const lastMicSegment =
      segments.length > 0 ? segments[segments.length - 1] : null;
    const lastSystemSegment =
      systemAudioSegments.length > 0
        ? systemAudioSegments[systemAudioSegments.length - 1]
        : null;

    // Current recording chunks
    const currentMicRecordingChunks = currentMicChunks; // From the hook
    const currentSystemRecordingChunks = systemAudioChunksRef.current; // From component ref

    // Create blobs from current chunks if they exist
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

    // Combine all potential audio sources
    const blobsToProcess: { blob: Blob; type: string; label: string }[] = [];

    // For answer action, only use the most recent 10 seconds
    if (lastMicSegment) {
      const currentTime = Date.now();
      const segmentAge = currentTime - lastMicSegment.timestamp;
      // 如果最後一個片段小於 10 秒，就使用它
      if (segmentAge <= ANSWER_SEGMENT_MS) {
        blobsToProcess.push({
          blob: lastMicSegment.blob,
          type: micMimeType,
          label: "microphone-last",
        });
      } else {
        // 如果最後一個片段大於 10 秒，就只使用最後 10 秒
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

    // 對於當前錄製的片段，只使用最後 10 秒
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
      })
    );

    const validAudioInputs = audioInputs.filter(Boolean) as {
      data: string;
      mimeType: string;
      label: string;
    }[];

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
      console.error("取得關鍵字解釋時發生錯誤:", error); // Log original error
      // Display a generic error message
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
        // --- Step 1: Get Display Media (requires user gesture) ---
        displayStream = await navigator.mediaDevices.getDisplayMedia({
          video: true,
          audio: true,
        });
        screenStreamRef.current = displayStream;

        // --- Step 2: Get Microphone Media ---
        capturedMicStream = await startMicRecording();
        if (!capturedMicStream) {
          console.error("Failed to start microphone recording.");
          alert("無法啟動麥克風錄音，請檢查權限。");
          cleanupStream(screenStreamRef);
          setIsScreenSharing(false);
          return;
        }

        // --- Step 3: Process Audio Tracks ---
        const systemAudioTracks = displayStream.getAudioTracks();
        if (systemAudioTracks.length === 0) {
          console.warn("System audio track not found in screen share stream.");
          alert(
            "無法擷取系統音訊，錄音將只包含麥克風。若要錄製系統音訊，請在分享畫面時確認已勾選分享音訊選項。"
          );
          systemAudioStream = null;
        } else {
          systemAudioStream = new MediaStream(systemAudioTracks);
          setCurrentSystemAudioStream(systemAudioStream);
        }

        // --- Step 4: Combine Streams and Setup Recorder ---
        const audioTracksToRecord = [
          ...(systemAudioStream ? systemAudioStream.getAudioTracks() : []),
          ...capturedMicStream.getAudioTracks(),
        ];

        if (audioTracksToRecord.length > 0) {
          // Find a supported mime type
          const potentialMimeTypes = [
            "audio/webm;codecs=opus",
            "audio/ogg;codecs=opus",
            "audio/webm",
            "audio/ogg",
            "audio/mp4", // Less common for recording, but worth checking
            "audio/aac", // Might require specific browser/OS support
          ];
          let supportedMimeType = "";
          for (const mime of potentialMimeTypes) {
            if (MediaRecorder.isTypeSupported(mime)) {
              supportedMimeType = mime;
              break;
            }
          }

          if (!supportedMimeType) {
            console.error("No supported audio mime type found for MediaRecorder.");
            alert("抱歉，您的瀏覽器不支援錄製所需的音訊格式。");
            // Cleanup before returning
            stopMicRecording();
            cleanupStream(screenStreamRef);
            setIsScreenSharing(false);
            return;
          }

          console.log("Using supported mime type:", supportedMimeType); // Log the chosen mime type
          setSystemAudioMimeType(supportedMimeType); // Store the actually supported type

          cleanupRecorder(screenAudioRecorderRef);

          // 為系統音訊設置 MediaRecorder
          if (systemAudioStream) {
            try {
              const systemRecorder = new MediaRecorder(systemAudioStream, {
                mimeType: supportedMimeType, // Use the found supported mime type
              });

              systemRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) {
                  systemAudioChunksRef.current.push(e.data);
                  // Use the state variable for the correct mime type
                  const currentBlob = new Blob(systemAudioChunksRef.current, {
                    type: systemAudioMimeType,
                  });
                  if (currentBlob.size > 0) {
                    setSystemAudioSegments((p) => [
                      ...p,
                      { blob: currentBlob, timestamp: Date.now() },
                    ]);
                  }
                }
              };

              systemRecorder.onerror = (event) => {
                console.error("System MediaRecorder error:", event);
                // Potentially alert the user or stop recording
              };

              systemRecorder.start(1000); // 每秒收集一次數據
              screenAudioRecorderRef.current = systemRecorder;

              // 設置定時器，每 20 秒重新開始錄製
              if (systemAudioTimerRef.current) {
                clearInterval(systemAudioTimerRef.current);
              }
              systemAudioTimerRef.current = setInterval(() => {
                if (
                  screenAudioRecorderRef.current && // Check if recorder still exists
                  screenAudioRecorderRef.current.state === "recording"
                ) {
                  try {
                    screenAudioRecorderRef.current.stop();
                    // Ensure recorder is still valid before starting again
                    if (screenAudioRecorderRef.current) {
                       screenAudioRecorderRef.current.start(1000);
                    }
                  } catch (e) {
                     console.warn("Error stopping/starting system recorder in interval:", e);
                     // Handle potential errors during stop/start cycle
                     cleanupRecorder(screenAudioRecorderRef);
                     if (systemAudioTimerRef.current) clearInterval(systemAudioTimerRef.current);
                  }
                } else if (systemAudioTimerRef.current) {
                   // Clear interval if recorder is no longer recording or gone
                   clearInterval(systemAudioTimerRef.current);
                   systemAudioTimerRef.current = null;
                }
              }, SEGMENT_MS); // Use SEGMENT_MS constant
            } catch (recorderError) {
              console.error("Failed to create system MediaRecorder:", recorderError);
              alert(`無法建立系統音訊錄製器: ${recorderError instanceof Error ? recorderError.message : String(recorderError)}`);
              // Cleanup if recorder creation fails
              systemAudioStream.getTracks().forEach(track => track.stop());
              setCurrentSystemAudioStream(null);
              // Continue without system audio recording if possible, or stop entirely
            }
          }
        } else {
          console.warn("No audio tracks available to record.");
        }

        // --- Step 5: Setup System Audio Analyser (if system audio exists) ---
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

        // --- Step 6: Finalize State ---
        setIsScreenSharing(true);
      } catch (e) {
        console.error("Error starting screen share:", e);
        alert(
          `啟動分享時發生錯誤: ${e instanceof Error ? e.message : String(e)}`
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

  useEffect(() => {
    // set is content protected true
    const currentWindow = getCurrentWindow();
    currentWindow.setContentProtected(true);
  },[])

  return (
    <div className="flex flex-col gap-16 pt-8 h-screen rounded-lg bg-background opacity-100">
      <header
        className="fixed h-6 bg-muted overflow-hidden rounded-t-lg top-0 left-0 right-0 z-10 border-b border-border flex items-center justify-between"
      >
        {/* Empty div to allow dragging on the left */}
        <div className="flex-grow h-full" onMouseDown={(e) => {
          // Only allow dragging when clicking on the header background, not the buttons
          if (e.target === e.currentTarget && e.button === 0) {
            e.preventDefault();
            e.stopPropagation();
            const currentWindow = getCurrentWindow();
            currentWindow.startDragging();
          }
        }}></div>
        {/* Window control buttons */}
        <div className="flex items-center h-full mr-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
            onClick={toggleAlwaysOnTop} // <-- Add onClick handler
            aria-label={isAlwaysOnTop ? "Disable always on top" : "Enable always on top"} // <-- Add aria-label
          >
            {isAlwaysOnTop ? (
              <PinOffIcon className="h-3 w-3" /> // <-- Show PinOffIcon when active
            ) : (
              <PinIcon className="h-3 w-3" /> // <-- Show PinIcon when inactive
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-sm hover:bg-muted-foreground/20"
            onClick={() => getCurrentWindow().minimize()}
            aria-label="Minimize window"
          >
            <MinusIcon className="h-3 w-3" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-5 w-5 rounded-sm hover:bg-destructive/80 hover:text-destructive-foreground"
            onClick={() => getCurrentWindow().close()}
            aria-label="Close window"
          >
            <XIcon className="h-3 w-3" />
          </Button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden shadow-lg max-">
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

          <div className="p-4 border-t border-border">
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

        <aside className="flex flex-col w-full max-w-xs border-l border-border overflow-y-auto shrink-0">
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
                { action: "find-clue", label: "找尋線索", icon: LightbulbIcon }, // <-- Add find-clue button
              ].map(({ action, label, icon: Icon }) => (
                <Button
                  key={action}
                  variant="outline"
                  size="sm"
                  disabled={isLoading || !isScreenSharing}
                  onClick={() =>
                    sendContextToAI(action as "answer" | "summary" | "search" | "find-clue") // <-- Update type cast
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
    </div>
  );
}
