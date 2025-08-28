import React, { useEffect, useRef } from 'react'
import { MonitorIcon, XIcon } from 'lucide-react'
import AudioVisualizer from '@/components/AudioVisualizer'
import { useI18n } from '@/hooks/useI18n'

interface ScreenPreviewWindowProps {
  isOpen: boolean
  onClose: () => void
  isScreenSharing: boolean
  screenStreamRef: React.RefObject<MediaStream | null>
  systemAnalyserNode: AnalyserNode | null
  systemLevel: number
}

export default function ScreenPreviewWindow({
  isOpen,
  onClose,
  isScreenSharing,
  screenStreamRef,
  systemAnalyserNode,
  systemLevel
}: ScreenPreviewWindowProps) {
  const screenPreviewRef = useRef<HTMLVideoElement>(null)
  const { t } = useI18n()

  useEffect(() => {
    const setupStream = async () => {
      if (isOpen && isScreenSharing && screenPreviewRef.current) {
        console.log('[ScreenPreviewWindow] Attempting to get screen source ID.')
        try {
          const sourceId = await window.electronAPI.invoke('electronAPI:getActiveScreenSourceId')
          console.log(`[ScreenPreviewWindow] Received source ID: ${sourceId}`)

          if (sourceId) {
            const stream = await navigator.mediaDevices.getUserMedia({
              audio: false,
              video: {
                mandatory: {
                  chromeMediaSource: 'desktop',
                  chromeMediaSourceId: sourceId
                }
              }
            })

            if (screenPreviewRef.current) {
              screenPreviewRef.current.srcObject = stream
              screenPreviewRef.current.onloadedmetadata = () => {
                screenPreviewRef.current
                  ?.play()
                  .catch((e) => console.error('[ScreenPreviewWindow] Video play error:', e))
              }
              screenPreviewRef.current.onerror = (e) => {
                console.error('[ScreenPreviewWindow] Video error:', e)
              }
            }
          } else {
            console.warn('[ScreenPreviewWindow] No active screen source ID received.')
            if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null
          }
        } catch (error) {
          console.error('[ScreenPreviewWindow] Error setting up screen preview:', error)
          if (screenPreviewRef.current) screenPreviewRef.current.srcObject = null
        }
      } else if (screenPreviewRef.current) {
        console.log('[ScreenPreviewWindow] Clearing video preview.')
        screenPreviewRef.current.srcObject = null
      }
    }

    setupStream()

    return () => {
      if (screenPreviewRef.current && screenPreviewRef.current.srcObject) {
        const stream = screenPreviewRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
        screenPreviewRef.current.srcObject = null
      }
    }
  }, [isOpen, isScreenSharing])

  if (!isOpen) return null

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
                <span className="text-[10px] font-medium text-white">{t('systemAudioLabel')}</span>
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
  )
}
