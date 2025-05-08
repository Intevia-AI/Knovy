import React, { useEffect, useRef } from "react";
import { MonitorIcon, XIcon } from "lucide-react";
import AudioVisualizer from "@/components/AudioVisualizer";

interface ScreenPreviewWindowProps {
  isOpen: boolean;
  onClose: () => void;
  isScreenSharing: boolean;
  screenStreamRef: React.RefObject<MediaStream | null>;
  systemAnalyserNode: AnalyserNode | null;
  systemLevel: number;
}

export default function ScreenPreviewWindow({
  isOpen,
  onClose,
  isScreenSharing,
  screenStreamRef,
  systemAnalyserNode,
  systemLevel,
}: ScreenPreviewWindowProps) {
  const screenPreviewRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    console.log("[ScreenPreviewWindow] Effect triggered:", {
      isOpen,
      isScreenSharing,
      hasVideoTracks: screenStreamRef.current?.getVideoTracks().length,
      screenPreviewRef: screenPreviewRef.current,
    });

    if (
      isOpen &&
      isScreenSharing &&
      screenPreviewRef.current &&
      screenStreamRef.current?.getVideoTracks().length
    ) {
      console.log("[ScreenPreviewWindow] Setting up video preview...");
      const videoStream = new MediaStream(
        screenStreamRef.current.getVideoTracks(),
      );
      console.log("[ScreenPreviewWindow] Created video stream:", videoStream);
      
      screenPreviewRef.current.srcObject = videoStream;
      screenPreviewRef.current.muted = true;
      
      screenPreviewRef.current.onloadedmetadata = () => {
        console.log("[ScreenPreviewWindow] Video metadata loaded");
      };
      
      screenPreviewRef.current.onerror = (e) => {
        console.error("[ScreenPreviewWindow] Video error:", e);
      };
      
      screenPreviewRef.current.play()
        .then(() => console.log("[ScreenPreviewWindow] Video started playing"))
        .catch((e) => console.error("[ScreenPreviewWindow] Video play error:", e));
    } else if (!isScreenSharing && screenPreviewRef.current) {
      console.log("[ScreenPreviewWindow] Clearing video preview");
      screenPreviewRef.current.srcObject = null;
    }

    return () => {
      if (screenPreviewRef.current) {
        screenPreviewRef.current.srcObject = null;
      }
    };
  }, [isOpen, isScreenSharing, screenStreamRef]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="relative w-[800px] max-w-[90vw] aspect-video bg-background rounded-lg shadow-lg overflow-hidden">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-2 right-2 p-1 rounded-full bg-black/50 hover:bg-black/70 text-white z-10"
          aria-label="Close preview"
        >
          <XIcon className="h-4 w-4" />
        </button>

        {/* Screen preview */}
        <div className="relative w-full h-full bg-muted/30">
          {isScreenSharing ? (
            <video
              ref={screenPreviewRef}
              autoPlay
              muted
              playsInline
              className="h-full w-full object-contain"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MonitorIcon className="h-12 w-12 text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Audio visualizer */}
        <div className="absolute bottom-4 left-4 right-4 space-y-1.5">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                <span className="text-[10px] font-medium text-white">系統音訊</span>
              </div>
              {isScreenSharing && (
                <span className="text-[10px] font-medium text-blue-500">
                  {systemLevel.toFixed(0)}%
                </span>
              )}
            </div>
            <div className="w-full h-[6px] flex items-center bg-black/50 rounded-full overflow-hidden">
              {isScreenSharing && systemAnalyserNode ? (
                <AudioVisualizer 
                  analyserNode={systemAnalyserNode} 
                  height={6}
                  barColor="#3b82f6"
                  backgroundColor="transparent"
                />
              ) : (
                <div className="w-full h-full bg-muted/50 rounded-full" />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 