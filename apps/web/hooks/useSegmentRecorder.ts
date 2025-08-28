/**
 * @fileoverview useSegmentRecorder Hook - Audio recording with automatic segmentation
 * @module useSegmentRecorder
 * @description A React hook that provides audio recording functionality with automatic
 * segmentation at regular intervals. Recorded segments are dispatched as custom events.
 */

import { useCallback, useRef, useState } from "react";

/**
 * @constant {number} SEGMENT_MS - Duration of each audio segment in milliseconds (20 seconds)
 * @description Controls how frequently complete audio segments are created and dispatched
 */
export const SEGMENT_MS = 20_000;

/**
 * @constant {number} CHUNK_MS - Internal timeslice for MediaRecorder in milliseconds (1 second)
 * @description Controls how frequently the MediaRecorder provides data chunks
 */
const CHUNK_MS = 1_000;

/**
 * @hook useSegmentRecorder
 * @description React hook for recording audio with automatic segmentation
 *
 * @returns {Object} Recording control object
 * @returns {boolean} recording - Whether recording is currently active
 * @returns {function} start - Function to start recording, returns the MediaStream or null
 * @returns {function} stop - Function to stop recording
 * @returns {string} mimeType - MIME type of the recorded audio
 * @returns {MediaStream|null} micStream - Current microphone MediaStream
 * @returns {Blob[]} currentMicChunks - Current audio chunks being recorded
 *
 * @example
 * ```tsx
 * const { recording, start, stop, mimeType } = useSegmentRecorder();
 *
 * // Start recording
 * const handleStart = async () => {
 *   const stream = await start();
 *   if (!stream) {
 *     console.error("Failed to start recording");
 *   }
 * };
 *
 * // Listen for segments
 * useEffect(() => {
 *   const handleSegment = (e) => {
 *     const audioBlob = e.detail;
 *     // Process the audio segment...
 *   };
 *   window.addEventListener("segment", handleSegment);
 *   return () => window.removeEventListener("segment", handleSegment);
 * }, []);
 * ```
 */
export function useSegmentRecorder() {
  /**
   * @state {MediaStream|null} streamRef - Reference to the microphone MediaStream
   * @state {MediaRecorder|null} recRef - Reference to the MediaRecorder instance
   * @state {NodeJS.Timeout|null} timerRef - Reference to the segment timer interval
   * @state {Blob[]} chunksRef - Reference to the current audio chunks being recorded
   * @state {boolean} isStoppingRef - Flag indicating an intentional stop is in progress
   * @state {boolean} recording - Whether recording is currently active
   * @state {string} mimeType - MIME type of the recorded audio
   */
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isStoppingRef = useRef<boolean>(false);
  const [recording, setRecording] = useState(false);
  const [mimeType, setMime] = useState("audio/webm;codecs=opus");

  // assemble and dispatch a complete segment
  const makeBlob = () => new Blob(chunksRef.current.splice(0), { type: mimeType });

  const startRecorder = useCallback(() => {
    if (!streamRef.current || !MediaRecorder) return; // Check MediaRecorder support
    isStoppingRef.current = false; // Reset stop flag
    try {
      // Add try-catch for MediaRecorder constructor
      const rec = new MediaRecorder(streamRef.current, { mimeType });
      rec.ondataavailable = (e) => {
        if (e.data.size) {
          chunksRef.current.push(e.data);
          // 每次收到新的數據時，都檢查是否有足夠的內容
          const currentBlob = new Blob(chunksRef.current, { type: mimeType });
          if (currentBlob.size > 0) {
            window.dispatchEvent(new CustomEvent("segment", { detail: currentBlob }));
          }
        }
      };
      rec.onstop = () => {
        const blob = makeBlob();
        // Only dispatch if there's data, prevent empty blobs
        if (blob.size > 0) {
          window.dispatchEvent(new CustomEvent("segment", { detail: blob }));
        }
        // Only restart if not intentionally stopping
        if (!isStoppingRef.current) {
          startRecorder();
        }
      };
      rec.onerror = (event) => {
        // Add error handling for recorder
        console.error("MediaRecorder error:", event);
        // Optionally try to stop and cleanup
        stop();
      };
      rec.start(CHUNK_MS);
      recRef.current = rec;
    } catch (err) {
      console.error("Error creating MediaRecorder:", err);
      // Handle error, maybe stop the process
      stop();
    }
  }, [mimeType]); // Removed stop from dependencies

  const start = useCallback(async (): Promise<MediaStream | null> => {
    // Return stream or null
    if (recording) return streamRef.current; // Return existing stream if already recording
    isStoppingRef.current = false; // Ensure reset when starting
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      setMime(
        MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/ogg;codecs=opus",
      );
      startRecorder();
      // Clear previous timer just in case
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        if (recRef.current && recRef.current.state === "recording") {
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
    if (recRef.current && recRef.current.state !== "inactive") {
      recRef.current.onstop = null; // Prevent the restart logic in onstop
      recRef.current.ondataavailable = null; // Clean up handlers
      recRef.current.onerror = null;
      try {
        // Add try-catch for stop
        recRef.current.stop();
      } catch (e) {
        console.warn("Error stopping MediaRecorder:", e);
      }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null; // Clear stream ref on stop
    recRef.current = null; // Clear recorder ref
    chunksRef.current = []; // Clear chunks
    setRecording(false);
  }, []);

  // Expose streamRef's current value via micStream and current chunks
  return {
    recording,
    start,
    stop,
    mimeType,
    micStream: streamRef.current,
    currentMicChunks: chunksRef.current,
  };
}
