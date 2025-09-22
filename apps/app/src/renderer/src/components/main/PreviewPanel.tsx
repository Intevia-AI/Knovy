import React, { useEffect, useRef, useState } from 'react'
import { MicIcon, MonitorIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'motion'
import { useI18n } from '@/hooks/useI18n'

export function PreviewPanel() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(true)
  const popoverId = 'screen-preview'
  const [audioLevels, setAudioLevels] = useState({ micLevel: 0, systemLevel: 0 })

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('audio:levels-updated', (levels) => {
      if (levels) {
        setAudioLevels(levels)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const unsubscribe = window.electronAPI.on('popover:prepare-to-close', (id) => {
      if (id === popoverId) {
        setIsOpen(false)
      }
    })
    return () => unsubscribe()
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
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
              videoRef.current.play().catch((e) => {
                if (e.name !== 'AbortError') {
                  console.error('[PreviewPanel] Video play error:', e)
                }
              })
            }
          } else {
            console.warn('[PreviewPanel] No active screen source ID received.')
          }
        } catch (error) {
          console.error('[PreviewPanel] Error setting up screen preview:', error)
        }
      }
    }

    // Initial stream setup
    getSourceAndSetupStream()

    const handleScreenShareStateChange = (isScreenSharing: boolean) => {
      if (!isScreenSharing) {
        setIsOpen(false)
      }
    }
    const unsubscribeStateChanged = window.electronAPI.on(
      'screenshare:state-changed',
      handleScreenShareStateChange
    )

    const handleSourceChanged = () => {
      console.log('[PreviewPanel] Source changed, re-fetching stream...')
      // Clean up old stream before getting new one
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream
        stream.getTracks().forEach((track) => track.stop())
      }
      getSourceAndSetupStream()
    }
    const unsubscribeSourceChanged = window.electronAPI.on(
      'screenshare:source-changed',
      handleSourceChanged
    )

    return () => {
      unsubscribeStateChanged()
      unsubscribeSourceChanged()
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
          className="glass-popover p-2 space-y-2 flex flex-col h-screen"
        >
          <div className="relative flex-grow w-full h-full bg-muted/30 rounded-lg overflow-hidden">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-full rounded-lg object-contain"
            />
            {!videoRef.current?.srcObject && (
              <div className="absolute inset-0 flex items-center justify-center">
                <MonitorIcon className="h-12 w-12 text-muted-foreground" />
              </div>
            )}
          </div>
          <div className="flex-none px-2">
            <div className="grid grid-cols-[auto_auto_1fr] items-center gap-x-2 gap-y-1.5">
              {/* Row 1: System Audio */}
              <MonitorIcon className="h-3 w-3 flex-shrink-0 text-blue-500" />
              <span className="text-[10px] font-medium text-black">{t('systemAudioLabel')}</span>
              <div className="h-[6px] overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-blue-500 transition-all duration-75"
                  style={{ width: `${audioLevels.systemLevel}%` }}
                />
              </div>

              {/* Row 2: Microphone Audio */}
              <MicIcon className="h-3 w-3 flex-shrink-0 text-green-500" />
              <span className="text-[10px] font-medium text-black">
                {t('microphoneAudioLabel')}
              </span>
              <div className="h-[6px] overflow-hidden rounded-full bg-black/10">
                <div
                  className="h-full rounded-full bg-green-500 transition-all duration-75"
                  style={{ width: `${audioLevels.micLevel}%` }}
                />
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
