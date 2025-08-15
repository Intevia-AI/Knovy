"use client";

import { useEffect, useRef, useState } from "react";
import { GeminiClient } from "./geminiClient.js";
import { Switch } from "@/components/ui/switch";
import { useI18n } from "@/hooks/useI18n";

interface RealTimeSubtitleProps {
  onTextResponse?: (text: string) => void; // 當收到文字回應時的回呼
  onKeywords?: (keywords: string[]) => void; // 當收到關鍵字時的回呼
  systemAudioStream?: MediaStream | null; // 系統音訊流 (可選)
  isScreenSharing?: boolean; // 新增螢幕分享狀態
  setSubtitleVisibility: (visibility: boolean) => void; // 新增 prop
  language?: string; // 新增語言參數
}

export default function RealTimeSubtitle({
  onTextResponse,
  onKeywords,
  systemAudioStream,
  isScreenSharing = false, // 預設值為 false
  setSubtitleVisibility, // 新增 prop
  language = "zh-TW", // 新增語言參數，默認為繁體中文
}: RealTimeSubtitleProps) {
  const [isActive, setIsActive] = useState(false); // 是否正在分析
  const [isProcessing, setIsProcessing] = useState(false); // 是否正在處理中 (例如：啟動/停止)
  const [audioLevel, setAudioLevel] = useState(0); // 音量大小 (0-100)
  const [isConnected, setIsConnected] = useState(false); // WebSocket 是否已連線
  const [isSubtitleVisible, setIsSubtitleVisible] = useState(true); // 預設為可見
  const geminiClientRef = useRef<GeminiClient | null>(null); // Gemini 客戶端實例
  const audioContextRef = useRef<AudioContext | null>(null); // 音訊上下文
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null); // 音訊 Worklet 節點
  const mediaStreamRef = useRef<MediaStream | null>(null); // 麥克風音訊流
  const systemAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null); // 系統音訊來源節點
  const shouldSendAudioRef = useRef(false); // 是否應該發送音訊數據
  const textBufferRef = useRef(""); // 用於緩存收到的文字片段

  const { t } = useI18n();

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

        // 檢查是否包含完整的轉錄和關鍵字標記
        if (
          textBufferRef.current.includes("TRANSCRIPTION:") &&
          textBufferRef.current.includes("KEYWORDS:")
        ) {
          console.log("[即時字幕] 檢測到完整的轉錄和關鍵字標記");

          // 提取轉錄內容
          const transcriptionMatch = textBufferRef.current.match(
            /TRANSCRIPTION: (.*?)(?:\n|$)KEYWORDS:/s,
          );

          // 提取關鍵字
          const keywordsMatch = textBufferRef.current.match(
            /KEYWORDS: (.*?)(?:\n|$)/s,
          );

          if (transcriptionMatch && transcriptionMatch[1]) {
            // 清理轉錄文本
            const transcription = transcriptionMatch[1]
              .replace(/TRANSCRIPTION:\s*/gi, "") // 移除所有 TRANSCRIPTION: 標記
              .replace(/search web/g, "") // 移除 search web 標記
              .replace(/\s+/g, " ") // 移除多餘空格
              .trim();

            console.log("[即時字幕] 提取的轉錄文字:", transcription);
            onTextResponse?.(transcription);
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

          // 清空緩衝區
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
      () => {},
      "transcription",
      undefined,
      language,
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
  }, [onTextResponse, onKeywords, language]);

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
        "/worklets/audio-processor.js",
      );
      const audioWorkletNode = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
        {
          processorOptions: {
            bufferSize: 4096,
          },
        },
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
  const handleCheckedChange = (checked: boolean) => {
    setIsSubtitleVisible(checked);
    setSubtitleVisibility(checked);
  };

  return (
    <div className="flex items-center justify-between space-x-2 w-full max-w-2xl mx-auto p-1.5 border rounded-md bg-muted/30 border-border">
      <h4 className="text-xs font-medium text-foreground">
        {isSubtitleVisible ? t("showSubtitlesLabel") : t("hideSubtitlesLabel")}
      </h4>
      <Switch
        id="subtitle-switch"
        checked={isSubtitleVisible}
        onCheckedChange={handleCheckedChange}
        disabled={isProcessing}
        aria-label={
          isSubtitleVisible
            ? t("hideSubtitlesAriaLabel")
            : t("showSubtitlesAriaLabel")
        }
      />
    </div>
  );
}
