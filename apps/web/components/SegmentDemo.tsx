/**
 * @fileoverview SegmentDemo Component - Demonstrates audio segment recording and processing
 * @module SegmentDemo
 * @description A simple React component that demonstrates the useSegmentRecorder hook
 * by recording audio segments and sending them to the AI API for processing.
 */

"use client";
import { useEffect, useState } from "react";
import { useSegmentRecorder } from "@/hooks/useSegmentRecorder";

/**
 * @component SegmentDemo
 * @description A demonstration component for audio segment recording functionality
 * Provides UI controls for starting and stopping audio recording
 * Automatically processes recorded segments by sending them to the AI API
 * 
 * @example
 * ```tsx
 * <SegmentDemo />
 * ```
 */
export default function SegmentDemo() {
  const { recording, start, stop, mimeType } = useSegmentRecorder();
  const [busy, setBusy] = useState(false);

  /**
   * Effect hook that sets up an event listener for the "segment" event
   * When a new audio segment is recorded, it:
   * 1. Converts the blob to a base64 string
   * 2. Sends the data to the AI API for processing
   * 3. Updates the UI state to show upload status
   */
  useEffect(() => {
    // Handler for segment events
    const handler = async (e: CustomEvent<Blob>) => {
      setBusy(true); // Show uploading indicator
      
      // Convert blob to base64 string
      const buf = await e.detail.arrayBuffer();
      const b64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
      
      // Send to AI API
      await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: b64, mimeType }),
      });
      
      setBusy(false); // Hide uploading indicator
    };
    
    // Add event listener
    window.addEventListener("segment", handler as any);
    
    // Clean up event listener on unmount
    return () => window.removeEventListener("segment", handler as any);
  }, [mimeType]);

  return (
    <div className="flex gap-3">
      {!recording ? (
        <button onClick={start} className="btn-primary">
          🎙️ Start
        </button>
      ) : (
        <button onClick={stop} className="btn-danger">
          ⏹ Stop
        </button>
      )}
      {busy && <span>Uploading…</span>}
    </div>
  );
}
