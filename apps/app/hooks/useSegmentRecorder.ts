import { useState, useRef, useCallback } from 'react';
import type { Segment } from '@/types';

const DEFAULT_INTERVAL_MS = 5000;

export function useSegmentRecorder(intervalMs: number = DEFAULT_INTERVAL_MS) {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [mimeType, setMimeType] = useState<string>('');
  const [recording, setRecording] = useState<boolean>(false);
  const [micStream, setMicStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);

  const start = useCallback(async (): Promise<MediaStream | null> => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMicStream(stream);
      const supportedMime = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')
        ? 'audio/ogg;codecs=opus'
        : '';
      setMimeType(supportedMime);
      setSegments([]);

      const recorder = new MediaRecorder(stream, supportedMime ? { mimeType: supportedMime } : undefined);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          setSegments((prev) => [...prev, { blob: event.data, timestamp: Date.now() }]);
        }
      };
      recorder.onerror = (e) => console.error('Microphone recorder error:', e);
      recorder.start(intervalMs);

      recorderRef.current = recorder;
      setRecording(true);
      return stream;
    } catch (error) {
      console.error('Failed to start microphone recording:', error);
      return null;
    }
  }, [intervalMs]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setMicStream(null);
    }
    setRecording(false);
  }, []);

  const reset = useCallback(() => {
    setSegments([]);
  }, []);

  return {
    start,
    stop,
    reset,
    recording,
    segments,
    mimeType,
    micStream, // Expose the current MediaStream state or null
  };
}
