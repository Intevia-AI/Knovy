import React, { useEffect, useRef, useState } from "react";
import { MonitorIcon, Loader2 } from "lucide-react";

export function ScreenPreviewPopup() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 10; // Poll for 5 seconds (10 * 500ms)
    let intervalId: NodeJS.Timeout | null = null;

    const getSourceAndSetupStream = async () => {
      console.log(`[ScreenPreviewPopup] Attempting to get source ID (Attempt: ${attempts + 1})`);
      try {
        const sourceId = await window.electronAPI.invoke('electronAPI:getActiveScreenSourceId');
        console.log(`[ScreenPreviewPopup] Received source ID: ${sourceId}`);

        if (sourceId) {
          if (intervalId) clearInterval(intervalId);
          setIsLoading(false);

          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: sourceId
              }
            }
          });
          setVideoStream(stream);
        } else {
          attempts++;
          if (attempts >= maxAttempts) {
            if (intervalId) clearInterval(intervalId);
            console.warn('[ScreenPreviewPopup] Max attempts reached. Could not get source ID.');
            setIsLoading(false); // Stop loading, show placeholder
          }
        }
      } catch (error) {
        console.error('[ScreenPreviewPopup] Error getting source or stream:', error);
        if (intervalId) clearInterval(intervalId);
        setIsLoading(false);
      }
    };

    getSourceAndSetupStream();
    intervalId = setInterval(getSourceAndSetupStream, 500);

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // Empty dependency array ensures this runs only once on mount

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(e => console.error("[ScreenPreviewPopup] Video play error:", e));
    }
  }, [videoStream]);

  return (
    <div className="grid gap-4 p-4 bg-muted/10 rounded-2xl">
      {videoStream ? (
        <video ref={videoRef} autoPlay muted className="w-full rounded-md border bg-muted" />
      ) : (
        <div className="w-full aspect-video rounded-md border bg-muted flex items-center justify-center">
          {isLoading ? (
            <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
          ) : (
            <MonitorIcon className="h-12 w-12 text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
