import React, { useEffect, useRef, useState } from 'react'
import { MonitorIcon } from 'lucide-react'
import AudioVisualizer from '@/components/AudioVisualizer'
import { useI18n } from '@/hooks/useI18n'
import { motion, AnimatePresence } from 'motion'

interface ScreenPreviewProps {
  systemAnalyserNode: AnalyserNode | null
}

export function ScreenPreview({ systemAnalyserNode }: ScreenPreviewProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(true)
  const popoverId = 'screen-preview'

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('popover:prepare-to-close', (id) => {
      if (id === popoverId) {
        setIsOpen(false)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const getSourceAndSetupStream = async () => {
      if (window.electronAPI) {
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
            if (videoRef.current) {
              videoRef.current.srcObject = stream
              videoRef.current
                .play()
                .catch((e) => console.error('[ScreenPreview] Video play error:', e))
            }
          } else {
            console.warn('[ScreenPreview] No active screen source ID received.')
          }
        } catch (error) {
          console.error('[ScreenPreview] Error setting up screen preview:', error)
        }
      }
    }

    getSourceAndSetupStream()

    const handleScreenShareStateChange = (isScreenSharing: boolean) => {
      if (!isScreenSharing) {
        setIsOpen(false)
      }
    }

    const unsubscribe = window.electronAPI.on(
      'screenshare:state-changed',
      handleScreenShareStateChange
    )

    return () => {
      unsubscribe()
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
    }
  }, [])

  const handleAnimationComplete = () => {
    if (!isOpen) {
      window.electronAPI.send('popover:ready-to-close', popoverId)
    }
  }

  return (
    <AnimatePresence onExitComplete={handleAnimationComplete}>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.2 }}
          className="glass-popover p-2 flex flex-col h-screen"
        >
          <div className="relative flex-grow w-full h-full bg-muted/30 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full object-contain bg-muted"
            />
            {!videoRef.current?.srcObject && (
              <div className="absolute inset-0 flex items-center justify-center">
                <MonitorIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-none pt-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
              <span className="text-[10px] font-medium text-black">{t('systemAudioLabel')}</span>
            </div>
            <div className="w-full h-[6px] flex items-center bg-black/20 rounded-full overflow-hidden">
              {systemAnalyserNode ? (
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
        </motion.div>
      )}
    </AnimatePresence>
  )
}
