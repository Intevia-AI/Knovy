"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { GeminiClient } from "@/lib/geminiClient.js";

interface RealTimeAnalysisProps {
  onTextResponse?: (text: string, turnComplete: boolean) => void; // 當收到文字回應時的回呼
  onKeywords?: (keywords: string[]) => void; // 當收到關鍵字時的回呼
  systemAudioStream?: MediaStream;
  isScreenSharing: boolean;
  customPrompt?: string;
  language?: string;
}

export default function RealTimeAnalysis({
  onTextResponse,
  onKeywords,
  systemAudioStream,
  isScreenSharing,
  customPrompt,
  language,
}: RealTimeAnalysisProps) {
  const geminiClientRef = useRef<GeminiClient | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const systemAudioSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const shouldSendAudioRef = useRef(false);

  const setupSystemAudioSource = (stream: MediaStream) => {
    if (!audioContextRef.current || !audioWorkletNodeRef.current) {
      console.error("[RealTimeAnalysis] AudioContext or WorkletNode not initialized");
      return;
    }

    if (systemAudioSourceRef.current) {
      systemAudioSourceRef.current.disconnect();
      systemAudioSourceRef.current = null;
    }

    try {
      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(audioWorkletNodeRef.current);
      systemAudioSourceRef.current = source;
      console.log("[RealTimeAnalysis] System audio source connected");
    } catch (error) {
      console.error("[RealTimeAnalysis] Error setting up system audio source:", error);
    }
  };

  const startAudioProcessing = useCallback(async () => {
    console.log("[RealTimeAnalysis] Starting audio processing...");

    geminiClientRef.current = new GeminiClient(
        (text, turnComplete) => { // onMessage
            if (onTextResponse) {
                onTextResponse(text, turnComplete);
            }
        },
        () => { // onSetupComplete
            console.log("[RealTimeAnalysis] WebSocket setup complete");
            shouldSendAudioRef.current = true;
        },
        () => {}, // onPlayingStateChange
        () => {}, // onAudioLevelChange
        (text) => { // onTranscription (This is the one we care about for subtitles)
            const transcriptionMatch = text.match(/TRANSCRIPTION:\s*(.*)/);
            const keywordsMatch = text.match(/KEYWORDS:\s*(.*)/);

            if (transcriptionMatch && transcriptionMatch[1]) {
                const transcription = transcriptionMatch[1].trim();
                if (transcription && onTextResponse) {
                    onTextResponse(transcription, false); // Assume not turn complete for transcription
                }
            }

            if (keywordsMatch && keywordsMatch[1]) {
                const keywords = keywordsMatch[1].split(',').map(k => k.trim()).filter(k => k);
                if (keywords.length > 0 && onKeywords) {
                    onKeywords(keywords);
                }
            }
        },
        'transcription', // mode
        customPrompt,
        language
    );

    await geminiClientRef.current.connect();

    try {
        audioContextRef.current = new AudioContext({ sampleRate: 16000 });
        await audioContextRef.current.audioWorklet.addModule("/worklets/audio-processor.js");
        
        const audioWorkletNode = new AudioWorkletNode(audioContextRef.current, "audio-processor", {
          processorOptions: {
            bufferSize: 8192,
          },
        });
        audioWorkletNodeRef.current = audioWorkletNode;

        audioWorkletNode.port.onmessage = (event) => {
            const { pcmData } = event.data;
            console.log("[RealTimeAnalysis] Received data from AudioWorkletNode. PCM data size:", pcmData.byteLength); // New log
            if (geminiClientRef.current && shouldSendAudioRef.current) {
                try {
                    const pcmArray = new Uint8Array(pcmData);
                    console.log("[RealTimeAnalysis] Sending PCM data chunk, size:", pcmArray.length);
                    const b64Data = btoa(String.fromCharCode.apply(null, Array.from(pcmArray)));
                    geminiClientRef.current.sendMediaChunk(b64Data, "audio/pcm");
                } catch (error) {
                    console.error("[RealTimeAnalysis] Error sending audio chunk:", error);
                }
            }
        };

        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = micStream;
        const micSource = audioContextRef.current.createMediaStreamSource(micStream);
        micSource.connect(audioWorkletNode);

        if (systemAudioStream) {
            setupSystemAudioSource(systemAudioStream);
        }

    } catch (error) {
        console.error("[RealTimeAnalysis] Error starting audio processing:", error);
    }
  }, [systemAudioStream, customPrompt, language, onTextResponse, onKeywords]);

  const stopAudioProcessing = useCallback(() => {
    console.log("[RealTimeAnalysis] Stopping audio processing...");
    shouldSendAudioRef.current = false;

    geminiClientRef.current?.disconnect();
    geminiClientRef.current = null;

    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;

    systemAudioSourceRef.current?.disconnect();
    systemAudioSourceRef.current = null;

    audioWorkletNodeRef.current?.disconnect();
    audioWorkletNodeRef.current = null;

    audioContextRef.current?.close().catch(console.error);
    audioContextRef.current = null;
  }, []);

  useEffect(() => {
    if (isScreenSharing) {
      startAudioProcessing();
    } else {
      stopAudioProcessing();
    }

    return () => {
        stopAudioProcessing();
    };
  }, [isScreenSharing, startAudioProcessing, stopAudioProcessing]);

  return null; // This component does not render anything
}