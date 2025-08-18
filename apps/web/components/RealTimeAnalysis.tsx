/**
 * @fileoverview RealTimeAnalysis Component - Provides real-time audio analysis and transcription
 * @module RealTimeAnalysis
 * @description A React component that captures audio from microphone and system sources,
 * processes it through the Gemini AI API, and provides real-time transcription and keyword extraction.
 */

"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Button } from "@workspace/ui/components/button";
import { MonitorIcon, MonitorOffIcon, Pause } from "lucide-react";
import { GeminiClient } from "../app/api/ai/proxy/geminiClient";

/**
 * @interface RealTimeAnalysisProps
 * @description Props for the RealTimeAnalysis component
 * @property {function} [onTextResponse] - Callback function triggered when text transcription is received
 * @property {function} [onKeywords] - Callback function triggered when keywords are extracted
 * @property {function} onStreamsReady - Callback to pass streams to parent
 * @property {function} onIsActiveChange - Callback to inform parent of session status
 */
interface RealTimeAnalysisProps {
  onTextResponse?: (text: string) => void;
  onKeywords?: (keywords: string[]) => void;
  onStreamsReady: (streams: {
    mic: MediaStream | null;
    system: MediaStream | null;
    screen: MediaStream | null;
  }) => void;
  onIsActiveChange: (isActive: boolean) => void;
}

const SESSION_TIMEOUT = 5 * 60 * 1000; // 5 minutes

/**
 * @component RealTimeAnalysis
 * @description Component that provides real-time audio analysis and transcription using Gemini AI
 */
export default function RealTimeAnalysis({
  onTextResponse,
  onKeywords,
  onStreamsReady,
  onIsActiveChange,
}: RealTimeAnalysisProps) {
  // State for component operation
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);

  // Refs for audio processing
  const geminiClientRef = useRef<GeminiClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const systemAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const shouldSendAudioRef = useRef(false);
  const textBufferRef = useRef("");
  const sessionTimerRef = useRef<NodeJS.Timeout | null>(null);

  const stopSession = useCallback(
    (notifyUser = false) => {
      console.log("[RealTimeAnalysis] Stopping session...");
      if (sessionTimerRef.current) {
        clearTimeout(sessionTimerRef.current);
        sessionTimerRef.current = null;
      }

      shouldSendAudioRef.current = false;

      systemAudioSourceRef.current?.disconnect();
      systemAudioSourceRef.current = null;

      micStreamRef.current?.getTracks().forEach((track) => track.stop());
      micStreamRef.current = null;

      screenStreamRef.current?.getTracks().forEach((track) => track.stop());
      screenStreamRef.current = null;

      if (audioContextRef.current?.state !== "closed") {
        audioContextRef.current?.close();
      }
      audioContextRef.current = null;

      geminiClientRef.current?.disconnect();

      setIsActive(false);
      setIsConnected(false);
      onIsActiveChange(false);
      onStreamsReady({ mic: null, system: null, screen: null });

      if (notifyUser) {
        alert("Session has ended after 5 minutes.");
      }
    },
    [onIsActiveChange, onStreamsReady],
  );

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
          // Extract keywords using regex
          const transcriptionMatch = textBufferRef.current.match(
            /TRANSCRIPTION: (.*?)(?:\n|$)KEYWORDS:/s,
          );
          const keywordsMatch = textBufferRef.current.match(
            /KEYWORDS: (.*?)(?:\n|$)/s,
          );

          if (transcriptionMatch?.[1]) {
            const transcription = transcriptionMatch[1].trim();
            const cleanTranscription = transcription
              .replace(/^TRANSCRIPTION:\s*/i, "")
              .trim();
            onTextResponse?.(cleanTranscription);
          }

          if (keywordsMatch?.[1]) {
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
        console.log("[RealTimeAnalysis] WebSocket connected");
        setIsConnected(true);
        shouldSendAudioRef.current = true;
      },
      (isPlaying) => console.log("Playing state changed:", isPlaying),
      (level) => setAudioLevel(level),
      () => { },
    );

    return () => {
      console.log("[RealTimeAnalysis] Cleaning up component...");
      stopSession();
    };
  }, [onTextResponse, onKeywords, stopSession]);

  const startSession = async () => {
    setIsProcessing(true);
    try {
      // Get screen and system audio
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = screenStream;

      // Get microphone audio
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = micStream;

      // Connect to WebSocket
      geminiClientRef.current?.connect();

      // Setup audio processing
      audioContextRef.current = new AudioContext({ sampleRate: 16000 });
      await audioContextRef.current.audioWorklet.addModule(
        "/worklets/audio-processor.js",
      );
      const workletNode = new AudioWorkletNode(
        audioContextRef.current,
        "audio-processor",
        { processorOptions: { bufferSize: 8192 } },
      );
      audioWorkletNodeRef.current = workletNode;

      workletNode.port.onmessage = (event) => {
        const { pcmData, level } = event.data;
        setAudioLevel(level);
        if (geminiClientRef.current && shouldSendAudioRef.current) {
          try {
            const pcmArray = new Uint8Array(pcmData);
            const b64Data = btoa(String.fromCharCode(...pcmArray));
            geminiClientRef.current.sendMediaChunk(b64Data, "audio/pcm");
          } catch (error) {
            console.error("Error sending audio chunk:", error);
          }
        }
      };

      // Connect mic source
      const micSource = audioContextRef.current.createMediaStreamSource(micStream);
      micSource.connect(workletNode);

      // Connect system audio source if available
      const systemAudioTracks = screenStream.getAudioTracks();
      let systemAudioStream: MediaStream | null = null;
      if (systemAudioTracks.length > 0) {
        systemAudioStream = new MediaStream(systemAudioTracks);
        const systemSource = audioContextRef.current.createMediaStreamSource(
          systemAudioStream,
        );
        systemSource.connect(workletNode);
        systemAudioSourceRef.current = systemSource;
      } else {
        console.warn("No system audio track found.");
        alert(
          "無法擷取系統音訊，錄音將只包含麥克風。若要錄製系統音訊，請在分享畫面時確認已勾選分享音訊選項。",
        );
        systemAudioStream = null;
      }

      onStreamsReady({
        mic: micStream,
        system: systemAudioStream,
        screen: screenStream,
      });

      shouldSendAudioRef.current = true;
      setIsActive(true);
      onIsActiveChange(true);

      // Start session timer
      sessionTimerRef.current = setTimeout(
        () => stopSession(true),
        SESSION_TIMEOUT,
      );
    } catch (error) {
      console.error("Error starting session:", error);
      alert(`Failed to start session: ${error}`);
      stopSession();
    } finally {
      setIsProcessing(false);
    }
  };

  const handleButtonClick = () => {
    if (isActive) {
      stopSession();
    } else {
      startSession();
    }
  };

  return (
    <div className="flex flex-col items-center space-y-4 w-full">
      <Button
        onClick={handleButtonClick}
        disabled={isProcessing}
        variant={isActive ? "destructive" : "default"}
        className="flex items-center gap-2 w-full"
      >
        {isProcessing ? (
          <Pause className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <MonitorOffIcon className="h-4 w-4" />
        ) : (
          <MonitorIcon className="h-4 w-4" />
        )}
        {isProcessing
          ? "處理中..."
          : isActive
            ? "停止錄製"
            : "開始錄製"}
      </Button>

      {isActive && (
        <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-500 transition-all duration-100"
            style={{ width: `${audioLevel}%` }}
          />
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        測試體驗將在 5 分鐘後自動停止
      </p>
    </div>
  );
}
