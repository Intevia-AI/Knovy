import { useEffect, useState } from 'react'
import { motion } from 'motion'
import { CheckCircle, AlertCircle, Loader2, X } from 'lucide-react'
import { getWhisperClient } from '../services/whisperClient'
import { Logo } from '@/components/Logo'
import { Button } from '@/components/ui/button'

interface LoadingPhase {
  name: string
  message: string
  weight: number // Progress weight (0-1, should sum to 1 across all phases)
  executor?: () => Promise<boolean> // Optional executor for the phase
}

interface LoadingPageProps {
  onComplete: (success: boolean) => void
  loadingMessage?: string
  phases?: LoadingPhase[] // Multi-phase loading support
}

interface DownloadProgress {
  modelName: string
  downloaded: number
  total: number
  percentage: number
}

export function LoadingPage({
  onComplete,
  loadingMessage = 'Loading the app...',
  phases
}: LoadingPageProps) {
  const [status, setStatus] = useState<'loading' | 'complete' | 'error'>('loading')
  const [progress, setProgress] = useState<number>(0)
  const [errorMessage, setErrorMessage] = useState<string>('')
  const [currentPhase, setCurrentPhase] = useState<number>(0)
  const [currentPhaseProgress, setCurrentPhaseProgress] = useState<number>(0)
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null)

  useEffect(() => {
    let mounted = true
    let progressInterval: NodeJS.Timeout | null = null
    let unsubscribe: (() => void) | null = null

    // Legacy single-phase model loading (fallback)
    const prepareModel = async () => {
      try {
        console.log('[LoadingPage] Starting model preparation...')

        // Get whisper client FIRST
        const whisperClient = getWhisperClient()

        // Subscribe to download progress events BEFORE starting download
        console.log('[LoadingPage] Subscribing to download progress events...')
        unsubscribe = whisperClient.onDownloadProgress((downloadProgress) => {
          if (!mounted) return

          console.log('[LoadingPage] Download progress update:', downloadProgress)
          setDownloadProgress(downloadProgress)
          setProgress(downloadProgress.percentage)
        })

        // Add a small delay to ensure subscription is fully registered
        await new Promise((resolve) => setTimeout(resolve, 50))
        console.log('[LoadingPage] Subscription registered, starting download...')

        try {
          // Do the actual work - this will trigger download progress events
          const success = await whisperClient.ensureModelAvailable()

          // Ensure progress reaches 100%
          if (mounted) {
            setProgress(100)
          }

          // Wait a moment to show 100%
          await new Promise((resolve) => setTimeout(resolve, 500))

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
              setErrorMessage(
                'Failed to prepare models. Please check your internet connection and try again.'
              )
              setTimeout(() => {
                if (mounted) {
                  onComplete(false)
                }
              }, 3000)
            }
          }
        } finally {
          // Clean up subscription
          if (unsubscribe) {
            unsubscribe()
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

    // Multi-phase loading
    const runPhases = async () => {
      if (!phases || phases.length === 0) {
        await prepareModel()
        return
      }

      try {
        console.log(`[LoadingPage] Starting multi-phase loading with ${phases.length} phases`)

        // Subscribe to download progress for all phases BEFORE starting
        const whisperClient = getWhisperClient()
        console.log('[LoadingPage] Subscribing to download progress for multi-phase loading...')
        unsubscribe = whisperClient.onDownloadProgress((downloadProgressUpdate) => {
          if (!mounted) return
          console.log('[LoadingPage] Multi-phase download progress update:', downloadProgressUpdate)
          setDownloadProgress(downloadProgressUpdate)

          // Update progress directly from download percentage (not weighted)
          // Each phase shows its own 0-100% progress
          setProgress(downloadProgressUpdate.percentage)
          setCurrentPhaseProgress(downloadProgressUpdate.percentage)
        })

        let totalProgress = 0

        for (let i = 0; i < phases.length; i++) {
          if (!mounted) return

          const phase = phases[i]
          setCurrentPhase(i)
          setCurrentPhaseProgress(0)

          console.log(`[LoadingPage] Starting phase ${i + 1}/${phases.length}: ${phase.name}`)

          // For model-check phase, use real download progress; for others, use animation
          const isModelPhase = phase.name === 'model-check'
          let phaseInterval: NodeJS.Timeout | null = null

          if (!isModelPhase) {
            // Animate phase progress for non-model phases (each phase is 0-100%)
            const phaseSteps = 100
            const stepDelay = 20
            let phaseProgress = 0

            phaseInterval = setInterval(() => {
              if (!mounted) return

              phaseProgress += 1
              setCurrentPhaseProgress(phaseProgress)
              setProgress(phaseProgress)

              if (phaseProgress >= 100) {
                clearInterval(phaseInterval!)
              }
            }, stepDelay)
          } else {
            // For model phase, progress is driven by download events
            console.log('[LoadingPage] Using real download progress for model phase')
          }

          // Execute phase if it has an executor
          let phaseSuccess = true
          if (phase.executor) {
            try {
              // For model phase, progress is updated via download callback
              // For other phases, progress is updated via interval above
              phaseSuccess = await phase.executor()
            } catch (error) {
              console.error(`[LoadingPage] Error in phase ${phase.name}:`, error)
              phaseSuccess = false
            }
          } else {
            // Default delay for phases without executors
            await new Promise((resolve) => setTimeout(resolve, 2000))
          }

          // Ensure phase progress completes
          if (phaseInterval) {
            clearInterval(phaseInterval)
          }
          if (mounted) {
            setCurrentPhaseProgress(100)
            setProgress(100)
          }

          if (!phaseSuccess) {
            setStatus('error')
            setErrorMessage(`Failed during ${phase.name}. Please try again.`)
            setTimeout(() => {
              if (mounted) {
                onComplete(false)
              }
            }, 3000)
            return
          }

          // Small delay between phases
          await new Promise((resolve) => setTimeout(resolve, 200))
        }

        // All phases completed successfully
        if (mounted) {
          setProgress(100)
          setStatus('complete')
          setTimeout(() => {
            if (mounted) {
              onComplete(true)
            }
          }, 800)
        }
      } catch (error) {
        console.error('[LoadingPage] Error during multi-phase loading:', error)
        if (mounted) {
          setStatus('error')
          setErrorMessage(error instanceof Error ? error.message : 'Initialization failed')
          setTimeout(() => {
            if (mounted) {
              onComplete(false)
            }
          }, 3000)
        }
      } finally {
        // Clean up subscription
        if (unsubscribe) {
          unsubscribe()
        }
      }
    }

    runPhases()

    return () => {
      mounted = false
      if (progressInterval) {
        clearInterval(progressInterval)
      }
      if (unsubscribe) {
        unsubscribe()
      }
    }
  }, [onComplete, phases])

  const formatBytes = (bytes: number): string => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round((bytes / Math.pow(1024, i)) * 100) / 100 + ' ' + sizes[i]
  }

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        // Don't show spinner during loading - progress bar will be shown instead
        return null
      case 'complete':
        return <CheckCircle className="h-8 w-8 text-green-500" />
      case 'error':
        return <AlertCircle className="h-8 w-8 text-red-500" />
    }
  }

  const getStatusMessage = () => {
    switch (status) {
      case 'loading':
        if (phases && phases.length > 0 && currentPhase < phases.length) {
          return phases[currentPhase].message
        }
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
        // Show download details if available (prioritize this over generic progress)
        if (downloadProgress) {
          return `Downloading model... ${Math.round(downloadProgress.percentage)}%`
        }
        // Show phase-specific progress
        if (progress > 0) {
          return `${Math.round(progress)}%`
        }
        // Initial state
        return 'This will only take a moment'
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

        {/* Progress Bar (always shown during loading) */}
        {status === 'loading' && (
          <div className="w-full max-w-xs">
            <div className="w-full bg-gray-200 rounded-full h-2 dark:bg-gray-700">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all duration-150 ease-linear"
                style={{ width: `${Math.max(1, progress)}%` }}
              />
            </div>
          </div>
        )}

        {/* Action buttons */}
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
