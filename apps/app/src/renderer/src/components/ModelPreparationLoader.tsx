import { useEffect, useState } from 'react'
import { motion } from 'motion'
import { Download, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { getLocalTranscriptionClient } from '../services/localTranscriptionClient'

interface ModelPreparationLoaderProps {
  onComplete: (success: boolean) => void
}

interface DownloadProgress {
  modelName: string
  downloaded: number
  total: number
  percentage: number
}

export function ModelPreparationLoader({ onComplete }: ModelPreparationLoaderProps) {
  const [status, setStatus] = useState<'checking' | 'downloading' | 'complete' | 'error'>('checking')
  const [progress, setProgress] = useState<DownloadProgress | null>(null)
  const [errorMessage, setErrorMessage] = useState<string>('')

  useEffect(() => {
    let mounted = true
    let progressCleanup: (() => void) | null = null

    const prepareModel = async () => {
      try {
        console.log('[ModelPreparationLoader] Starting model preparation...')

        const localClient = getLocalTranscriptionClient()

        // Set up progress tracking
        progressCleanup = localClient.onDownloadProgress((downloadProgress) => {
          if (mounted) {
            setProgress(downloadProgress)
            setStatus('downloading')
          }
        })

        // Check if models are available or download if needed
        const success = await localClient.ensureModelAvailable()

        if (mounted) {
          if (success) {
            setStatus('complete')
            setTimeout(() => {
              if (mounted) {
                onComplete(true)
              }
            }, 1000) // Brief delay to show success state
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
        console.error('[ModelPreparationLoader] Error during model preparation:', error)
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
      if (progressCleanup) {
        progressCleanup()
      }
    }
  }, [onComplete])

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      case 'downloading':
        return <Download className="h-8 w-8 text-blue-500" />
      case 'complete':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'checking':
        return 'Checking transcription models...'
      case 'downloading':
        return `Downloading ${progress?.modelName || 'model'}...`
      case 'complete':
        return 'Models ready!'
      case 'error':
        return 'Setup failed'
    }
  }

  const getDetailMessage = () => {
    switch (status) {
      case 'checking':
        return 'This will only take a moment'
      case 'downloading':
        if (progress) {
          return `${formatBytes(progress.downloaded)} / ${formatBytes(progress.total)} (${progress.percentage}%)`
        }
        return 'Preparing offline transcription...'
      case 'complete':
        return 'Knovy is ready for offline transcription'
      case 'error':
        return errorMessage
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center h-screen p-6"
    >
      <div className="flex flex-col items-center space-y-6 max-w-md text-center">
        {/* Icon */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
        >
          {getStatusIcon()}
        </motion.div>

        {/* Main Status */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <h2 className="text-xl font-semibold text-foreground mb-2">
            {getStatusMessage()}
          </h2>
          <p className="text-sm text-muted-foreground">
            {getDetailMessage()}
          </p>
        </motion.div>

        {/* Progress Bar */}
        {status === 'downloading' && progress && (
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.3 }}
            className="w-full max-w-xs"
          >
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <motion.div
                className="bg-blue-500 h-2 rounded-full transition-all duration-300 ease-out"
                style={{ width: `${progress.percentage}%` }}
                initial={{ width: 0 }}
                animate={{ width: `${progress.percentage}%` }}
              />
            </div>
          </motion.div>
        )}

        {/* Additional Info */}
        {status === 'downloading' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xs text-muted-foreground space-y-1"
          >
            <p>Setting up offline transcription for the first time</p>
            <p>This enables Knovy to work without an internet connection</p>
          </motion.div>
        )}

        {status === 'error' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xs text-muted-foreground text-center"
          >
            <p>Don't worry, you can try again later or use online transcription</p>
          </motion.div>
        )}
      </div>
    </motion.div>
  )
}