import { useEffect, useRef, useState } from "react";
import { GeminiWebSocket } from "../services/geminiWebSocket";
import { Base64 } from 'js-base64';
import { TranscriptionService } from './transcriptionService';
import { pcmToWav } from '../utils/audioUtils';

export default function AudioControl() {
  const [isActive, setIsActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);

  const geminiWsRef = useRef<GeminiWebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioWorkletNodeRef = useRef<AudioWorkletNode | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    geminiWsRef.current = new GeminiWebSocket(
      () => {}, // Empty callback for text
      () => {
        setIsConnected(true);
      },
      (isPlaying) => {
        setIsPlaying(isPlaying);
      },
      (level) => {
        setAudioLevel(level);
      },
      () => {} // Empty callback for transcription
    );

    return () => {
      if (geminiWsRef.current) {
        geminiWsRef.current.disconnect();
      }
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(track => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  const startAudio = async () => {
    try {
      setIsProcessing(true);
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          sampleRate: 16000,
          channelCount: 1,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      mediaStreamRef.current = stream;
      audioContextRef.current = new AudioContext({
        sampleRate: 16000,
      });

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
        if (geminiWsRef.current && !isPlaying) {
          const b64Data = btoa(String.fromCharCode(...new Uint8Array(pcmData)));
          geminiWsRef.current.sendMediaChunk(b64Data, "audio/pcm");
        }
      };

      const source = audioContextRef.current.createMediaStreamSource(stream);
      source.connect(audioWorkletNode);
      audioWorkletNode.connect(audioContextRef.current.destination);
      audioWorkletNodeRef.current = audioWorkletNode;

      geminiWsRef.current?.connect();
      setIsActive(true);
    } catch (error) {
      console.error("Error starting audio:", error);
    } finally {
      setIsProcessing(false);
    }
  };

  const stopAudio = () => {
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
    <div className="flex flex-col items-center space-y-4">
      <button
        onClick={isActive ? stopAudio : startAudio}
        disabled={isProcessing}
        className={`px-6 py-3 rounded-full text-white font-semibold transition-colors ${
          isActive
            ? "bg-red-500 hover:bg-red-600"
            : "bg-blue-500 hover:bg-blue-600"
        } ${isProcessing ? "opacity-50 cursor-not-allowed" : ""}`}
      >
        {isProcessing ? "Processing..." : isActive ? "Stop" : "Start"}
      </button>

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