import { useState, useRef, useCallback, useEffect } from 'react';
import { cleanupStream, cleanupRecorder } from '@/lib/utils';
import { useSegmentRecorder, SEGMENT_MS } from '@/hooks/useSegmentRecorder'; // Import SEGMENT_MS
import type { Segment } from '@/types';

// Use the same segment duration for system audio
const SYSTEM_AUDIO_SEGMENT_MS = SEGMENT_MS;
const SYSTEM_AUDIO_CHUNK_MS = 1000; // Internal chunk collection interval

export function useScreenShare() {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentSystemAudioStream, setCurrentSystemAudioStream] = useState<MediaStream | null>(null);
  const [systemAudioSegments, setSystemAudioSegments] = useState<Segment[]>([]);
  const [systemAudioMimeType, setSystemAudioMimeType] = useState<string>("");

  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const systemAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const systemAudioChunksRef = useRef<Blob[]>([]); // Ref for current system audio chunks
  const systemAudioTimerRef = useRef<NodeJS.Timeout | null>(null); // Timer for system audio segmentation
  const isStoppingSystemAudioRef = useRef<boolean>(false); // Flag for intentional stop

  const {
    start: startMicRecording,
    stop: stopMicRecording,
    micStream,
    mimeType: micMimeType,
    currentMicChunksRef, // Get ref to current mic chunks
  } = useSegmentRecorder();

  const [micSegments, setMicSegments] = useState<Segment[]>([]); // State to store mic segments from event

  // --- Mic Segment Event Listener ---
  useEffect(() => {
    const handleMicSegment = (event: CustomEvent<{ blob: Blob; timestamp: number }>) => {
      console.log(`[ScreenShare] Received mic_segment event, size: ${event.detail.blob.size}`);
      setMicSegments((prev) => [...prev, event.detail]);
    };

    window.addEventListener('mic_segment', handleMicSegment as EventListener);
    return () => {
      window.removeEventListener('mic_segment', handleMicSegment as EventListener);
    };
  }, []);

  // --- System Audio Blob Creation and Dispatch ---
  const makeSystemAudioBlobAndDispatch = useCallback(() => {
    if (systemAudioChunksRef.current.length === 0) return;
    try {
      const blob = new Blob(systemAudioChunksRef.current, { type: systemAudioMimeType });
      systemAudioChunksRef.current = []; // Clear chunks
      if (blob.size > 0) {
        console.log(`[ScreenShare] Dispatching system_segment event, size: ${blob.size}`);
        setSystemAudioSegments((prev) => [...prev, { blob, timestamp: Date.now() }]);
      } else {
        console.warn('[ScreenShare] System audio blob created but size is 0.');
      }
    } catch (error) {
      console.error('[ScreenShare] Error creating/dispatching system audio blob:', error);
      systemAudioChunksRef.current = [];
    }
  }, [systemAudioMimeType]);

  // --- Start System Audio Recorder (Internal) ---
  const startSystemAudioRecorderInternal = useCallback((stream: MediaStream) => {
    if (!stream || !MediaRecorder) {
      console.error('[ScreenShare] Cannot start system audio recorder: No stream or MediaRecorder support.');
      return;
    }
    isStoppingSystemAudioRef.current = false;
    cleanupRecorder(systemAudioRecorderRef);
    systemAudioChunksRef.current = [];

    try {
      // Determine mime type (same logic as mic)
      const potentialMimeTypes = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/webm'];
      let supportedMimeType = "";
      for (const mime of potentialMimeTypes) {
        if (MediaRecorder.isTypeSupported(mime)) {
          supportedMimeType = mime; break;
        }
      }
      console.log(`[ScreenShare] Using system audio MIME type: ${supportedMimeType || 'default'}`);
      setSystemAudioMimeType(supportedMimeType);

      const recorder = new MediaRecorder(stream, { mimeType: supportedMimeType || undefined });
      systemAudioRecorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          systemAudioChunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        console.log('[ScreenShare] System audio recorder stopped.');
        makeSystemAudioBlobAndDispatch();
        if (!isStoppingSystemAudioRef.current && currentSystemAudioStream) {
          console.log('[ScreenShare] Restarting system audio recorder...');
          startSystemAudioRecorderInternal(currentSystemAudioStream); // Restart
        } else {
           console.log('[ScreenShare] Not restarting system audio recorder.');
           systemAudioRecorderRef.current = null;
        }
      };

      recorder.onerror = (event) => {
        console.error("[ScreenShare] System MediaRecorder error:", event);
        stopScreenShare(); // Stop everything on error
      };

      console.log(`[ScreenShare] Starting system audio recorder with timeslice: ${SYSTEM_AUDIO_CHUNK_MS}ms`);
      recorder.start(SYSTEM_AUDIO_CHUNK_MS);

    } catch (recorderError) {
      console.error("[ScreenShare] Failed to create/start system MediaRecorder:", recorderError);
      alert(`無法建立系統音訊錄製器: ${recorderError instanceof Error ? recorderError.message : String(recorderError)}`);
      stopScreenShare();
    }
  }, [makeSystemAudioBlobAndDispatch, currentSystemAudioStream]); // Added dependencies

  // Timer effect
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    if (isScreenSharing) {
      setRecordingDuration(0);
      timer = setInterval(() => setRecordingDuration((d) => d + 1), 1000);
    } else {
      setRecordingDuration(0);
      if (timer) clearInterval(timer);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isScreenSharing]);

  // Screen preview effect
  useEffect(() => {
    if (
      isScreenSharing &&
      screenPreviewRef.current &&
      screenStreamRef.current?.getVideoTracks().length
    ) {
      const videoStream = new MediaStream(screenStreamRef.current.getVideoTracks());
      screenPreviewRef.current.srcObject = videoStream;
      screenPreviewRef.current.muted = true; // Ensure preview is muted
      screenPreviewRef.current.play().catch((e) => console.error("Video play error:", e));
    } else if (!isScreenSharing && screenPreviewRef.current) {
      screenPreviewRef.current.srcObject = null;
    }
    // Cleanup srcObject when component unmounts or isScreenSharing becomes false
    return () => {
        if (screenPreviewRef.current) {
            screenPreviewRef.current.srcObject = null;
        }
    };
  }, [isScreenSharing]); // Rerun when isScreenSharing changes

  const stopScreenShare = useCallback(() => {
    console.log("[ScreenShare] Stopping screen share and recordings...");
    stopMicRecording();

    // Stop system audio recording process
    isStoppingSystemAudioRef.current = true;
    if (systemAudioTimerRef.current) {
      clearInterval(systemAudioTimerRef.current);
      systemAudioTimerRef.current = null;
    }
    if (systemAudioRecorderRef.current && systemAudioRecorderRef.current.state !== 'inactive') {
        try {
            systemAudioRecorderRef.current.stop(); // Trigger final onstop
        } catch(e) {
            console.warn("[ScreenShare] Error stopping system recorder:", e);
            makeSystemAudioBlobAndDispatch(); // Manual dispatch if stop fails
            systemAudioRecorderRef.current = null;
        }
    } else {
        makeSystemAudioBlobAndDispatch(); // Dispatch remaining if inactive
    }

    // Cleanup screen stream
    cleanupStream(screenStreamRef);
    if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;

    setCurrentSystemAudioStream(null);
    setIsScreenSharing(false);
    setRecordingDuration(0);
    // Reset states
    setSystemAudioSegments([]);
    setMicSegments([]); // Reset mic segments state
    setSystemAudioMimeType("");

    console.log("[ScreenShare] Screen share stopped.");
  }, [stopMicRecording, makeSystemAudioBlobAndDispatch]); // Dependencies updated

  const startScreenShare = useCallback(async () => {
    console.log("[ScreenShare] Attempting to start screen share...");
    // Reset previous state
    setMicSegments([]); // Clear mic segments state
    setSystemAudioSegments([]);
    setSystemAudioMimeType("");
    setRecordingDuration(0);
    setCurrentSystemAudioStream(null);
    cleanupRecorder(systemAudioRecorderRef);
    systemAudioChunksRef.current = [];
    if (systemAudioTimerRef.current) clearInterval(systemAudioTimerRef.current);

    let capturedMicStream: MediaStream | null = null;
    let displayStream: MediaStream | null = null;
    let systemAudioStreamOnly: MediaStream | null = null;

    try {
      // --- Step 1: Check for API support & Get Display Media ---
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("getDisplayMedia is not supported by this environment.");
      }
      console.log("Requesting screen share via getDisplayMedia...");
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true,
      });
      screenStreamRef.current = displayStream;
      console.log("Screen share stream obtained:", displayStream);

      // --- Check for Audio Track (System Audio) ---
      const audioTracks = displayStream.getAudioTracks();
      if (audioTracks.length > 0) {
        console.log("[ScreenShare] System audio track found.");
        systemAudioStreamOnly = new MediaStream(audioTracks);
        setCurrentSystemAudioStream(systemAudioStreamOnly);
      } else {
        console.warn("[ScreenShare] System audio track *NOT* found. Recording mic only.");
        alert("警告：無法擷取系統音訊。錄音將只包含麥克風。");
        setCurrentSystemAudioStream(null);
      }

      // --- Step 2: Start Microphone Recording ---
      console.log("[ScreenShare] Starting microphone recording...");
      capturedMicStream = await startMicRecording();
      if (!capturedMicStream) {
        throw new Error("Failed to start microphone recording. Check permissions.");
      }
      console.log("[ScreenShare] Microphone recording started.");

      // --- Step 3: Setup System Audio Recorder (if audio track exists) ---
      if (systemAudioStreamOnly) {
         console.log("[ScreenShare] Setting up system audio recording process...");
         startSystemAudioRecorderInternal(systemAudioStreamOnly);

         // Setup interval timer for system audio segmentation
         if (systemAudioTimerRef.current) clearInterval(systemAudioTimerRef.current);
         console.log(`[ScreenShare] Setting system audio segment interval timer: ${SYSTEM_AUDIO_SEGMENT_MS}ms`);
         systemAudioTimerRef.current = setInterval(() => {
            if (systemAudioRecorderRef.current && systemAudioRecorderRef.current.state === 'recording') {
                console.log(`[ScreenShare] Interval timer: Stopping system audio recorder to finalize segment.`);
                systemAudioRecorderRef.current.stop(); // Triggers onstop
            } else {
                 console.warn('[ScreenShare] Interval timer: System recorder not active.');
            }
         }, SYSTEM_AUDIO_SEGMENT_MS);

      } else {
        console.log("[ScreenShare] No system audio stream, skipping system audio recorder setup.");
        setSystemAudioMimeType("");
      }

      // --- Finalize ---
      // 等待一小段時間確保所有資源都已初始化
      await new Promise(resolve => setTimeout(resolve, 500));
      setIsScreenSharing(true);
      console.log("[ScreenShare] Screen sharing and recording setup complete.");

    } catch (e) {
      console.error("Error during screen share setup process:", e);
      let userMessage = `啟動分享時發生錯誤: ${e instanceof Error ? e.message : String(e)}`;
      if (e instanceof DOMException) {
        if (e.name === "NotAllowedError") {
          userMessage = "錯誤：螢幕分享權限被拒絕或取消。";
        } else if (e.name === "NotFoundError") {
          userMessage = "錯誤：找不到可分享的螢幕或視窗。";
        }
      }
      alert(userMessage);
      stopScreenShare(); // Ensure cleanup on any error
    }
  }, [startMicRecording, stopScreenShare, startSystemAudioRecorderInternal]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  return {
    isScreenSharing,
    recordingDuration,
    micStream, // from useSegmentRecorder
    currentSystemAudioStream,
    micSegments, // from state updated by event listener
    systemAudioSegments, // from state updated by system audio logic
    micMimeType, // from useSegmentRecorder
    systemAudioMimeType,
    toggleScreenShare,
    screenPreviewRef, // Ref for the video element
    currentMicChunksRef, // Pass mic chunks ref
    systemAudioChunksRef, // Pass system chunks ref
  };
}
