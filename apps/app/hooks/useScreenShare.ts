import { useState, useRef, useCallback, useEffect } from 'react';
import { cleanupStream, cleanupRecorder } from '@/lib/utils';
import { useSegmentRecorder } from '@/hooks/useSegmentRecorder'; // Assuming mic recording is handled here
import type { Segment } from '@/types';

const SEGMENT_MS = 20_000; // System audio segment duration

export function useScreenShare() {
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [currentSystemAudioStream, setCurrentSystemAudioStream] = useState<MediaStream | null>(null);
  const [systemAudioSegments, setSystemAudioSegments] = useState<Segment[]>([]);
  const [systemAudioMimeType, setSystemAudioMimeType] = useState<string>("");

  const screenStreamRef = useRef<MediaStream | null>(null);
  const screenPreviewRef = useRef<HTMLVideoElement>(null);
  const systemAudioRecorderRef = useRef<MediaRecorder | null>(null);
  const systemAudioChunksRef = useRef<Blob[]>([]);
  const systemAudioTimerRef = useRef<NodeJS.Timeout | null>(null);

  const {
    start: startMicRecording,
    stop: stopMicRecording,
    reset: resetMicRecorder, // Add reset function from useSegmentRecorder
    micStream,
    segments: micSegments,
    mimeType: micMimeType,
  } = useSegmentRecorder();

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
    console.log("Stopping screen share and recordings...");
    stopMicRecording();

    if (systemAudioTimerRef.current) {
      clearInterval(systemAudioTimerRef.current);
      systemAudioTimerRef.current = null;
    }

    cleanupRecorder(systemAudioRecorderRef);
    systemAudioChunksRef.current = [];

    cleanupStream(screenStreamRef); // Stops both video and audio tracks in the screen stream

    if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null;

    // No need to manually disconnect analyser nodes here, useAudioAnalysis handles it

    setCurrentSystemAudioStream(null); // This will trigger cleanup in useAudioAnalysis
    setIsScreenSharing(false);
    setRecordingDuration(0);
    // Reset states
    setSystemAudioSegments([]);
    setSystemAudioMimeType("");

    console.log("Screen share stopped.");
  }, [stopMicRecording]);


  const startScreenShare = useCallback(async () => {
    console.log("Attempting to start screen share...");
    // Reset previous state
    resetMicRecorder(); // Reset mic recorder state including segments
    setSystemAudioSegments([]);
    systemAudioChunksRef.current = [];
    setSystemAudioMimeType("");
    setRecordingDuration(0);
    setCurrentSystemAudioStream(null); // Ensure previous stream is cleared

    let capturedMicStream: MediaStream | null = null;
    let displayStream: MediaStream | null = null;
    let systemAudioStreamOnly: MediaStream | null = null; // Separate stream for system audio tracks

    try {
      // --- Step 1: Check for API support ---
      if (!navigator.mediaDevices || !navigator.mediaDevices.getDisplayMedia) {
        throw new Error("getDisplayMedia is not supported by this environment.");
      }
      if (!window.electronAPI) {
        throw new Error("Electron API not loaded. Cannot select source.");
      }

      console.log("Requesting screen share via getDisplayMedia (expecting interception)...");
      // Electron's preload script intercepts this and shows the picker
      displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: true, // Request audio (system audio / loopback)
      });
      screenStreamRef.current = displayStream; // Store the combined stream
      console.log("Screen share stream obtained:", displayStream);

      // --- Check for Audio Track (System Audio) ---
      const audioTracks = displayStream.getAudioTracks();
      console.log(`Stream has ${audioTracks.length} audio tracks.`);
      if (audioTracks.length > 0) {
        console.log("System audio track found in stream.");
        systemAudioStreamOnly = new MediaStream(audioTracks); // Create a stream with only the audio tracks
        setCurrentSystemAudioStream(systemAudioStreamOnly); // Set state for analysis hook
      } else {
        console.warn("System audio track *NOT* found. Recording mic only.");
        alert("警告：無法擷取系統音訊。錄音將只包含麥克風。");
        setCurrentSystemAudioStream(null);
      }

      // --- Step 2: Start Microphone Recording ---
      console.log("Starting microphone recording...");
      capturedMicStream = await startMicRecording(); // Use the hook's start function
      if (!capturedMicStream) {
        throw new Error("Failed to start microphone recording. Check permissions.");
      }
      console.log("Microphone recording started.");

      // --- Step 3: Setup System Audio Recorder (if audio track exists) ---
      if (systemAudioStreamOnly) {
         console.log("Setting up system audio recorder...");
        try {
          const potentialMimeTypes = ["audio/webm", "audio/ogg", "audio/mp4"]; // Prioritize webm/ogg
          let supportedMimeType = "";
          for (const mime of potentialMimeTypes) {
            if (MediaRecorder.isTypeSupported(mime)) {
              supportedMimeType = mime;
              break;
            }
          }
          if (!supportedMimeType) {
            throw new Error("No supported audio mime type found for system audio.");
          }

          console.log("Using supported mime type for system audio:", supportedMimeType);
          setSystemAudioMimeType(supportedMimeType);
          cleanupRecorder(systemAudioRecorderRef); // Cleanup previous instance if any

          const systemRecorder = new MediaRecorder(systemAudioStreamOnly, { // Record only the system audio stream
            mimeType: supportedMimeType,
          });
          systemAudioRecorderRef.current = systemRecorder;

          systemRecorder.ondataavailable = (e) => {
            if (e.data.size > 0) {
              console.log(`System audio data available: ${e.data.size} bytes`);
              systemAudioChunksRef.current.push(e.data);
              // Create segment immediately when data is available (more granular)
              // const currentBlob = new Blob([e.data], { type: supportedMimeType });
              // setSystemAudioSegments((prev) => [...prev, { blob: currentBlob, timestamp: Date.now() }]);
            }
          };

          systemRecorder.onerror = (event) => {
            console.error("System MediaRecorder error:", event);
            // Handle error appropriately, maybe stop recording
            stopScreenShare();
          };

          systemRecorder.onstop = () => {
             console.log("System recorder stopped. Processing chunks...");
             if (systemAudioChunksRef.current.length > 0) {
                 const segmentBlob = new Blob(systemAudioChunksRef.current, { type: supportedMimeType });
                 console.log(`System audio segment created: ${segmentBlob.size} bytes`);
                 setSystemAudioSegments((prev) => [...prev, { blob: segmentBlob, timestamp: Date.now() }]);
                 systemAudioChunksRef.current = []; // Clear chunks for the next segment
             }
          };

          // Start recording and set up interval to create segments
          systemRecorder.start(); // Start immediately
           console.log("System recorder started.");
          if (systemAudioTimerRef.current) clearInterval(systemAudioTimerRef.current); // Clear previous timer
          systemAudioTimerRef.current = setInterval(() => {
            if (systemAudioRecorderRef.current?.state === "recording") {
              console.log(`Requesting system audio data segment (Interval: ${SEGMENT_MS}ms)`);
              // systemAudioRecorderRef.current.requestData(); // Request data more frequently if needed
               systemAudioRecorderRef.current.stop(); // Stop to trigger onstop and process chunks
               // Restart recording immediately for the next segment
               if (systemAudioRecorderRef.current) {
                   systemAudioRecorderRef.current.start();
               }
            } else {
                 console.warn("System recorder not recording in interval. Clearing timer.");
                 if (systemAudioTimerRef.current) clearInterval(systemAudioTimerRef.current);
                 systemAudioTimerRef.current = null;
            }
          }, SEGMENT_MS); // Create segments every SEGMENT_MS

        } catch (recorderError) {
          console.error("Failed to create system MediaRecorder:", recorderError);
          alert(`無法建立系統音訊錄製器: ${recorderError instanceof Error ? recorderError.message : String(recorderError)}`);
          // Cleanup partial setup
          systemAudioStreamOnly?.getTracks().forEach((track) => track.stop());
          setCurrentSystemAudioStream(null);
          stopScreenShare(); // Stop everything if system recorder fails
          return; // Exit function
        }
      } else {
        console.log("No system audio stream, skipping system audio recorder setup.");
        cleanupRecorder(systemAudioRecorderRef); // Ensure recorder is clean
        setSystemAudioMimeType("");
      }

      // --- Finalize ---
      setIsScreenSharing(true);
      console.log("Screen sharing and recording setup complete.");

    } catch (e) {
      console.error("Error during screen share setup process:", e);
      let userMessage = `啟動分享時發生錯誤: ${e instanceof Error ? e.message : String(e)}`;
      if (e instanceof DOMException) {
        if (e.name === "NotAllowedError") {
          userMessage = "錯誤：螢幕分享權限被拒絕或取消。";
          console.log("getDisplayMedia request was denied or cancelled.");
        } else if (e.name === "NotFoundError") {
          userMessage = "錯誤：找不到可分享的螢幕或視窗。";
          console.error("No suitable media source found.");
        }
      }
      alert(userMessage);

      // Cleanup on error
      stopScreenShare(); // Use the dedicated stop function for cleanup
    }
  }, [startMicRecording, stopScreenShare, resetMicRecorder]);

  const toggleScreenShare = useCallback(() => {
    if (isScreenSharing) {
      stopScreenShare();
    } else {
      // Reset electron source picker state before starting
      // No need to explicitly reset mic recorder here, startScreenShare does it
      startScreenShare();
    }
  }, [isScreenSharing, startScreenShare, stopScreenShare]);

  return {
    isScreenSharing,
    recordingDuration,
    micStream, // from useSegmentRecorder
    currentSystemAudioStream,
    micSegments, // from useSegmentRecorder
    systemAudioSegments,
    micMimeType, // from useSegmentRecorder
    systemAudioMimeType,
    toggleScreenShare,
    screenPreviewRef, // Ref for the video element
  };
}
