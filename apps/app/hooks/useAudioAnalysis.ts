/**
 * @fileoverview Audio Analysis Hook for real-time audio level monitoring
 * @module useAudioAnalysis
 * @description A React hook that provides real-time audio level analysis for microphone and system audio
 */

import { useState, useEffect, useRef } from "react";

/**
 * Calculates volume level from frequency data
 * 
 * @param {AnalyserNode} analyser - Web Audio API analyser node
 * @param {Uint8Array} dataArray - Array to store frequency data
 * @returns {number} Volume level normalized to 0-100 scale
 * 
 * @private
 * @description
 * This helper function processes raw frequency data from an AnalyserNode
 * and converts it to a normalized volume level between 0-100.
 */
function getVolumeFromFrequencyData(
  analyser: AnalyserNode,
  dataArray: Uint8Array,
): number {
  analyser.getByteFrequencyData(dataArray);
  let sum = 0;
  for (let i = 0; i < dataArray.length; i++) {
    const value = dataArray[i];
    if (value !== undefined) {
      sum += value;
    }
  }
  const average = sum / dataArray.length;
  // Scale to 0-100. Adjust the divisor (e.g., 128) based on typical levels
  return Math.min(100, Math.max(0, (average / 128) * 100));
}

/**
 * React hook for real-time audio level analysis
 * 
 * @param {MediaStream | null} micStream - Microphone audio stream to analyze
 * @param {MediaStream | null} systemStream - System audio stream to analyze
 * @returns {Object} Audio analysis state and nodes
 * @returns {AnalyserNode | null} micAnalyserNode - Microphone audio analyzer node
 * @returns {AnalyserNode | null} systemAnalyserNode - System audio analyzer node
 * @returns {number} micLevel - Current microphone audio level (0-100)
 * @returns {number} systemLevel - Current system audio level (0-100)
 * 
 * @example
 * ```tsx
 * const { micLevel, systemLevel } = useAudioAnalysis(microphoneStream, systemAudioStream);
 * 
 * // Display audio levels
 * return (
 *   <div>
 *     <div>Mic Level: {micLevel}</div>
 *     <div>System Audio Level: {systemLevel}</div>
 *   </div>
 * );
 * ```
 */
export function useAudioAnalysis(
  micStream: MediaStream | null,
  systemStream: MediaStream | null,
) {
  const micAudioContextRef = useRef<AudioContext | null>(null);
  const micSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [micAnalyserNode, setMicAnalyserNode] = useState<AnalyserNode | null>(
    null,
  );
  const [micLevel, setMicLevel] = useState(0); // Mic audio level state

  const systemAudioContextRef = useRef<AudioContext | null>(null);
  const systemSourceNodeRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const [systemAnalyserNode, setSystemAnalyserNode] =
    useState<AnalyserNode | null>(null);
  const [systemLevel, setSystemLevel] = useState(0); // System audio level state

  const animationFrameRef = useRef<number | undefined>(undefined);

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
      setMicLevel(0); // Reset level on cleanup
      console.log("Mic analyser cleaned up.");
    }

    // Cleanup function
    return () => {
      if (
        micAudioContextRef.current &&
        micAudioContextRef.current.state !== "closed"
      ) {
        console.log("Unmount cleanup for mic analyser...");
        micSourceNodeRef.current?.disconnect();
        micSourceNodeRef.current = null;
        micAudioContextRef.current.close().catch(console.error);
        micAudioContextRef.current = null;
        setMicAnalyserNode(null); // Ensure state is reset on unmount
        setMicLevel(0); // Reset level on unmount
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
      setSystemLevel(0); // Reset level on cleanup
      console.log("System audio analyser cleaned up.");
    }

    // Cleanup function
    return () => {
      if (
        systemAudioContextRef.current &&
        systemAudioContextRef.current.state !== "closed"
      ) {
        console.log("Unmount cleanup for system audio analyser...");
        systemSourceNodeRef.current?.disconnect();
        systemSourceNodeRef.current = null;
        systemAudioContextRef.current.close().catch(console.error);
        systemAudioContextRef.current = null;
        setSystemAnalyserNode(null); // Ensure state is reset on unmount
        setSystemLevel(0); // Reset level on unmount
      }
    };
  }, [systemStream]);

  // Audio Level Calculation Effect
  useEffect(() => {
    let micDataArray: Uint8Array | null = null;
    let systemDataArray: Uint8Array | null = null;

    if (micAnalyserNode) {
      micDataArray = new Uint8Array(micAnalyserNode.frequencyBinCount);
    }
    if (systemAnalyserNode) {
      systemDataArray = new Uint8Array(systemAnalyserNode.frequencyBinCount);
    }

    const updateLevels = () => {
      let currentMicLevel = 0;
      let currentSystemLevel = 0;

      if (micAnalyserNode && micDataArray) {
        currentMicLevel = getVolumeFromFrequencyData(
          micAnalyserNode,
          micDataArray,
        );
      }
      if (systemAnalyserNode && systemDataArray) {
        currentSystemLevel = getVolumeFromFrequencyData(
          systemAnalyserNode,
          systemDataArray,
        );
      }

      setMicLevel(currentMicLevel);
      setSystemLevel(currentSystemLevel);

      // Continue the loop only if at least one analyser is active
      if (micAnalyserNode || systemAnalyserNode) {
        animationFrameRef.current = requestAnimationFrame(updateLevels);
      }
    };

    // Start the loop if an analyser exists
    if (micAnalyserNode || systemAnalyserNode) {
      animationFrameRef.current = requestAnimationFrame(updateLevels);
    }

    // Cleanup function to cancel the animation frame
    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      setMicLevel(0); // Reset levels on effect cleanup
      setSystemLevel(0);
    };
  }, [micAnalyserNode, systemAnalyserNode]); // Rerun when analysers change

  return { micAnalyserNode, systemAnalyserNode, micLevel, systemLevel };
}
