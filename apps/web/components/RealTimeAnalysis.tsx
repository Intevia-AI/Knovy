"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@workspace/ui/components/button";
import { MicIcon, PauseIcon } from "lucide-react";
import { GeminiWebSocket } from "../app/api/ai/geminiWebSocket";

interface RealTimeAnalysisProps {
  onTextResponse?: (text: string) => void;
  onKeywords?: (keywords: string[]) => void;
}

export default function RealTimeAnalysis({ onTextResponse, onKeywords }: RealTimeAnalysisProps) {
  const [isActive, setIsActive] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isConnected, setIsConnected] = useState(false);
  const geminiWsRef = useRef<GeminiWebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const shouldSendAudioRef = useRef(false);
  const textBufferRef = useRef("");

  useEffect(() => {
    // Initialize GeminiWebSocket
    geminiWsRef.current = new GeminiWebSocket(
      (text) => {
        console.log("[RealTimeAnalysis] Received text:", text);
        // Add new text to buffer
        textBufferRef.current += text;
        
        // Check if we have a complete response (contains both TRANSCRIPTION and KEYWORDS)
        if (textBufferRef.current.includes("TRANSCRIPTION:") && textBufferRef.current.includes("KEYWORDS:")) {
          // Parse the complete response
          const transcriptionMatch = textBufferRef.current.match(/TRANSCRIPTION: (.*?)(?:\n|$)KEYWORDS:/s);
          const keywordsMatch = textBufferRef.current.match(/KEYWORDS: (.*?)(?:\n|$)/s);
          
          if (transcriptionMatch) {
            const transcription = transcriptionMatch[1].trim();
            onTextResponse?.(transcription);
          }
          
          if (keywordsMatch) {
            const keywordsStr = keywordsMatch[1].trim();
            if (keywordsStr) {
              const keywords = keywordsStr.split(',').map(k => k.trim()).filter(k => k.length > 0);
              onKeywords?.(keywords);
            }
          }
          
          // Clear the buffer after processing
          textBufferRef.current = "";
        }
      },
      () => {
        console.log("[RealTimeAnalysis] WebSocket connection established");
        setIsConnected(true);
        shouldSendAudioRef.current = true;
      },
      (isPlaying) => {
        console.log("[RealTimeAnalysis] Playing state changed:", isPlaying);
      },
      (level) => {
        console.log("[RealTimeAnalysis] Audio level:", level);
        setAudioLevel(level);
      },
      () => {} // Empty callback for transcription
    );

    // Cleanup function
    return () => {
      console.log("[RealTimeAnalysis] Cleaning up WebSocket...");
      if (geminiWsRef.current) {
        geminiWsRef.current.disconnect();
        geminiWsRef.current = null;
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
        mediaStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      setIsConnected(false);
      shouldSendAudioRef.current = false;
      textBufferRef.current = ""; // Clear buffer on cleanup
    };
  }, [onTextResponse, onKeywords]); // Add onKeywords to dependencies

  const startAudio = async () => {
    try {
      console.log("[RealTimeAnalysis] Starting audio...");
      setIsProcessing(true);

      // Connect to WebSocket first
      console.log("[RealTimeAnalysis] Connecting to WebSocket...");
      if (!geminiWsRef.current) {
        console.error("[RealTimeAnalysis] GeminiWebSocket instance is null!");
        return;
      }
      
      console.log("[RealTimeAnalysis] Calling connect() on GeminiWebSocket...");
      geminiWsRef.current.connect();

      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      console.log("[RealTimeAnalysis] Got media stream");
      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
      });

      console.log("[RealTimeAnalysis] Loading audio worklet...");
      await audioContextRef.current.audioWorklet.addModule("/worklets/audio-processor.js");
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
        if (geminiWsRef.current && shouldSendAudioRef.current) {
          console.log("[RealTimeAnalysis] Sending audio chunk to WebSocket");
          const b64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData)));
          geminiWsRef.current.sendMediaChunk(b64Data, "audio/pcm");
        }
      };

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(audioWorkletNode);
      audioWorkletNode.connect(audioContextRef.current.destination);
      audioWorkletNodeRef.current = audioWorkletNode;

      console.log("[RealTimeAnalysis] Audio setup complete");
      setIsActive(true);
    } catch (error) {
      console.error("[RealTimeAnalysis] Error starting audio:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopAudio = () => {
    console.log("[RealTimeAnalysis] Stopping audio...");
    shouldSendAudioRef.current = false;
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
    }
    if (geminiWsRef.current) {
      geminiWsRef.current.disconnect();
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
          <PauseIcon className="h-4 w-4 animate-spin" />
        ) : isActive ? (
          <MicIcon className="h-4 w-4" />
        ) : (
          <MicIcon className="h-4 w-4" />
        )}
        {isProcessing ? "Processing..." : isActive ? "Stop Analysis" : "Start Analysis"}
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