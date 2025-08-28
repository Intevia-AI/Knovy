import React, { useEffect, useRef, useState } from "react";
import { MonitorIcon, Loader2 } from "lucide-react";

export function ScreenPreviewPopup() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // This effect handles the auto-closing of the window
    const removeListener = window.electronAPI.on('screenshare:state-changed', (isSharing) => {
      if (!isSharing) {
        console.log('[ScreenPreviewPopup] Screen sharing stopped, closing window.');
        window.electronAPI.send('popover:close', 'screen-preview');
      }
    });

    return () => removeListener();
  }, []);

  useEffect(() => {
    // This effect handles fetching the stream
    let attempts = 0;
    const maxAttempts = 10; // Poll for 5 seconds
    let intervalId: NodeJS.Timeout | null = null;

    const getSourceAndSetupStream = async () => {
      try {
        const sourceId = await window.electronAPI.invoke('electronAPI:getActiveScreenSourceId');
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
            setIsLoading(false);
          }
        }
      } catch (error) {
        console.error('[ScreenPreviewPopup] Error getting source or stream:', error);
        if (intervalId) clearInterval(intervalId);
        setIsLoading(false);
      }
    };

    const start = async () => {
      const isInitiallySharing = await window.electronAPI.invoke('get-screenshare-state');
      if (!isInitiallySharing) {
        console.log('[ScreenPreviewPopup] Not sharing initially, showing placeholder.');
        setIsLoading(false);
        return;
      }

      console.log('[ScreenPreviewPopup] Initially sharing, starting to poll for source ID.');
      getSourceAndSetupStream();
      intervalId = setInterval(getSourceAndSetupStream, 500);
    };

    start();

    return () => {
      if (intervalId) clearInterval(intervalId);
      if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
      }
    };
  }, []); // This effect should still only run once on mount

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
      videoRef.current.play().catch(e => console.error("[ScreenPreviewPopup] Video play error:", e));
    }
  }, [videoStream]);

  return (
    <div className="grid gap-4 bg-muted/10 rounded-2xl">
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
