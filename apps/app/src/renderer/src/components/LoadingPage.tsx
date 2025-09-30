import { useEffect, useState } from 'react'
import { motion } from 'motion'
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { getWhisperClient } from '../services/whisperClient'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

interface LoadingPageProps {
  onComplete: (success: boolean) => void
  loadingMessage?: string
}

interface DownloadProgress {
  modelName: string
  downloaded: number
  total: number
  percentage: number
}

export function LoadingPage({
  onComplete,
  loadingMessage = 'Loading the app...'
}: LoadingPageProps) {
  const [status, setStatus] = useState<'loading' | 'complete' | 'error'>('loading')
  const [progress, setProgress] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    let mounted = true
    let progressInterval: NodeJS.Timeout | null = null

    const prepareModel = async () => {
      try {
        console.log('[LoadingPage] Starting model preparation...')

        // Start smooth progress animation
        let currentProgress = 0
        progressInterval = setInterval(() => {
          if (!mounted) return

          currentProgress += 1
          setProgress(currentProgress)

          // Complete at 100%
          if (currentProgress >= 100) {
            if (progressInterval) {
              clearInterval(progressInterval)
              progressInterval = null
            }
          }
        }, 30) // 3 seconds total (100 steps * 30ms)

        // Do the actual work while progress animates
        const whisperClient = getWhisperClient()
        const success = await whisperClient.ensureModelAvailable()

        // Ensure progress reaches 100%
        if (mounted && currentProgress < 100) {
          setProgress(100)
        }

        // Wait a moment to show 100%
        await new Promise(resolve => setTimeout(resolve, 500))

        if (mounted) {
          if (success) {
            console.log('[LoadingPage] Model preparation completed successfully')
            setStatus('complete')
            setTimeout(() => {
              if (mounted) {
                onComplete(true)
              }
            }, 800)
          } else {
            setStatus('error')
            setErrorMessage('Failed to prepare transcription models. Please check your internet connection and try again.')
            setTimeout(() => {
              if (mounted) {
                onComplete(false)
              }
            }, 3000)
          }
        }
      } catch (error) {
        console.error('[LoadingPage] Error during model preparation:', error)
        if (mounted) {
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : 'Unknown error occurred')
          setTimeout(() => {
            if (mounted) {
              onComplete(false)
            }
          }, 3000)
        }
      }
    }

    prepareModel()

    return () => {
      mounted = false
      if (progressInterval) {
        clearInterval(progressInterval)
      }
    }
  }, [onComplete])

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return progress > 0 ? null : <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      case 'complete':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        return loadingMessage
      case 'complete':
        return 'Ready!'
      case 'error':
        return 'Setup failed'
    }
  }

  const getDetailMessage = () => {
    switch (status) {
      case 'loading':
        return progress > 0 ? `${progress}% complete` : 'This will only take a moment'
      case 'complete':
        return 'All set!'
      case 'error':
        return errorMessage
    }
  }

  const handleSkip = () => {
    console.log('[LoadingPage] User chose to skip setup')
    onComplete(false) // Continue without models
  }

  return (
    <div
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
      className="flex flex-col items-center justify-center h-screen text-foreground select-none bg-transparent overflow-hidden rounded-lg glass-popover"
    >
      {/* Skip button for error states */}
      {status === 'error' && (
        <button
          onClick={handleSkip}
          style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
          className="absolute top-2 right-2 z-10 p-1 rounded-full text-muted-foreground/50 hover:text-foreground hover:bg-muted-foreground/10 transition-colors"
          aria-label="Skip setup"
        >
          <X size={16} />
        </button>
      )}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="flex flex-col items-center justify-center text-center p-8"
      >
        <Logo className="h-12 w-12 mx-auto mb-4" />

        {/* Status Icon (only when not downloading) */}
        {getStatusIcon() && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            className="mb-2"
          >
            {getStatusIcon()}
          </motion.div>
        )}

        {/* Main Status */}
        <h1 className="text-2xl font-bold mb-2">{getStatusMessage()}</h1>
        <p className="text-muted-foreground mb-6">{getDetailMessage()}</p>

        {/* Progress Bar (positioned like button in LoginPage) */}
        {status === 'loading' && progress > 0 && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-xs"
          >
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <motion.div
                className="bg-blue-500 h-2 rounded-full transition-all duration-100 ease-out"
                style={{ width: `${progress}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
              />
            </div>
          </motion.div>
        )}

        {/* Action buttons (positioned like button in LoginPage) */}
        {status === 'error' && (
          <div className="space-y-2 w-full max-w-xs">
            <Button
              onClick={() => window.location.reload()}
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="w-full rounded-full"
            >
              Try Again
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
              className="w-full rounded-full"
            >
              Continue Without Offline Mode
            </Button>
          </div>
        )}
      </motion.div>
    </div>
  )
}
