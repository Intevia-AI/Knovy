import React, { useEffect, useRef } from "react";
import { MonitorIcon } from "lucide-react";

interface ScreenPreviewPopupProps {
  isScreenSharing: boolean;
  screenStreamRef: React.RefObject<MediaStream | null>;
}

export function ScreenPreviewPopup({ isScreenSharing, screenStreamRef }: ScreenPreviewPopupProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (isScreenSharing && videoRef.current && screenStreamRef.current) {
      videoRef.current.srcObject = screenStreamRef.current;
    }
  }, [isScreenSharing, screenStreamRef]);

  return (
    <div className="grid gap-4 p-4 bg-muted/10 rounded-2xl">
      <video ref={videoRef} autoPlay muted className="w-full rounded-md border bg-muted" />
    </div>
  );
}