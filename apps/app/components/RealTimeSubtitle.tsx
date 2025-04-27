"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Mic, MicOff, Pause } from "lucide-react";
import { GeminiClient } from "./geminiClient";

interface RealTimeSubtitleProps {
  onTextResponse?: (text: string) => void; // 當收到文字回應時的回呼
  onKeywords?: (keywords: string[]) => void; // 當收到關鍵字時的回呼
  systemAudioStream?: MediaStream | null; // 系統音訊流 (可選)
  isScreenSharing?: boolean; // 新增螢幕分享狀態
  setSubtitleVisibility: (visibility: boolean) => void;  // 新增 prop
}

export default function RealTimeSubtitle({
  onTextResponse,
  onKeywords,
  systemAudioStream,
  isScreenSharing = false, // 預設值為 false
  setSubtitleVisibility,  // 新增 prop
}: RealTimeSubtitleProps) {
  const [isActive, setIsActive] = useState(false); // 是否正在分析
  const [isProcessing, setIsProcessing] = useState(false); // 是否正在處理中 (例如：啟動/停止)
  const [audioLevel, setAudioLevel] = useState(0); // 音量大小 (0-100)
  const [isConnected, setIsConnected] = useState(false); // WebSocket 是否已連線
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(false);
  const geminiClientRef = useRef<GeminiClient | null>(null); // Gemini 客戶端實例
  const audioContextRef = useRef<AudioContext | null>(null); // 音訊上下文
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null); // 音訊 Worklet 節點
  const mediaStreamRef = useRef<MediaStream | null>(null); // 麥克風音訊流
  const systemAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null); // 系統音訊來源節點
  const shouldSendAudioRef = useRef(false); // 是否應該發送音訊數據
  const textBufferRef = useRef(""); // 用於緩存收到的文字片段

  // 監聽螢幕分享狀態變化
  useEffect(() => {
    if (isScreenSharing && !isActive) {
      startAudio();
    } else if (!isScreenSharing && isActive) {
      stopAudio();
    }
  }, [isScreenSharing]);

  useEffect(() => {
    // 初始化 GeminiClient
    geminiClientRef.current = new GeminiClient(
      (text) => {
        console.log("[即時字幕] 收到原始文字:", text);
        textBufferRef.current += text;
        console.log("[即時字幕] 當前緩衝區內容:", textBufferRef.current);

        if (
          textBufferRef.current.includes("TRANSCRIPTION:") &&
          textBufferRef.current.includes("KEYWORDS:")
        ) {
          console.log("[即時字幕] 檢測到完整的轉錄和關鍵字標記");
          const transcriptionMatch = textBufferRef.current.match(
            /TRANSCRIPTION: (.*?)(?:\n|$)KEYWORDS:/s
          );
          const keywordsMatch = textBufferRef.current.match(
            /KEYWORDS: (.*?)(?:\n|$)/s
          );

          if (transcriptionMatch && transcriptionMatch[1]) {
            const transcription = transcriptionMatch[1].trim();
            const cleanTranscription = transcription
              .replace(/^TRANSCRIPTION:\s*/i, "")
              .trim();
            console.log("[即時字幕] 提取的轉錄文字:", cleanTranscription);
            onTextResponse?.(cleanTranscription);
          }

          if (keywordsMatch && keywordsMatch[1]) {
            const keywordsStr = keywordsMatch[1].trim();
            if (keywordsStr) {
              const keywords = keywordsStr
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k.length > 0);
              console.log("[即時字幕] 提取的關鍵字:", keywords);
              onKeywords?.(keywords);
            }
          }

          textBufferRef.current = "";
          console.log("[即時字幕] 清空緩衝區");
        }
      },
      () => {
        console.log("[即時字幕] WebSocket 連線已建立");
        setIsConnected(true);
        shouldSendAudioRef.current = true;
      },
      (isPlaying) => {
        console.log("[即時字幕] 播放狀態變更:", isPlaying);
      },
      (level) => {
        setAudioLevel(level);
      },
      () => {}
    );

    return () => {
      console.log("[即時字幕] 清理 WebSocket...");
      if (geminiClientRef.current) {
        geminiClientRef.current.disconnect();
        geminiClientRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsConnected(false);
      shouldSendAudioRef.current = false;
      textBufferRef.current = "";
    };
  }, [onTextResponse, onKeywords]);

  useEffect(() => {
    if (isActive && systemAudioStream) {
      console.log("[即時字幕] 系統音訊流更新，設定新的來源");
      setupSystemAudioSource(systemAudioStream);
    }
  }, [systemAudioStream, isActive]);

  const setupSystemAudioSource = (stream: MediaStream) => {
    if (!audioContextRef.current) {
      console.error("[即時字幕] AudioContext 未初始化");
      return;
    }

    if (systemAudioSourceRef.current) {
      systemAudioSourceRef.current.disconnect();
      systemAudioSourceRef.current = null;
    }

    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(audioWorkletNodeRef.current!);
      systemAudioSourceRef.current = source;
      console.log("[即時字幕] 系統音訊來源已連接");
    } catch (error) {
      console.error("[即時字幕] 設定系統音訊來源時發生錯誤:", error);
    }
  };

  const startAudio = async () => {
    try {
      console.log("[即時字幕] 開始音訊...");
      setIsProcessing(true);

      console.log("[即時字幕] 連接 WebSocket...");
      if (!geminiClientRef.current) {
        console.error("[即時字幕] GeminiClient 實例為空!");
        return;
      }

      console.log("[即時字幕] 在 GeminiClient 上呼叫 connect()...");
      geminiClientRef.current.connect();

      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
      });

      console.log("[即時字幕] 載入 audio worklet...");
      await audioContextRef.current.audioWorklet.addModule(
        "/worklets/audio-processor.js"
      );
      const audioWorkletNode = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
        {
          processorOptions: {
            bufferSize: 8192,
          },
        }
      );

      audioWorkletNode.port.onmessage = (event) => {
        const { pcmData, level } = event.data;
        setAudioLevel(level);
        if (geminiClientRef.current && shouldSendAudioRef.current) {
          try {
            const pcmArray = new Uint8Array(pcmData);
            const b64Data = btoa(String.fromCharCode(...pcmArray));
            geminiClientRef.current.sendMediaChunk(b64Data, "audio/pcm");
          } catch (error) {
            console.error("[即時字幕] 發送音訊區塊時發生錯誤:", error);
          }
        }
      };

      audioWorkletNodeRef.current = audioWorkletNode;

      console.log("[即時字幕] 取得麥克風音訊流");
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      mediaStreamRef.current = micStream;
      const micSource =
        audioContextRef.current.createMediaStreamSource(micStream);
      micSource.connect(audioWorkletNode);

      if (systemAudioStream) {
        setupSystemAudioSource(systemAudioStream);
      }

      shouldSendAudioRef.current = true;
      console.log("[即時字幕] 音訊設定完成");
      setIsActive(true);
    } catch (error) {
      console.error("[即時字幕] 開始音訊時發生錯誤:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopAudio = () => {
    console.log("[即時字幕] 停止音訊...");
    shouldSendAudioRef.current = false;

    if (systemAudioSourceRef.current) {
      systemAudioSourceRef.current.disconnect();
      systemAudioSourceRef.current = null;
    }

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    if (geminiClientRef.current) {
      geminiClientRef.current.disconnect();
    }

    setIsActive(false);
    setIsConnected(false);
  };

  // 處理字幕可見性變化
  const handleVisibilityToggle = () => {
    const newVisibility = !isSubtitleVisible;
    setIsSubtitleVisible(newVisibility);
    setSubtitleVisibility(newVisibility);
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-2xl mx-auto">
      <Button
        onClick={handleVisibilityToggle}
        disabled={isProcessing}
        variant={isSubtitleVisible ? "default" : "outline"}
        className="flex items-center gap-2 w-full"
      >
        {isProcessing ? (
          <Pause className="h-4 w-4 animate-spin" />
        ) : isSubtitleVisible ? (
          <Mic className="h-4 w-4" />
        ) : (
          <MicOff className="h-4 w-4" />
        )}
        {isProcessing ? "處理中..." : isSubtitleVisible ? "隱藏字幕" : "顯示字幕"}
      </Button>

      {/* {isSubtitleVisible && isActive && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${audioLevel}%` }}
          />
        </div>
      )}

      {isSubtitleVisible && textBufferRef.current && (
        <div className="w-full p-4 bg-black bg-opacity-50 text-white rounded-lg">
          {textBufferRef.current}
        </div>
      )} */}
    </div>
  );
}
