import { useState, useRef, useCallback, useEffect } from "react";
import { cleanupStream, cleanupRecorder } from "@/lib/utils";

export const SEGMENT_MS = 20_000; // segment length - Exported
const CHUNK_MS = 1_000; // internal timeslice

export function useSegmentRecorder() {
  const [recording, setRecording] = useState(false);
  const [mimeType, setMimeType] = useState("audio/webm;codecs=opus");

  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const isStoppingRef = useRef<boolean>(false); // Flag for intentional stop

  // Assemble and dispatch a complete segment
  const makeBlobAndDispatch = useCallback(() => {
    if (chunksRef.current.length === 0) return; // Don't dispatch empty blobs
    try {
      const blob = new Blob(chunksRef.current, { type: mimeType });
      chunksRef.current = []; // Clear chunks *after* creating blob
      if (blob.size > 0) {
        console.log(
          `[MicRecorder] Dispatching segment event, size: ${blob.size}`,
        );
        window.dispatchEvent(
          new CustomEvent("mic_segment", {
            detail: { blob, timestamp: Date.now() },
          }),
        );
      } else {
        console.warn("[MicRecorder] Segment blob created but size is 0.");
      }
    } catch (error) {
      console.error(
        "[MicRecorder] Error creating or dispatching segment blob:",
        error,
      );
      chunksRef.current = []; // Clear chunks on error too
    }
  }, [mimeType]);

  const startRecorderInternal = useCallback(() => {
    if (!streamRef.current || !MediaRecorder) {
      console.error(
        "[MicRecorder] Cannot start internal recorder: No stream or MediaRecorder support.",
      );
      return;
    }
    isStoppingRef.current = false; // Reset stop flag
    cleanupRecorder(recorderRef); // Ensure previous recorder is stopped
    chunksRef.current = []; // Clear chunks before starting new recorder

    try {
      console.log(
        `[MicRecorder] Creating MediaRecorder with mimeType: ${mimeType}`,
      );
      const recorder = new MediaRecorder(streamRef.current, { mimeType });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          // console.log(`[MicRecorder] Chunk received: ${e.data.size} bytes`); // Can be noisy
          chunksRef.current.push(e.data);
        } else {
          // console.log('[MicRecorder] Chunk received but size is 0.');
        }
      };

      recorder.onstop = () => {
        console.log("[MicRecorder] Internal recorder stopped.");
        makeBlobAndDispatch();
        // Only restart if not intentionally stopping
        if (!isStoppingRef.current && streamRef.current) {
          console.log("[MicRecorder] Restarting internal recorder...");
          startRecorderInternal(); // Restart to continue collecting chunks for the *next* segment
        } else {
          console.log(
            "[MicRecorder] Not restarting internal recorder (intentional stop or no stream).",
          );
          recorderRef.current = null; // Clear ref if not restarting
        }
      };

      recorder.onerror = (event) => {
        console.error("[MicRecorder] MediaRecorder error:", event);
        stop(); // Attempt to stop everything on error
      };

      console.log(
        `[MicRecorder] Starting internal recorder with timeslice: ${CHUNK_MS}ms`,
      );
      recorder.start(CHUNK_MS);
    } catch (err) {
      console.error(
        "[MicRecorder] Error creating/starting MediaRecorder:",
        err,
      );
      stop(); // Attempt to stop everything on error
    }
  }, [mimeType, makeBlobAndDispatch]); // Removed stop from dependencies

  const start = useCallback(async (): Promise<MediaStream | null> => {
    if (recording) {
      console.warn("[MicRecorder] Already recording.");
      return streamRef.current;
    }
    console.log("[MicRecorder] Starting main recording process...");
    isStoppingRef.current = false;

    try {
      console.log("[MicRecorder] Requesting user media...");
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      console.log("[MicRecorder] User media obtained.");

      const supportedMime = MediaRecorder.isTypeSupported(
        "audio/webm;codecs=opus",
      )
        ? "audio/webm;codecs=opus"
        : "audio/ogg;codecs=opus";
      console.log(
        `[MicRecorder] Determined supported mimeType: ${supportedMime}`,
      );
      setMimeType(supportedMime);

      startRecorderInternal(); // Start the internal recorder loop

      // Clear previous timer
      if (timerRef.current) clearInterval(timerRef.current);

      console.log(
        `[MicRecorder] Setting segment interval timer: ${SEGMENT_MS}ms`,
      );
      timerRef.current = setInterval(() => {
        if (recorderRef.current && recorderRef.current.state === "recording") {
          console.log(
            `[MicRecorder] Interval timer: Stopping internal recorder to finalize segment.`,
          );
          recorderRef.current.stop(); // Stop triggers onstop, which handles blob creation and restart
        } else {
          console.warn(
            "[MicRecorder] Interval timer: Recorder not active, cannot stop.",
          );
        }
      }, SEGMENT_MS);

      setRecording(true);
      console.log("[MicRecorder] Main recording process started successfully.");
      return stream; // Return the stream on success
    } catch (err) {
      console.error(
        "[MicRecorder] Error getting user media or starting process:",
        err,
      );
      cleanupStream(streamRef);
      setRecording(false);
      return null; // Return null on error
    }
  }, [recording, startRecorderInternal]);

  const stop = useCallback(() => {
    if (!recording && !streamRef.current && !recorderRef.current) {
      console.log("[MicRecorder] Stop called but already stopped/inactive.");
      return;
    }
    console.log("[MicRecorder] Stopping main recording process...");
    isStoppingRef.current = true; // Signal intentional stop

    if (timerRef.current) {
      console.log("[MicRecorder] Clearing segment interval timer.");
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    // Stop the recorder - this should trigger one last makeBlobAndDispatch via onstop
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      console.log("[MicRecorder] Stopping internal recorder instance...");
      // Keep onstop handler to process final chunks, isStoppingRef prevents restart
      try {
        recorderRef.current.stop();
      } catch (e) {
        console.warn("[MicRecorder] Error stopping MediaRecorder instance:", e);
        // Manually try to dispatch remaining chunks if stop failed
        makeBlobAndDispatch();
        recorderRef.current = null; // Clear ref after manual dispatch
      }
    } else {
      // If recorder wasn't active, still try to dispatch any remaining chunks
      console.log(
        "[MicRecorder] Recorder inactive, dispatching any remaining chunks manually.",
      );
      makeBlobAndDispatch();
    }

    console.log("[MicRecorder] Cleaning up media stream...");
    cleanupStream(streamRef);

    // Chunks are cleared within makeBlobAndDispatch or here if stop failed
    if (recorderRef.current === null) {
      // Ensure chunks are cleared if recorder stop failed
      chunksRef.current = [];
    }

    setRecording(false);
    console.log("[MicRecorder] Main recording process stopped.");
  }, [recording, makeBlobAndDispatch]); // Added recording and makeBlobAndDispatch

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      console.log("[MicRecorder] Unmounting, ensuring cleanup.");
      stop();
    };
  }, [stop]);

  // Expose necessary values
  return {
    recording,
    start,
    stop,
    mimeType,
    micStream: streamRef.current, // Expose the current stream
    currentMicChunksRef: chunksRef, // Expose the ref to current chunks
  };
}
