import { useCallback, useRef, useState } from 'react';

export const SEGMENT_MS = 20_000; // segment length - Exported
const CHUNK_MS   = 1_000;  // internal timeslice

export function useSegmentRecorder(
  chunkMs: number = 1000,
  bufferLengthMs: number = 30000
) {
  const streamRef = useRef<MediaStream | null>(null); // Make streamRef accessible
  const recRef    = useRef<MediaRecorder | null>(null); // Allow null initially
  const timerRef  = useRef<NodeJS.Timeout | null>(null); // Allow null initially
  const chunksRef = useRef<Blob[]>([]);
  const isStoppingRef = useRef<boolean>(false); // Flag for intentional stop
  const [recording, setRecording] = useState(false);
  const [mimeType,  setMime]      = useState('audio/webm;codecs=opus');
  const [segments, setSegments] = useState<{ blob: Blob; timestamp: number }[]>([]);

  // assemble and dispatch a complete segment
  const makeBlob = () =>
    new Blob(chunksRef.current.splice(0), { type: mimeType });

  const startRecorder = useCallback(() => {
    if (!streamRef.current || !MediaRecorder) return; // Check MediaRecorder support
    isStoppingRef.current = false; // Reset stop flag
    try { // Add try-catch for MediaRecorder constructor
        const rec = new MediaRecorder(streamRef.current, { mimeType });
        rec.ondataavailable = e => {
          if (e.data.size) {
            const now = Date.now();
            setSegments((prev) => {
              // append new chunk and drop old beyond bufferLengthMs
              const updated = [...prev, { blob: e.data, timestamp: now }];
              return updated.filter(seg => now - seg.timestamp <= bufferLengthMs);
            });
          }
        };
        rec.onstop = () => {
          const blob = makeBlob();
          // Only dispatch if there's data, prevent empty blobs
          if (blob.size > 0) {
              window.dispatchEvent(new CustomEvent('segment', { detail: blob }));
          }
          // Only restart if not intentionally stopping
          if (!isStoppingRef.current) {
              startRecorder();
          }
        };
        rec.onerror = (event) => { // Add error handling for recorder
            console.error("MediaRecorder error:", event);
            // Optionally try to stop and cleanup
            stop();
        };
        rec.start(chunkMs);
        recRef.current = rec;
    } catch (err) {
        console.error("Error creating MediaRecorder:", err);
        // Handle error, maybe stop the process
        stop();
    }
  }, [mimeType, chunkMs, bufferLengthMs]);

  const start = useCallback(async (): Promise<MediaStream | null> => { // Return stream or null
    if (recording) return streamRef.current; // Return existing stream if already recording
    isStoppingRef.current = false; // Ensure reset when starting
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMime(
        MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/ogg;codecs=opus'
      );
      startRecorder();
      // Clear previous timer just in case
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
          if (recRef.current && recRef.current.state === 'recording') {
              recRef.current.stop(); // Stop will trigger onstop, which restarts if needed
          }
      }, SEGMENT_MS);
      setRecording(true);
      return stream; // Return the stream on success
    } catch (err) {
        console.error("Error getting user media:", err);
        streamRef.current = null; // Ensure ref is null on error
        setRecording(false);
        return null; // Return null on error
    }
  }, [recording, startRecorder]); // Removed mimeType as it's set inside

  const stop = useCallback(() => {
    isStoppingRef.current = true; // Signal intentional stop
    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    // Ensure recorder exists and is not inactive before stopping
    if (recRef.current && recRef.current.state !== 'inactive') {
        recRef.current.onstop = null; // Prevent the restart logic in onstop
        recRef.current.ondataavailable = null; // Clean up handlers
        recRef.current.onerror = null;
        try { // Add try-catch for stop
            recRef.current.stop();
        } catch (e) {
            console.warn("Error stopping MediaRecorder:", e);
        }
    }
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null; // Clear stream ref on stop
    recRef.current = null; // Clear recorder ref
    chunksRef.current = []; // Clear chunks
    setRecording(false);
  }, []);

  // Expose streamRef's current value via micStream and current chunks
  return { recording, start, stop, mimeType, micStream: streamRef.current, currentMicChunks: chunksRef.current, segments };
}
