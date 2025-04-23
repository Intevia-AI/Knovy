import { useState, useEffect, useRef } from 'react';

export function useAudioAnalysis(micStream: MediaStream | null, systemStream: MediaStream | null) {
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [micAnalyserNode, setMicAnalyserNode] = useState<AnalyserNode | null>(null);

  const systemAudioContextRef = useRef<AudioContext | null>(null);
  const systemSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [systemAnalyserNode, setSystemAnalyserNode] = useState<AnalyserNode | null>(null);

  // Mic Analyser Setup
  useEffect(() => {
    if (micStream && !micAudioContextRef.current) {
      console.log("Setting up mic analyser...");
      try {
        const audioCtx = new window.AudioContext();
        micAudioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(micStream);
        micSourceNodeRef.current = source;
        const analyser = audioCtx.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 256;
        source.connect(analyser);
        setMicAnalyserNode(analyser);
        console.log("Mic analyser setup complete.");
      } catch (error) {
        console.error("Error setting up mic analyser:", error);
        micSourceNodeRef.current?.disconnect();
        micSourceNodeRef.current = null;
        micAudioContextRef.current?.close().catch(console.error);
        micAudioContextRef.current = null;
        setMicAnalyserNode(null);
      }
    } else if (!micStream && micAudioContextRef.current) {
      console.log("Cleaning up mic analyser...");
      micSourceNodeRef.current?.disconnect();
      micSourceNodeRef.current = null;
      if (micAudioContextRef.current.state !== "closed") {
        micAudioContextRef.current.close().catch(console.error);
      }
      micAudioContextRef.current = null;
      setMicAnalyserNode(null);
      console.log("Mic analyser cleaned up.");
    }

    // Cleanup function
    return () => {
      if (micAudioContextRef.current && micAudioContextRef.current.state !== "closed") {
        console.log("Unmount cleanup for mic analyser...");
        micSourceNodeRef.current?.disconnect();
        micSourceNodeRef.current = null;
        micAudioContextRef.current.close().catch(console.error);
        micAudioContextRef.current = null;
        setMicAnalyserNode(null); // Ensure state is reset on unmount
      }
    };
  }, [micStream]);

  // System Audio Analyser Setup
  useEffect(() => {
    if (systemStream && !systemAudioContextRef.current) {
       console.log("Setting up system audio analyser...");
      try {
        const audioCtx = new window.AudioContext();
        systemAudioContextRef.current = audioCtx;
        const source = audioCtx.createMediaStreamSource(systemStream);
        systemSourceNodeRef.current = source;
        const analyser = audioCtx.createAnalyser();
        analyser.smoothingTimeConstant = 0.3;
        analyser.fftSize = 256;
        source.connect(analyser);
        setSystemAnalyserNode(analyser);
         console.log("System audio analyser setup complete.");
      } catch (error) {
        console.error("Error setting up system audio analyser:", error);
        systemSourceNodeRef.current?.disconnect();
        systemSourceNodeRef.current = null;
        systemAudioContextRef.current?.close().catch(console.error);
        systemAudioContextRef.current = null;
        setSystemAnalyserNode(null);
      }
    } else if (!systemStream && systemAudioContextRef.current) {
       console.log("Cleaning up system audio analyser...");
      systemSourceNodeRef.current?.disconnect();
      systemSourceNodeRef.current = null;
      if (systemAudioContextRef.current.state !== "closed") {
        systemAudioContextRef.current.close().catch(console.error);
      }
      systemAudioContextRef.current = null;
      setSystemAnalyserNode(null);
       console.log("System audio analyser cleaned up.");
    }

     // Cleanup function
     return () => {
       if (systemAudioContextRef.current && systemAudioContextRef.current.state !== "closed") {
         console.log("Unmount cleanup for system audio analyser...");
         systemSourceNodeRef.current?.disconnect();
         systemSourceNodeRef.current = null;
         systemAudioContextRef.current.close().catch(console.error);
         systemAudioContextRef.current = null;
         setSystemAnalyserNode(null); // Ensure state is reset on unmount
       }
     };
  }, [systemStream]);


  return { micAnalyserNode, systemAnalyserNode };
}
