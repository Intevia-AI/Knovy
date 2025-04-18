"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Mic, MicOff, Pause } from "lucide-react";
import { GeminiClient } from "../app/api/ai/proxy/geminiClient";

interface RealTimeAnalysisProps {
  onTextResponse?: (text: string) => void;
  onKeywords?: (keywords: string[]) => void;
  systemAudioStream?: MediaStream;
}

export default function RealTimeAnalysis({
  onTextResponse,
  onKeywords,
  systemAudioStream,
}: RealTimeAnalysisProps) {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const geminiClientRef = useRef<GeminiClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const systemAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const shouldSendAudioRef = useRef(false);
  const textBufferRef = useRef("");

  useEffect(() => {
    // Initialize GeminiClient
    geminiClientRef.current = new GeminiClient(
      (text) => {
        console.log("[RealTimeAnalysis] 收到文字:", text);
        textBufferRef.current += text;

        if (
          textBufferRef.current.includes("TRANSCRIPTION:") &&
          textBufferRef.current.includes("KEYWORDS:")
        ) {
          const transcriptionMatch = textBufferRef.current.match(
            /TRANSCRIPTION: (.*?)(?:\n|$)KEYWORDS:/s
          );
          const keywordsMatch = textBufferRef.current.match(
            /KEYWORDS: (.*?)(?:\n|$)/s
          );

          if (transcriptionMatch && transcriptionMatch[1]) {
            const transcription = transcriptionMatch[1].trim();
            // 過濾掉可能殘留的 "TRANSCRIPTION:" 字樣
            const cleanTranscription = transcription
              .replace(/^TRANSCRIPTION:\s*/i, "")
              .trim();
            onTextResponse?.(cleanTranscription);
          }

          if (keywordsMatch && keywordsMatch[1]) {
            const keywordsStr = keywordsMatch[1].trim();
            if (keywordsStr) {
              const keywords = keywordsStr
                .split(",")
                .map((k) => k.trim())
                .filter((k) => k.length > 0);
              onKeywords?.(keywords);
            }
          }

          textBufferRef.current = "";
        }
      },
      () => {
        console.log("[RealTimeAnalysis] WebSocket 連線已建立");
        setIsConnected(true);
        shouldSendAudioRef.current = true;
      },
      (isPlaying) => {
        console.log("[RealTimeAnalysis] 播放狀態變更:", isPlaying);
      },
      (level) => {
        setAudioLevel(level);
      },
      () => {}
    );

    return () => {
      console.log("[RealTimeAnalysis] 清理 WebSocket...");
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

  // 監聽 systemAudioStream 的變化
  useEffect(() => {
    if (isActive && systemAudioStream) {
      console.log(
        "[RealTimeAnalysis] 系統音訊流更新，設定新的來源"
      );
      setupSystemAudioSource(systemAudioStream);
    }
  }, [systemAudioStream, isActive]);

  const setupSystemAudioSource = (stream: MediaStream) => {
    if (!audioContextRef.current) {
      console.error("[RealTimeAnalysis] AudioContext 未初始化");
      return;
    }

    // 清理舊的系統音頻源
    if (systemAudioSourceRef.current) {
      systemAudioSourceRef.current.disconnect();
      systemAudioSourceRef.current = null;
    }

    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(audioWorkletNodeRef.current!);
      systemAudioSourceRef.current = source;
      console.log("[RealTimeAnalysis] 系統音訊來源已連接");
    } catch (error) {
      console.error(
        "[RealTimeAnalysis] 設定系統音訊來源時發生錯誤:",
        error
      );
    }
  };

  const startAudio = async () => {
    try {
      console.log("[RealTimeAnalysis] 開始音訊...");
      setIsProcessing(true);

      // Connect to WebSocket first
      console.log("[RealTimeAnalysis] 連接 WebSocket...");
      if (!geminiClientRef.current) {
        console.error("[RealTimeAnalysis] GeminiClient 實例為空!");
        return;
      }

      console.log("[RealTimeAnalysis] 在 GeminiClient 上呼叫 connect()...");
      geminiClientRef.current.connect();

      // 初始化 AudioContext
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
      });

      console.log("[RealTimeAnalysis] 載入 audio worklet...");
      await audioContextRef.current.audioWorklet.addModule(
        "/worklets/audio-processor.js"
      );
      const audioWorkletNode = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
        {
          processorOptions: {
            bufferSize: 4096,
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
            console.error(
              "[RealTimeAnalysis] 發送音訊區塊時發生錯誤:",
              error
            );
          }
        }
      };

      audioWorkletNodeRef.current = audioWorkletNode;

      // 設置麥克風音頻源
      console.log("[RealTimeAnalysis] 取得麥克風音訊流");
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

      // 如果有系統音頻流，設置它
      if (systemAudioStream) {
        setupSystemAudioSource(systemAudioStream);
      }

      shouldSendAudioRef.current = true;
      console.log("[RealTimeAnalysis] 音訊設定完成");
      setIsActive(true);
    } catch (error) {
      console.error("[RealTimeAnalysis] 開始音訊時發生錯誤:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopAudio = () => {
    console.log("[RealTimeAnalysis] 停止音訊...");
    shouldSendAudioRef.current = false;

    // 清理系統音頻源
    if (systemAudioSourceRef.current) {
      systemAudioSourceRef.current.disconnect();
      systemAudioSourceRef.current = null;
    }

    // 清理麥克風音頻源
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

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-2xl mx-auto">
      <Button
        onClick={isActive ? stopAudio : startAudio}
        disabled={isProcessing}
        variant={isActive ? "destructive" : "default"}
        className="flex items-center gap-2"
      >
        {isProcessing ? (
          <Pause className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {isProcessing
          ? "處理中..."
          : isActive
            ? "停止分析"
            : "開始分析"}
      </Button>

      {isActive && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${audioLevel}%` }}
          />
        </div>
      )}
    </div>
  );
}
