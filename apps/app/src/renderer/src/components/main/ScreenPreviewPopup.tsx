import React, { useEffect, useRef } from "react";
import { MonitorIcon } from "lucide-react";

interface ScreenPreviewPopupProps {
  isScreenSharing: boolean;
  videoStream: MediaStream | null;
}

export function ScreenPreviewPopup({ isScreenSharing, videoStream }: ScreenPreviewPopupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream;
    } else if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, [videoStream]);

  return (
    <div className="grid gap-4 p-4 bg-muted/10 rounded-2xl">
      {isScreenSharing && videoStream ? (
        <video ref={videoRef} autoPlay muted className="w-full rounded-md border bg-muted" />
      ) : (
        <div className="w-full aspect-video rounded-md border bg-muted flex items-center justify-center">
          <MonitorIcon className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
