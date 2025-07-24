/**
 * @fileoverview RealTimeAnalysis Component - Provides real-time audio analysis and transcription
 * @module RealTimeAnalysis
 * @description A React component that captures audio from microphone and system sources,
 * processes it through the Gemini AI API, and provides real-time transcription and keyword extraction.
 */

"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { Mic, MicOff, Pause } from "lucide-react";
import { GeminiClient } from "../app/api/ai/proxy/geminiClient";

/**
 * @interface RealTimeAnalysisProps
 * @description Props for the RealTimeAnalysis component
 * @property {function} [onTextResponse] - Callback function triggered when text transcription is received
 * @property {function} [onKeywords] - Callback function triggered when keywords are extracted
 * @property {MediaStream} [systemAudioStream] - Optional system audio stream to analyze alongside microphone
 */
interface RealTimeAnalysisProps {
  onTextResponse?: (text: string) => void; // Callback when text response is received
  onKeywords?: (keywords: string[]) => void; // Callback when keywords are extracted
  systemAudioStream?: MediaStream; // Optional system audio stream
}

/**
 * @component RealTimeAnalysis
 * @description Component that provides real-time audio analysis and transcription using Gemini AI
 * 
 * @example
 * ```tsx
 * // Basic usage
 * <RealTimeAnalysis 
 *   onTextResponse={(text) => console.log("Transcription:", text)}
 *   onKeywords={(keywords) => console.log("Keywords:", keywords)}
 * />
 * 
 * // With system audio
 * <RealTimeAnalysis 
 *   onTextResponse={handleTranscription}
 *   onKeywords={handleKeywords}
 *   systemAudioStream={systemAudioStream}
 * />
 * ```
 */
export default function RealTimeAnalysis({
  onTextResponse,
  onKeywords,
  systemAudioStream,
}: RealTimeAnalysisProps) {
  // State for component operation
  const [isActive, setIsActive] = useState(false); // Whether analysis is active
  const [isProcessing, setIsProcessing] = useState(false); // Whether processing (starting/stopping)
  const [audioLevel, setAudioLevel] = useState(0); // Audio volume level (0-100)
  const [isConnected, setIsConnected] = useState(false); // WebSocket connection status
  
  // Refs for audio processing
  const geminiClientRef = useRef<GeminiClient | null>(null); // Gemini client instance
  const audioContextRef = useRef<AudioContext | null>(null); // Audio context
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null); // Audio worklet node
  const mediaStreamRef = useRef<MediaStream | null>(null); // Microphone audio stream
  const systemAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null); // System audio source node
  const shouldSendAudioRef = useRef(false); // Whether to send audio data
  const textBufferRef = useRef(""); // Buffer for received text fragments

  /**
   * Initialize the GeminiClient and set up event handlers
   * Cleans up resources when the component unmounts
   */
  useEffect(() => {
    // Initialize GeminiClient with callbacks
    geminiClientRef.current = new GeminiClient(
      // Text response handler
      (text) => {
        console.log("[RealTimeAnalysis] Received text:", text);
        textBufferRef.current += text;

        // Parse the text for transcription and keywords when both markers are present
        if (
          textBufferRef.current.includes("TRANSCRIPTION:") &&
          textBufferRef.current.includes("KEYWORDS:")
        ) {
          // Extract transcription using regex
          const transcriptionMatch = textBufferRef.current.match(
            /TRANSCRIPTION: (.*?)(?:\n|$)KEYWORDS:/s,
          );
          // Extract keywords using regex
          const keywordsMatch = textBufferRef.current.match(
            /KEYWORDS: (.*?)(?:\n|$)/s,
          );

          // Process transcription if found
          if (transcriptionMatch && transcriptionMatch[1]) {
            const transcription = transcriptionMatch[1].trim();
            const cleanTranscription = transcription
              .replace(/^TRANSCRIPTION:\s*/i, "")
              .trim();
            onTextResponse?.(cleanTranscription);
          }

          // Process keywords if found
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

          // Clear the buffer after processing
          textBufferRef.current = "";
        }
      },
      () => {
        console.log("[即時分析] WebSocket 連線已建立");
        setIsConnected(true);
        shouldSendAudioRef.current = true;
      },
      (isPlaying) => {
        console.log("[即時分析] 播放狀態變更:", isPlaying);
      },
      (level) => {
        setAudioLevel(level);
      },
      () => {},
    );

    return () => {
      console.log("[即時分析] 清理 WebSocket...");
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
      console.log("[即時分析] 系統音訊流更新，設定新的來源");
      setupSystemAudioSource(systemAudioStream);
    }
  }, [systemAudioStream, isActive]);

  const setupSystemAudioSource = (stream: MediaStream) => {
    if (!audioContextRef.current) {
      console.error("[即時分析] AudioContext 未初始化");
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
      console.log("[即時分析] 系統音訊來源已連接");
    } catch (error) {
      console.error("[即時分析] 設定系統音訊來源時發生錯誤:", error);
    }
  };

  /**
   * @function startAudio
   * @description Starts audio capture and analysis
   * 1. Connects to the Gemini WebSocket
   * 2. Creates an AudioContext and AudioWorkletNode
   * 3. Sets up microphone and system audio capture
   * 4. Begins sending audio data to Gemini for analysis
   * @returns {Promise<void>}
   */
  const startAudio = async () => {
    try {
      console.log("[RealTimeAnalysis] Starting audio...");
      setIsProcessing(true);

      console.log("[RealTimeAnalysis] Connecting to WebSocket...");
      if (!geminiClientRef.current) {
        console.error("[RealTimeAnalysis] GeminiClient instance is null!");
        return;
      }

      console.log("[RealTimeAnalysis] Calling connect() on GeminiClient...");
      geminiClientRef.current.connect();

      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
      });

      console.log("[即時分析] 載入 audio worklet...");
      await audioContextRef.current.audioWorklet.addModule(
        "/worklets/audio-processor.js",
      );
      const audioWorkletNode = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
        {
          processorOptions: {
            bufferSize: 8192,
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
            console.error("[即時分析] 發送音訊區塊時發生錯誤:", error);
          }
        }
      };

      audioWorkletNodeRef.current = audioWorkletNode;

      console.log("[即時分析] 取得麥克風音訊流");
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
      console.log("[即時分析] 音訊設定完成");
      setIsActive(true);
    } catch (error) {
      console.error("[即時分析] 開始音訊時發生錯誤:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  /**
   * @function stopAudio
   * @description Stops audio capture and analysis
   * 1. Stops sending audio data
   * 2. Disconnects and cleans up audio sources
   * 3. Closes the AudioContext
   * 4. Disconnects from the Gemini WebSocket
   * 5. Updates component state
   */
  const stopAudio = () => {
    console.log("[RealTimeAnalysis] Stopping audio...");
    shouldSendAudioRef.current = false;

    // Clean up system audio source
    if (systemAudioSourceRef.current) {
      systemAudioSourceRef.current.disconnect();
      systemAudioSourceRef.current = null;
    }

    // Stop all microphone tracks
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    // Disconnect from Gemini
    if (geminiClientRef.current) {
      geminiClientRef.current.disconnect();
    }

    // Update state
    setIsActive(false);
    setIsConnected(false);
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full max-w-2xl mx-auto">
      <Button
        onClick={isActive ? stopAudio : startAudio}
        disabled={isProcessing}
        variant={isActive ? "destructive" : "default"}
        className="flex items-center gap-2 w-full"
      >
        {isProcessing ? (
          <Pause className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <MicOff className="h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
        {isProcessing ? "處理中..." : isActive ? "停止分析" : "開始即時分析"}
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
