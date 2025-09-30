/**
 * Whisper client for renderer process
 * Provides interface to whisper.cpp-based transcription service
 */

export interface WhisperOptions {
  language?: string
  modelSize?: 'tiny' | 'base' | 'small' | 'medium'
  sourceType: 'microphone' | 'system'
  enableNoiseFiltering?: boolean
  energyThreshold?: number
  minSpeechConfidence?: number
}

export interface WhisperResult {
  text: string
  confidence?: number
  language?: string
  sourceType: 'microphone' | 'system'
  processingTime: number
}

export interface ModelInfo {
  name: string
  size: string
  downloaded: boolean
  path?: string
  recommended?: boolean
  description?: string
}

export interface ModelDownloadProgress {
  modelName: string
  downloaded: number
  total: number
  percentage: number
  speed?: number
}

export interface StorageUsage {
  totalBytes: number
  models: Array<{ name: string; sizeBytes: number }>
}

/**
 * Whisper client for communicating with whisper.cpp service
 */
export class WhisperClient {
  private isInitialized = false
  private initializationPromise: Promise<boolean> | null = null
  private downloadProgressCallbacks = new Set<(progress: ModelDownloadProgress) => void>()
  private downloadCompleteCallbacks = new Set<(modelName: string, success: boolean) => void>()

  constructor() {
    this.setupEventListeners()
  }

  /**
   * Initialize the whisper service
   */
  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true
    }

    if (this.initializationPromise) {
      return this.initializationPromise
    }

    this.initializationPromise = this.performInitialization()
    const result = await this.initializationPromise
    this.initializationPromise = null

    return result
  }

  /**
   * Process audio data using whisper.cpp
   */
  async transcribeAudio(
    audioBuffer: ArrayBuffer,
    options: WhisperOptions
  ): Promise<WhisperResult> {
    if (!this.isInitialized) {
      throw new Error('WhisperClient not initialized. Call initialize() first.')
    }

    try {
      console.log(`[WhisperClient] Processing audio:`, {
        bufferSize: audioBuffer.byteLength,
        sourceType: options.sourceType,
        modelSize: options.modelSize || 'tiny'
      })

      // Quick availability check before attempting transcription
      const isCurrentlyAvailable = await this.isAvailable()
      if (!isCurrentlyAvailable) {
        throw new Error('No whisper models available. Models may have been deleted.')
      }

      const response = await (window as any).electronAPI.transcriptionProcessAudio(audioBuffer, options)

      if (!response.success) {
        // Provide more specific error messages based on the error type
        const error = response.error || 'Whisper transcription failed'

        if (error.includes('No whisper models available')) {
          throw new Error('No whisper models available. Please restart the app to re-download models.')
        } else if (error.includes('whisper.cpp binary')) {
          throw new Error('whisper.cpp binary error. Whisper transcription is temporarily unavailable.')
        } else if (error.includes('timeout')) {
          throw new Error('Transcription timeout. The audio segment may be too long or corrupted.')
        } else {
          throw new Error(error)
        }
      }

      console.log(`[WhisperClient] Transcription completed:`, {
        text: `"${response.result.text}"`,
        processingTime: `${response.result.processingTime}ms`,
        sourceType: response.result.sourceType
      })

      return response.result
    } catch (error) {
      console.error('[WhisperClient] Transcription error:', error)

      // Re-throw with additional context if needed
      if (error instanceof Error) {
        // Add context about the source type for debugging
        const contextualError = new Error(`${error.message} (Source: ${options.sourceType})`)
        contextualError.stack = error.stack
        throw contextualError
      }

      throw error
    }
  }

  /**
   * Get list of available Whisper models
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    try {
      const response = await (window as any).electronAPI.transcriptionGetModels()

      if (!response.success) {
        throw new Error(response.error || 'Failed to get models')
      }

      return response.models
    } catch (error) {
      console.error('[WhisperClient] Failed to get models:', error)
      throw error
    }
  }

  /**
   * Download a specific model
   */
  async downloadModel(modelName: string): Promise<boolean> {
    try {
      console.log(`[WhisperClient] Starting download for model: ${modelName}`)

      const response = await (window as any).electronAPI.transcriptionDownloadModel(modelName)
      return response.success
    } catch (error) {
      console.error(`[WhisperClient] Failed to download model ${modelName}:`, error)
      throw error
    }
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(modelName: string): Promise<boolean> {
    try {
      console.log(`[WhisperClient] Deleting model: ${modelName}`)

      const response = await (window as any).electronAPI.transcriptionDeleteModel(modelName)
      return response.success
    } catch (error) {
      console.error(`[WhisperClient] Failed to delete model ${modelName}:`, error)
      throw error
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage(): Promise<StorageUsage> {
    try {
      const response = await (window as any).electronAPI.transcriptionGetStorageUsage()

      if (!response.success) {
        throw new Error(response.error || 'Failed to get storage usage')
      }

      return response.usage
    } catch (error) {
      console.error('[WhisperClient] Failed to get storage usage:', error)
      throw error
    }
  }

  /**
   * Check if local transcription is available and ready
   */
  async isAvailable(): Promise<boolean> {
    try {
      // Check if at least one model is downloaded
      const models = await this.getAvailableModels()
      const hasModels = models.some(model => model.downloaded)

      if (!hasModels) {
        console.warn('[WhisperClient] No models available for transcription')
      }

      return hasModels
    } catch (error) {
      console.error('[WhisperClient] Error checking availability:', error)
      return false
    }
  }

  /**
   * Get recommended model for first-time setup
   */
  async getRecommendedModel(): Promise<ModelInfo | null> {
    try {
      const models = await this.getAvailableModels()
      return models.find(model => model.recommended) || models[0] || null
    } catch {
      return null
    }
  }

  /**
   * Ensure at least one model is available, downloading if necessary
   */
  async ensureModelAvailable(): Promise<boolean> {
    try {
      console.log('[WhisperClient] Ensuring model availability...')

      // Add a small delay to ensure any progress callbacks are set up
      await new Promise(resolve => setTimeout(resolve, 100))

      const response = await (window as any).electronAPI.transcriptionEnsureModelAvailable()
      return response.success
    } catch (error) {
      console.error('[WhisperClient] Failed to ensure model availability:', error)
      return false
    }
  }

  /**
   * Add callback for download progress updates
   */
  onDownloadProgress(callback: (progress: ModelDownloadProgress) => void): () => void {
    this.downloadProgressCallbacks.add(callback)
    return () => this.downloadProgressCallbacks.delete(callback)
  }

  /**
   * Add callback for download completion
   */
  onDownloadComplete(callback: (modelName: string, success: boolean) => void): () => void {
    this.downloadCompleteCallbacks.add(callback)
    return () => this.downloadCompleteCallbacks.delete(callback)
  }

  /**
   * Format bytes to human readable string
   */
  static formatBytes(bytes: number): string {
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    if (bytes === 0) return '0 Bytes'

    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  /**
   * Format processing time to human readable string
   */
  static formatProcessingTime(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`
    } else {
      return `${(ms / 1000).toFixed(1)}s`
    }
  }

  // Private methods

  private async performInitialization(): Promise<boolean> {
    try {
      console.log('[WhisperClient] Initializing local transcription service...')

      // Check if electronAPI is available
      if (!window.electronAPI) {
        console.error('[WhisperClient] electronAPI not available')
        return false
      }

      if (!window.electronAPI.transcriptionInitialize) {
        console.error('[WhisperClient] transcriptionInitialize method not available')
        return false
      }

      console.log('[WhisperClient] Calling transcriptionInitialize...')
      const response = await (window as any).electronAPI.transcriptionInitialize()

      console.log('[WhisperClient] Raw response:', response)

      if (!response) {
        console.error('[WhisperClient] Initialization failed: response is undefined')
        return false
      }

      if (response.success) {
        this.isInitialized = true
        console.log('[WhisperClient] Successfully initialized')
        return true
      } else {
        console.error('[WhisperClient] Initialization failed:', response.error)

        // Get diagnostic information for debugging
        try {
          const diagnosticsResponse = await (window as any).electronAPI.transcriptionGetDiagnostics()
          if (diagnosticsResponse.success) {
            console.error('[WhisperClient] Diagnostics:', diagnosticsResponse.diagnostics)
          }
        } catch (diagError) {
          console.error('[WhisperClient] Failed to get diagnostics:', diagError)
        }

        return false
      }
    } catch (error) {
      console.error('[WhisperClient] Initialization error:', error)
      return false
    }
  }

  private setupEventListeners(): void {
    // Listen for download progress events (from ensureModelAvailable)
    const unsubscribeModelProgress = (window as any).electronAPI?.on('transcription:model-download-progress',
      ({ modelName, progress }: { modelName: string; progress: { downloaded: number; total: number; percentage: number } }) => {
        console.log('[WhisperClient] Received model download progress:', { modelName, progress, callbackCount: this.downloadProgressCallbacks.size })

        this.downloadProgressCallbacks.forEach(callback => {
          try {
            callback({
              modelName,
              downloaded: progress.downloaded,
              total: progress.total,
              percentage: progress.percentage
            })
          } catch (error) {
            console.error('[WhisperClient] Error in model download progress callback:', error)
          }
        })
      }
    )

    // Listen for download progress events (general)
    const unsubscribeProgress = (window as any).electronAPI?.on('model:download-progress',
      (progress: ModelDownloadProgress) => {
        this.downloadProgressCallbacks.forEach(callback => {
          try {
            callback(progress)
          } catch (error) {
            console.error('[WhisperClient] Error in download progress callback:', error)
          }
        })
      }
    )

    // Listen for download complete events
    const unsubscribeComplete = (window as any).electronAPI?.on('model:download-complete',
      ({ modelName, success }: { modelName: string; success: boolean }) => {
        this.downloadCompleteCallbacks.forEach(callback => {
          try {
            callback(modelName, success)
          } catch (error) {
            console.error('[WhisperClient] Error in download complete callback:', error)
          }
        })
      }
    )

    // Store cleanup functions for potential future use
    if (unsubscribeModelProgress && unsubscribeProgress && unsubscribeComplete) {
      console.log('[WhisperClient] Event listeners setup completed')
    }
  }
}

// Singleton instance
let whisperClient: WhisperClient | null = null

export function getWhisperClient(): WhisperClient {
  if (!whisperClient) {
    whisperClient = new WhisperClient()
  }
  return whisperClient
}

// Export utility functions
export const WhisperUtils = {
  formatBytes: WhisperClient.formatBytes,
  formatProcessingTime: WhisperClient.formatProcessingTime
}