import React, { useEffect, useRef, useState } from 'react'
import { MonitorIcon } from 'lucide-react'

export function ScreenPreviewPopup() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)

  useEffect(() => {
    // This effect handles the auto-closing of the window
    const removeListener = window.electronAPI.on('screenshare:state-changed', (isScreenSharing) => {
      if (!isScreenSharing) {
        console.log('[ScreenPreviewPopup] Screen sharing stopped, closing window.')
        window.electronAPI.send('popover:close', 'screen-preview')
      }
    })

    return () => removeListener()
  }, [])

  useEffect(() => {
    // This effect handles fetching the stream
    const getSourceAndSetupStream = async () => {
      try {
        const sourceId = await window.electronAPI.invoke('electronAPI:getActiveScreenSourceId')
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
          setVideoStream(stream)
        }
      } catch (error) {
        console.error('[ScreenPreviewPopup] Error getting source or stream:', error)
      }
    }

    getSourceAndSetupStream()

    return () => {
      if (videoStream) {
        videoStream.getTracks().forEach((track) => track.stop())
      }
    }
  }, []) // This effect should still only run once on mount

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream
      videoRef.current
        .play()
        .catch((e) => console.error('[ScreenPreviewPopup] Video play error:', e))
    }
  }, [videoStream])

  return (
    <div className="glass-popover p-2">
      {videoStream ? (
        <video ref={videoRef} autoPlay muted className="w-full rounded-lg bg-muted" />
      ) : (
        <div className="w-full aspect-video rounded-md border bg-muted flex items-center justify-center">
          <MonitorIcon className="h-12 w-12 text-muted-foreground" />
        </div>
      )}
    </div>
  )
}
