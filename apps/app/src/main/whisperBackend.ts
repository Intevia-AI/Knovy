import { spawn, ChildProcess } from 'child_process'
import path from 'path'
import fs from 'fs/promises'
import { app } from 'electron'
import { randomUUID } from 'crypto'
import {
  getTranscriptionEnhancementService,
  TranscriptionEnhancementService,
  type TranscriptionSegment
} from './transcriptionEnhancementService'
import { Converter, ConverterFactory, Locale } from 'opencc-js'

// Configuration: Change this to set the default model size
// Options: 'tiny' (75MB, fastest), 'base' (142MB, better), 'small' (488MB, good+), 'medium' (1.5GB, best)
const DEFAULT_MODEL_SIZE: 'tiny' | 'base' | 'small' | 'medium' = 'small'

// Domain-specific prompts for better transcription context
const DOMAIN_PROMPTS = {
  technical: 'Technical discussion about software development, programming, and technology.',
  meeting: 'Business meeting with multiple speakers discussing projects and decisions.',
  casual: 'Casual conversation with natural speech patterns.',
  default: 'Clear conversation with proper punctuation and grammar.'
}

export interface TranscriptionOptions {
  language?: string
  modelSize?: 'tiny' | 'base' | 'small' | 'medium'
  sourceType: 'microphone' | 'system'
  enableNoiseFiltering?: boolean
  energyThreshold?: number
  minSpeechConfidence?: number
  autoDetectLanguage?: boolean // Enable automatic language detection (default: true)
  userLanguage?: string // User's preferred language (from session profile)
  enableTwoStageDetection?: boolean // Enable two-stage detection for better quality (default: true for zh-TW users)
  // VAD (Voice Activity Detection) options
  enableVAD?: boolean // Enable VAD to filter out non-speech audio (default: true)
  vadThreshold?: number // VAD threshold 0.0-1.0 (default: 0.60, higher = more selective)
  vadMinSpeechDuration?: number // Minimum speech duration in ms (default: 250)
  vadMinSilenceDuration?: number // Minimum silence duration in ms (default: 100)
  vadSpeechPadding?: number // Speech padding in ms (default: 30)
}

export interface TranscriptionResult {
  text: string
  confidence?: number
  language?: string
  sourceType: 'microphone' | 'system'
  processingTime: number
  detectedLanguage?: string // Language detected in Stage 1 (if two-stage detection used)
  whisperLanguage?: string // Language used for Stage 2 transcription
  usedTwoStageDetection?: boolean // Whether two-stage detection was used
}

export interface ModelInfo {
  name: string
  size: string
  downloaded: boolean
  path?: string
}

/**
 * Whisper backend service using whisper.cpp
 * Handles audio processing, model management, and binary execution
 */
export class WhisperBackend {
  private whisperBinaryPath: string
  private modelsPath: string
  private tempPath: string
  private isInitialized = false
  private activeProcesses = new Map<string, ChildProcess>()
  private downloadPromises = new Map<string, Promise<boolean>>()

  // Context preservation system
  private segmentContext = new Map<string, string>() // sessionId -> last sentence
  private sessionHistory = new Map<string, string[]>() // sessionId -> conversation history

  // Enhancement service
  private enhancementService: TranscriptionEnhancementService | null = null

  // VAD (Voice Activity Detection) model path
  private vadModelPath: string | null = null

  // OpenCC converter for Simplified to Traditional Chinese (Taiwan)
  private chineseConverter: Converter | null = null

  constructor() {
    // Platform-specific binary paths
    const platform = process.platform
    const arch = process.arch

    let binaryName = 'whisper'
    if (platform === 'win32') {
      binaryName = 'whisper.exe'
    }

    // For development, use resources path; for production, resources are unpacked to app.asar.unpacked
    const isDev = !app.isPackaged
    const resourcesPath = isDev
      ? path.join(__dirname, '../../resources')
      : path.join(process.resourcesPath, 'app.asar.unpacked', 'resources')

    this.whisperBinaryPath = path.join(
      resourcesPath,
      'whisper.cpp',
      `${binaryName}-${platform}-${arch}`
    )
    this.modelsPath = path.join(app.getPath('userData'), 'whisper-models')
    this.tempPath = path.join(app.getPath('temp'), 'knovy-transcription')

    console.log('[WhisperService] Initialized with paths:', {
      binary: this.whisperBinaryPath,
      models: this.modelsPath,
      temp: this.tempPath
    })

    console.log(`[WhisperService] 🎵 WAV files will be saved to: ${this.tempPath}`)

    // Initialize OpenCC converter for Simplified to Traditional Chinese (Taiwan)
    try {
      this.chineseConverter = ConverterFactory(Locale.from.cn, Locale.to.tw)
      console.log('[WhisperService] OpenCC converter initialized (CN → TW)')
    } catch (error) {
      console.error('[WhisperService] Failed to initialize OpenCC converter:', error)
    }
  }

  /**
   * Set up transcription enhancement service
   */
  setupEnhancementService(supabaseUrl: string, supabaseAnonKey: string, userToken?: string): void {
    try {
      this.enhancementService = getTranscriptionEnhancementService(supabaseUrl, supabaseAnonKey)

      if (userToken) {
        this.enhancementService.setUserToken(userToken)
      }

      console.log('[WhisperService] Transcription enhancement service initialized')
    } catch (error) {
      console.error('[WhisperService] Failed to initialize enhancement service:', error)
    }
  }

  /**
   * Update user token for enhancement service
   */
  setEnhancementUserToken(token: string): void {
    if (this.enhancementService) {
      this.enhancementService.setUserToken(token)
    }
  }

  /**
   * Get the enhancement service for event subscription
   */
  getEnhancementService(): TranscriptionEnhancementService | null {
    return this.enhancementService
  }

  /**
   * Trigger transcription enhancement for a completed transcription
   */
  private triggerTranscriptionEnhancement(
    sessionId: string,
    rawText: string,
    options: TranscriptionOptions,
    timestamp: number
  ): void {
    if (!this.enhancementService) {
      return
    }

    try {
      // Create transcription segment
      const segment: TranscriptionSegment = {
        id: randomUUID(),
        rawText,
        timestamp,
        sourceType: options.sourceType
      }

      // Get conversation history for context
      const conversationHistory = this.sessionHistory.get(sessionId) || []

      // Create session context
      const sessionContext = {
        sessionId,
        conversationHistory: conversationHistory.slice(-10), // Last 10 segments for context
        userLanguage: options.userLanguage || options.language || 'en' // Prefer userLanguage over detected language
      }

      // Trigger enhancement (async, non-blocking) with small delay to ensure DB save completes
      setTimeout(() => {
        this.enhancementService.enhanceSegment(segment, sessionContext, false)
        console.log(
          `[WhisperService] Triggered enhancement for segment ${segment.id} in session ${sessionId}`
        )
      }, 100) // 100ms delay to allow transcript to be saved to database first
    } catch (error) {
      console.error('[WhisperService] Error triggering enhancement:', error)
    }
  }

  /**
   * Initialize the transcription service
   * Creates necessary directories and validates binary
   */
  async initialize(): Promise<boolean> {
    try {
      console.log('[WhisperService] Initializing service...')

      console.log('[WhisperService] Step 1: Creating directories...')
      // Create necessary directories
      await this.ensureDirectories()
      console.log('[WhisperService] Directories created successfully')

      console.log('[WhisperService] Step 2: Validating binary...')
      // Validate whisper.cpp binary
      const binaryExists = await this.validateBinary()
      if (!binaryExists) {
        console.error('[WhisperService] whisper.cpp binary validation failed')
        return false
      }
      console.log('[WhisperService] Binary validation passed')

      console.log('[WhisperService] Step 3: Ensuring default model...')
      // Ensure default model is available
      await this.ensureDefaultModel()
      console.log('[WhisperService] Default model ensured')

      console.log('[WhisperService] Step 4: Downloading VAD model...')
      // Download VAD model for noise filtering
      await this.downloadVADModel()
      console.log('[WhisperService] VAD model ready')

      this.isInitialized = true
      console.log('[WhisperService] Service initialized successfully')
      return true
    } catch (error) {
      console.error('[WhisperService] Failed to initialize service:', error)
      return false
    }
  }

  /**
   * Process audio data and return transcription
   */
  async transcribeAudio(
    audioBuffer: ArrayBuffer,
    options: TranscriptionOptions,
    sessionId?: string,
    timestamp?: number
  ): Promise<TranscriptionResult> {
    if (!this.isInitialized) {
      throw new Error('WhisperBackend not initialized')
    }

    const startTime = Date.now()
    const transcriptionSessionId = sessionId || randomUUID()

    try {
      console.log(`[WhisperService] Starting transcription ${transcriptionSessionId}`, {
        bufferSize: audioBuffer.byteLength,
        durationSeconds: (audioBuffer.byteLength / 2 / 16000).toFixed(2), // 16-bit samples at 16kHz
        sourceType: options.sourceType,
        modelSize: options.modelSize || 'tiny',
        noiseFilteringEnabled: options.enableNoiseFiltering !== false
      })

      // Pre-process audio for noise filtering (enabled by default)
      if (options.enableNoiseFiltering !== false) {
        const audioMetrics = this.analyzeAudioEnergy(audioBuffer)
        const energyThreshold =
          options.energyThreshold || (options.sourceType === 'microphone' ? 0.01 : 0.005)

        console.log(`[WhisperService] Audio analysis for ${sessionId}:`, {
          averageEnergy: audioMetrics.averageEnergy.toFixed(6),
          maxEnergy: audioMetrics.maxEnergy.toFixed(6),
          energyThreshold: energyThreshold.toFixed(6),
          silentFrameRatio:
            ((audioMetrics.silentFrames / audioMetrics.totalFrames) * 100).toFixed(1) + '%',
          passesEnergyCheck: audioMetrics.averageEnergy > energyThreshold
        })

        // Skip transcription if audio is too quiet (likely just noise)
        if (audioMetrics.averageEnergy < energyThreshold) {
          console.log(
            `[WhisperService] Skipping transcription ${sessionId} - audio energy too low (${audioMetrics.averageEnergy.toFixed(6)} < ${energyThreshold.toFixed(6)})`
          )
          return {
            text: '',
            sourceType: options.sourceType,
            processingTime: Date.now() - startTime,
            language: options.language,
            confidence: 0
          }
        }

        // Additional check for mostly silent audio
        const silentRatio = audioMetrics.silentFrames / audioMetrics.totalFrames
        if (silentRatio > 0.85) {
          // If more than 85% of frames are silent
          console.log(
            `[WhisperService] Skipping transcription ${sessionId} - audio mostly silent (${(silentRatio * 100).toFixed(1)}% silent frames)`
          )
          return {
            text: '',
            sourceType: options.sourceType,
            processingTime: Date.now() - startTime,
            language: options.language,
            confidence: 0
          }
        }
      }

      // Write audio to temporary file
      const tempAudioFile = await this.writeAudioToTempFile(audioBuffer, transcriptionSessionId)

      // Get model path
      const modelPath = await this.getModelPath(options.modelSize || 'tiny')

      // Execute whisper.cpp with two-stage language awareness
      const transcriptionResult = await this.transcribeWithLanguageAwareness(
        tempAudioFile,
        modelPath,
        options
      )

      // Post-process transcription result for noise filtering
      let filteredText =
        options.enableNoiseFiltering !== false
          ? this.filterTranscriptionResult(transcriptionResult.text, options)
          : transcriptionResult.text

      // Convert Simplified Chinese to Traditional Chinese (Taiwan) if user language is zh-TW
      if (filteredText && options.userLanguage === 'zh-TW' && this.chineseConverter) {
        const originalText = filteredText
        filteredText = this.chineseConverter(filteredText)
        console.log('[WhisperService] Applied CN→TW conversion:', {
          original: originalText.substring(0, 50),
          converted: filteredText.substring(0, 50),
          changed: originalText !== filteredText
        })
      }

      const processingTime = Date.now() - startTime

      // Update context for future segments if transcription was successful
      if (filteredText && filteredText.trim()) {
        this.updateContext(transcriptionSessionId, options.sourceType, filteredText)
      }

      // Use detected language from two-stage detection or fallback
      const detectedLanguage = transcriptionResult.detectedLanguage || options.language

      console.log(`[WhisperService] Completed transcription ${transcriptionSessionId}`, {
        originalText: `"${transcriptionResult.text}"`,
        filteredText: `"${filteredText}"`,
        wasFiltered: transcriptionResult.text !== filteredText,
        processingTime: `${processingTime}ms`,
        sourceType: options.sourceType,
        detectedLanguage,
        whisperLanguage: transcriptionResult.whisperLanguage,
        usedTwoStageDetection: transcriptionResult.usedTwoStageDetection,
        contextUpdated: !!(filteredText && filteredText.trim())
      })

      return {
        text: filteredText,
        sourceType: options.sourceType,
        processingTime,
        language: detectedLanguage,
        detectedLanguage: transcriptionResult.detectedLanguage,
        whisperLanguage: transcriptionResult.whisperLanguage,
        usedTwoStageDetection: transcriptionResult.usedTwoStageDetection
      }
    } catch (error) {
      console.error(`[WhisperService] Failed transcription ${transcriptionSessionId}:`, error)
      throw error
    }
  }

  /**
   * Get available models information
   */
  async getAvailableModels(): Promise<ModelInfo[]> {
    const models: ModelInfo[] = [
      { name: 'tiny', size: '75MB', downloaded: false },
      { name: 'base', size: '142MB', downloaded: false },
      { name: 'small', size: '488MB', downloaded: false },
      { name: 'medium', size: '1.5GB', downloaded: false }
    ]

    for (const model of models) {
      const modelPath = path.join(this.modelsPath, `ggml-${model.name}.bin`)
      try {
        await fs.access(modelPath)
        model.downloaded = true
        model.path = modelPath
      } catch {
        model.downloaded = false
      }
    }

    return models
  }

  /**
   * Download a specific model with progress tracking
   */
  async downloadModel(
    modelName: string,
    onProgress?: (progress: { downloaded: number; total: number; percentage: number }) => void
  ): Promise<boolean> {
    // Check if there's already a download in progress for this model
    const existingPromise = this.downloadPromises.get(modelName)
    if (existingPromise) {
      console.log(
        `[WhisperService] Download already in progress for model: ${modelName}, waiting for completion...`
      )
      return existingPromise
    }

    // Create a new download promise and store it
    const downloadPromise = this._performDownload(modelName, onProgress)
    this.downloadPromises.set(modelName, downloadPromise)

    // Clean up the promise when done
    downloadPromise.finally(() => {
      this.downloadPromises.delete(modelName)
    })

    return downloadPromise
  }

  /**
   * Internal method to perform the actual download
   */
  private async _performDownload(
    modelName: string,
    onProgress?: (progress: { downloaded: number; total: number; percentage: number }) => void
  ): Promise<boolean> {
    console.log(`[WhisperService] Starting download for model: ${modelName}`)

    const modelUrl = `https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-${modelName}.bin`
    const modelPath = path.join(this.modelsPath, `ggml-${modelName}.bin`)
    const tempPath = `${modelPath}.download`

    try {
      // Check if model already exists
      try {
        await fs.access(modelPath)
        console.log(`[WhisperService] Model ${modelName} already exists, skipping download`)
        return true
      } catch {
        // Model doesn't exist, proceed with download
      }

      console.log(`[WhisperService] Starting download from: ${modelUrl}`)
      console.log(`[WhisperService] Saving to: ${modelPath}`)

      // Clean up any existing temp file from previous failed downloads
      try {
        await fs.access(tempPath)
        console.log(`[WhisperService] Found existing temp file, removing: ${tempPath}`)
        await fs.unlink(tempPath)
      } catch {
        // Temp file doesn't exist, which is expected
      }

      // Use fetch to download with progress tracking
      const response = await fetch(modelUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0', 10)
      let downloadedSize = 0

      if (!response.body) {
        throw new Error('Response body is null')
      }

      // Create write stream
      const writeStream = (await import('fs')).createWriteStream(tempPath)
      const reader = response.body.getReader()

      try {
        while (true) {
          const { done, value } = await reader.read()

          if (done) break

          downloadedSize += value.length
          writeStream.write(Buffer.from(value))

          // Report progress
          if (onProgress && totalSize > 0) {
            const percentage = Math.round((downloadedSize / totalSize) * 100)
            onProgress({
              downloaded: downloadedSize,
              total: totalSize,
              percentage
            })
          }
        }

        writeStream.end()

        // Wait for write stream to finish
        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve)
          writeStream.on('error', reject)
        })

        // Move from temp to final location
        await fs.rename(tempPath, modelPath)

        console.log(
          `[WhisperService] Successfully downloaded model ${modelName} (${downloadedSize} bytes)`
        )
        return true
      } catch (error) {
        // Cleanup temp file on error
        try {
          await fs.unlink(tempPath)
        } catch {}
        throw error
      }
    } catch (error) {
      console.error(`[WhisperService] Failed to download model ${modelName}:`, error)
      return false
    }
  }

  /**
   * Download Silero VAD model for voice activity detection
   */
  async downloadVADModel(
    onProgress?: (progress: { downloaded: number; total: number; percentage: number }) => void
  ): Promise<boolean> {
    const vadModelUrl =
      'https://huggingface.co/ggml-org/whisper-vad/resolve/main/ggml-silero-v5.1.2.bin'
    const vadModelPath = path.join(this.modelsPath, 'ggml-silero-vad.bin')
    const tempPath = `${vadModelPath}.download`

    try {
      // Check if VAD model already exists
      try {
        await fs.access(vadModelPath)
        console.log('[WhisperService] VAD model already exists, skipping download')
        this.vadModelPath = vadModelPath
        return true
      } catch {
        // VAD model doesn't exist, proceed with download
      }

      console.log('[WhisperService] Downloading Silero VAD model...')
      console.log(`[WhisperService] From: ${vadModelUrl}`)
      console.log(`[WhisperService] To: ${vadModelPath}`)

      // Clean up any existing temp file
      try {
        await fs.unlink(tempPath)
      } catch {}

      // Download with progress tracking
      const response = await fetch(vadModelUrl)

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const totalSize = parseInt(response.headers.get('content-length') || '0', 10)
      let downloadedSize = 0

      if (!response.body) {
        throw new Error('Response body is null')
      }

      const writeStream = (await import('fs')).createWriteStream(tempPath)
      const reader = response.body.getReader()

      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          downloadedSize += value.length
          writeStream.write(Buffer.from(value))

          if (onProgress && totalSize > 0) {
            const percentage = Math.round((downloadedSize / totalSize) * 100)
            onProgress({ downloaded: downloadedSize, total: totalSize, percentage })
          }
        }

        writeStream.end()

        await new Promise((resolve, reject) => {
          writeStream.on('finish', resolve)
          writeStream.on('error', reject)
        })

        await fs.rename(tempPath, vadModelPath)

        this.vadModelPath = vadModelPath
        console.log(`[WhisperService] VAD model downloaded successfully (${downloadedSize} bytes)`)
        return true
      } catch (error) {
        try {
          await fs.unlink(tempPath)
        } catch {}
        throw error
      }
    } catch (error) {
      console.error('[WhisperService] Failed to download VAD model:', error)
      return false
    }
  }

  /**
   * Delete a downloaded model
   */
  async deleteModel(modelName: string): Promise<boolean> {
    console.log(`[WhisperService] Deleting model: ${modelName}`)

    const modelPath = path.join(this.modelsPath, `ggml-${modelName}.bin`)

    try {
      await fs.access(modelPath)
      await fs.unlink(modelPath)
      console.log(`[WhisperService] Successfully deleted model: ${modelName}`)
      return true
    } catch (error) {
      console.error(`[WhisperService] Failed to delete model ${modelName}:`, error)
      return false
    }
  }

  /**
   * Get storage usage information
   */
  async getStorageUsage(): Promise<{
    totalBytes: number
    models: Array<{ name: string; sizeBytes: number }>
  }> {
    try {
      const models = await this.getAvailableModels()
      const modelSizes: Array<{ name: string; sizeBytes: number }> = []
      let totalBytes = 0

      for (const model of models) {
        if (model.downloaded && model.path) {
          try {
            const stats = await fs.stat(model.path)
            const sizeBytes = stats.size
            modelSizes.push({ name: model.name, sizeBytes })
            totalBytes += sizeBytes
          } catch (error) {
            console.warn(`[WhisperService] Could not get size for model ${model.name}:`, error)
          }
        }
      }

      return { totalBytes, models: modelSizes }
    } catch (error) {
      console.error('[WhisperService] Failed to get storage usage:', error)
      return { totalBytes: 0, models: [] }
    }
  }

  /**
   * Ensure at least one model is available, downloading if necessary
   */
  async ensureModelAvailable(
    onProgress?: (
      modelName: string,
      progress: { downloaded: number; total: number; percentage: number }
    ) => void
  ): Promise<boolean> {
    console.log('[WhisperService] Ensuring model availability...')

    try {
      const models = await this.getAvailableModels()
      const downloadedModels = models.filter((m) => m.downloaded)

      // Check if the default model (base) is available
      const defaultModelExists = downloadedModels.some((m) => m.name === DEFAULT_MODEL_SIZE)

      if (defaultModelExists) {
        console.log(
          `[WhisperService] Default ${DEFAULT_MODEL_SIZE} model found. Available models:`,
          downloadedModels.map((m) => m.name)
        )
        return true
      }

      // If we have other models but not the default, download it
      if (downloadedModels.length > 0 && !defaultModelExists) {
        console.log(
          `[WhisperService] Found ${downloadedModels.length} models but ${DEFAULT_MODEL_SIZE} is missing. Downloading...`
        )
      } else {
        console.log(`[WhisperService] No models found, downloading ${DEFAULT_MODEL_SIZE} model...`)
      }

      const success = await this.downloadModel(DEFAULT_MODEL_SIZE, (progress) => {
        onProgress?.(DEFAULT_MODEL_SIZE, progress)
      })

      if (success) {
        console.log(`[WhisperService] ${DEFAULT_MODEL_SIZE} model downloaded successfully`)
        return true
      } else {
        console.error(`[WhisperService] Failed to download ${DEFAULT_MODEL_SIZE} model`)
        return false
      }
    } catch (error) {
      console.error('[WhisperService] Error ensuring model availability:', error)
      return false
    }
  }

  // Private helper methods

  /**
   * Extract the last sentence from transcription text for context
   */
  private extractLastSentence(text: string): string {
    if (!text || !text.trim()) return ''

    const sentences = text.split(/[.!?]+/).filter((s) => s.trim())
    return sentences[sentences.length - 1]?.trim() || ''
  }

  /**
   * Build context prompt from previous segments
   */
  private buildContextPrompt(sessionId: string, sourceType: 'microphone' | 'system'): string {
    const contextKey = `${sessionId}-${sourceType}`
    const previousContext = this.segmentContext.get(contextKey) || ''

    if (previousContext) {
      return `Previous context: "${previousContext}". Continue naturally.`
    }

    return ''
  }

  /**
   * Update context after successful transcription
   */
  private updateContext(
    sessionId: string,
    sourceType: 'microphone' | 'system',
    transcriptionText: string
  ): void {
    if (!transcriptionText || !transcriptionText.trim()) return

    const contextKey = `${sessionId}-${sourceType}`
    const lastSentence = this.extractLastSentence(transcriptionText)

    if (lastSentence) {
      this.segmentContext.set(contextKey, lastSentence)

      // Also maintain conversation history (last 5 segments for better context)
      const history = this.sessionHistory.get(contextKey) || []
      history.push(transcriptionText)
      if (history.length > 5) {
        history.shift() // Keep only last 5 segments
      }
      this.sessionHistory.set(contextKey, history)

      console.log(`[WhisperService] Updated context for ${contextKey}: "${lastSentence}"`)
    }
  }

  /**
   * Clear context for a session (useful for new sessions)
   */
  private clearSessionContext(sessionId: string): void {
    const keys = Array.from(this.segmentContext.keys()).filter((key) => key.startsWith(sessionId))
    keys.forEach((key) => {
      this.segmentContext.delete(key)
      this.sessionHistory.delete(key)
    })
    console.log(`[WhisperService] Cleared context for session: ${sessionId}`)
  }

  private async ensureDirectories(): Promise<void> {
    await fs.mkdir(this.modelsPath, { recursive: true })
    await fs.mkdir(this.tempPath, { recursive: true })
  }

  private async validateBinary(): Promise<boolean> {
    try {
      console.log(`[WhisperService] Checking binary at: ${this.whisperBinaryPath}`)

      // Check if file exists
      await fs.access(this.whisperBinaryPath, fs.constants.F_OK)
      console.log(`[WhisperService] Binary file exists`)

      // Check if file is executable
      await fs.access(this.whisperBinaryPath, fs.constants.X_OK)
      console.log(`[WhisperService] Binary is executable`)

      // Get file stats for debugging
      const stats = await fs.stat(this.whisperBinaryPath)
      console.log(`[WhisperService] Binary stats:`, {
        size: stats.size,
        mode: stats.mode.toString(8),
        isFile: stats.isFile()
      })

      return true
    } catch (error) {
      console.error(`[WhisperService] Binary validation failed:`, error)
      return false
    }
  }

  private async ensureDefaultModel(): Promise<void> {
    const defaultModelPath = path.join(this.modelsPath, `ggml-${DEFAULT_MODEL_SIZE}.bin`)
    try {
      await fs.access(defaultModelPath)
      console.log(`[WhisperService] Default ${DEFAULT_MODEL_SIZE} model already exists`)
    } catch {
      console.log(
        `[WhisperService] Default ${DEFAULT_MODEL_SIZE} model not found, will be downloaded on first use via ensureModelAvailable()`
      )
      // Note: Model will be downloaded automatically when ensureModelAvailable() is called
      // by the renderer process during initialization
    }
  }

  private async writeAudioToTempFile(audioBuffer: ArrayBuffer, sessionId: string): Promise<string> {
    const tempFileName = `audio-${sessionId}.wav`
    const tempFilePath = path.join(this.tempPath, tempFileName)

    // Convert ArrayBuffer to proper WAV file
    const wavBuffer = this.createWavFile(audioBuffer)
    await fs.writeFile(tempFilePath, wavBuffer)

    console.log(`[WhisperService] 💾 Created WAV file: ${tempFilePath} (${wavBuffer.length} bytes)`)

    return tempFilePath
  }

  /**
   * Create a proper WAV file from raw PCM data
   */
  private createWavFile(pcmData: ArrayBuffer): Buffer {
    const pcmBuffer = Buffer.from(pcmData)
    const sampleRate = 16000 // 16kHz as expected by whisper.cpp
    const numChannels = 1 // Mono
    const bitsPerSample = 16 // 16-bit PCM
    const bytesPerSample = bitsPerSample / 8
    const blockAlign = numChannels * bytesPerSample
    const byteRate = sampleRate * blockAlign

    // WAV file header (44 bytes)
    const header = Buffer.alloc(44)
    let offset = 0

    // RIFF header
    header.write('RIFF', offset)
    offset += 4
    header.writeUInt32LE(36 + pcmBuffer.length, offset)
    offset += 4 // File size - 8
    header.write('WAVE', offset)
    offset += 4

    // Format chunk
    header.write('fmt ', offset)
    offset += 4
    header.writeUInt32LE(16, offset)
    offset += 4 // Format chunk size
    header.writeUInt16LE(1, offset)
    offset += 2 // Audio format (PCM)
    header.writeUInt16LE(numChannels, offset)
    offset += 2 // Number of channels
    header.writeUInt32LE(sampleRate, offset)
    offset += 4 // Sample rate
    header.writeUInt32LE(byteRate, offset)
    offset += 4 // Byte rate
    header.writeUInt16LE(blockAlign, offset)
    offset += 2 // Block align
    header.writeUInt16LE(bitsPerSample, offset)
    offset += 2 // Bits per sample

    // Data chunk
    header.write('data', offset)
    offset += 4
    header.writeUInt32LE(pcmBuffer.length, offset) // Data size

    // Combine header and PCM data
    return Buffer.concat([header, pcmBuffer])
  }

  private async getModelPath(modelSize: string): Promise<string> {
    const modelPath = path.join(this.modelsPath, `ggml-${modelSize}.bin`)

    try {
      await fs.access(modelPath)
      return modelPath
    } catch {
      // Fallback to default model if requested model not available
      const defaultModelPath = path.join(this.modelsPath, `ggml-${DEFAULT_MODEL_SIZE}.bin`)
      try {
        await fs.access(defaultModelPath)
        console.warn(
          `[WhisperService] Model ${modelSize} not found, falling back to ${DEFAULT_MODEL_SIZE}`
        )
        return defaultModelPath
      } catch {
        // Last resort: try tiny model
        const tinyModelPath = path.join(this.modelsPath, 'ggml-tiny.bin')
        try {
          await fs.access(tinyModelPath)
          console.warn(
            `[WhisperService] Model ${modelSize} and ${DEFAULT_MODEL_SIZE} not found, falling back to tiny`
          )
          return tinyModelPath
        } catch {
          throw new Error(
            `No whisper models available. Please download at least the ${DEFAULT_MODEL_SIZE} model.`
          )
        }
      }
    }
  }

  /**
   * Stage 1: Fast language detection using whisper.cpp --detect-language
   */
  private async detectLanguageFirst(
    audioFilePath: string,
    modelPath: string
  ): Promise<string | null> {
    const args = [
      audioFilePath,
      '--model',
      modelPath,
      '--detect-language',
      // NOTE: Do NOT use --no-prints here - it suppresses language detection output
      '--threads',
      '2' // Faster detection with fewer threads
    ]

    try {
      console.log(`[WhisperService] Stage 1: Detecting language for audio file`)
      const result = await this.executeWhisperCommand(args)
      const detectedLang = this.extractDetectedLanguage(result)
      console.log(`[WhisperService] Detected language: ${detectedLang}`)
      return detectedLang
    } catch (error) {
      console.warn(
        `[WhisperService] Language detection failed: ${error.message}, falling back to auto`
      )
      return null
    }
  }

  /**
   * Extract detected language from whisper.cpp --detect-language output
   */
  private extractDetectedLanguage(output: string): string | null {
    // whisper.cpp outputs format like: "detected language: zh probability: 0.99"
    // Also handles formats like "detected language = zh (p = 0.99)"
    const patterns = [
      /detected language:\s*(\w+)/i,
      /detected language\s*=\s*(\w+)/i,
      /language:\s*(\w+)/i
    ]

    for (const pattern of patterns) {
      const match = output.match(pattern)
      if (match) {
        console.log(
          `[WhisperService] Extracted language using pattern: ${pattern}, result: ${match[1]}`
        )
        return match[1].toLowerCase()
      }
    }

    console.warn(
      '[WhisperService] Could not extract language from output:',
      output.substring(0, 500)
    )
    return null
  }

  /**
   * Execute whisper.cpp command and return output
   * Returns combined stdout + stderr since whisper.cpp outputs to both streams
   */
  private async executeWhisperCommand(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      console.log(`[WhisperService] Executing: ${this.whisperBinaryPath} ${args.join(' ')}`)

      const process = spawn(this.whisperBinaryPath, args)
      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          // Language detection output goes to stderr, so combine both streams
          const combinedOutput = stdout + stderr
          // console.log('[WhisperService] Command output:', {
          //   stdout: stdout.substring(0, 200),
          //   stderr: stderr.substring(0, 200),
          //   combined: combinedOutput.substring(0, 200)
          // })
          resolve(combinedOutput)
        } else {
          reject(new Error(`Process exited with code ${code}: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        reject(new Error(`Failed to start process: ${error.message}`))
      })
    })
  }

  /**
   * Two-stage transcription with language awareness
   * Stage 1: Detect language, Stage 2: Targeted transcription
   */
  private async transcribeWithLanguageAwareness(
    audioFilePath: string,
    modelPath: string,
    options: TranscriptionOptions
  ): Promise<{
    text: string
    detectedLanguage?: string
    whisperLanguage?: string
    usedTwoStageDetection: boolean
  }> {
    // Determine if two-stage detection should be used
    const shouldUseTwoStage =
      options.enableTwoStageDetection ??
      (options.userLanguage === 'zh-TW' || options.userLanguage === 'zh-CN')

    if (shouldUseTwoStage) {
      console.log(
        `[WhisperService] Using two-stage detection for user language: ${options.userLanguage}`
      )

      // Stage 1: Language Detection
      const detectedLang = await this.detectLanguageFirst(audioFilePath, modelPath)

      if (detectedLang) {
        // Stage 2: Targeted transcription based on detection
        let targetLanguage: string | undefined

        if (detectedLang.startsWith('zh') && options.userLanguage === 'zh-TW') {
          // Chinese detected for Traditional Chinese user - use 'zh' for better quality
          targetLanguage = 'zh'
          console.log(
            `[WhisperService] Chinese detected for zh-TW user, using targeted Chinese transcription`
          )
        } else {
          // Non-Chinese or different language preference - use auto-detection
          console.log(
            `[WhisperService] Non-Chinese detected (${detectedLang}), using auto-detection`
          )
        }

        const transcriptionOptions = {
          ...options,
          language: targetLanguage,
          autoDetectLanguage: !targetLanguage // Use auto if no target language
        }

        const text = await this.executeWhisper(audioFilePath, modelPath, transcriptionOptions)
        return {
          text,
          detectedLanguage: detectedLang,
          whisperLanguage: targetLanguage || 'auto',
          usedTwoStageDetection: true
        }
      }
    }

    // Fallback to standard single-stage transcription
    console.log(`[WhisperService] Using standard single-stage transcription`)
    const text = await this.executeWhisper(audioFilePath, modelPath, options)
    return {
      text,
      usedTwoStageDetection: false
    }
  }

  private async executeWhisper(
    audioFilePath: string,
    modelPath: string,
    options: TranscriptionOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const sessionId = path.basename(audioFilePath, '.wav')
      const contextPrompt = this.buildContextPrompt(sessionId, options.sourceType)

      const args = [
        audioFilePath,
        '--model',
        modelPath,
        '--no-timestamps',
        '--no-prints',
        '--threads',
        '4',
        // Quality improvements
        '--temperature',
        '0.0',
        '--best-of',
        '2',
        '--beam-size',
        '5',
        // Transcription quality prompt
        '--prompt',
        DOMAIN_PROMPTS.default
      ]

      // Add context prompt if available
      if (contextPrompt) {
        args.push('--prompt', contextPrompt)
        console.log(`[WhisperService] Using context prompt: "${contextPrompt}"`)
      }

      // Add word-level features
      args.push('--word-thold', '0.01')

      // VAD (Voice Activity Detection) - enabled by default to filter noise
      const enableVAD = options.enableVAD !== false // Default: true
      if (enableVAD && this.vadModelPath) {
        args.push('--vad')
        args.push('--vad-model', this.vadModelPath)
        args.push('--vad-threshold', String(options.vadThreshold ?? 0.6))
        args.push('--vad-min-speech-duration-ms', String(options.vadMinSpeechDuration ?? 250))
        args.push('--vad-min-silence-duration-ms', String(options.vadMinSilenceDuration ?? 100))
        args.push('--vad-speech-pad-ms', String(options.vadSpeechPadding ?? 30))

        console.log('[WhisperService] VAD enabled with settings:', {
          threshold: options.vadThreshold ?? 0.6,
          minSpeechDuration: options.vadMinSpeechDuration ?? 250,
          minSilenceDuration: options.vadMinSilenceDuration ?? 100,
          speechPadding: options.vadSpeechPadding ?? 30
        })
      } else if (enableVAD && !this.vadModelPath) {
        console.warn('[WhisperService] VAD requested but model not available, skipping VAD')
      }

      // Enable auto-detection by default (autoDetectLanguage defaults to true)
      // Only add language constraint if explicitly disabled auto-detection
      const shouldAutoDetect = options.autoDetectLanguage !== false

      if (!shouldAutoDetect && options.language) {
        // Extract base language code (e.g., "zh-TW" → "zh", "en-US" → "en")
        const languageCode = options.language.split('-')[0].toLowerCase()
        args.push('--language', languageCode)
        console.log(
          `[WhisperService] Using fixed language '${options.language}' → '${languageCode}' (auto-detection disabled)`
        )
      } else {
        // Use auto-detection by default
        args.push('--language', 'auto')
        console.log(`[WhisperService] Using auto-detection for language`)
      }

      console.log(`[WhisperService] Executing whisper.cpp:`, {
        binary: this.whisperBinaryPath,
        args: args.join(' '),
        audioFile: audioFilePath
      })

      const process = spawn(this.whisperBinaryPath, args)
      this.activeProcesses.set(sessionId, process)

      let stdout = ''
      let stderr = ''

      process.stdout.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        this.activeProcesses.delete(sessionId)

        console.log(`[WhisperService] whisper.cpp finished with code ${code}`, {
          stdout: stdout ? `"${stdout.trim()}"` : '(empty)',
          stderr: stderr ? `"${stderr.trim()}"` : '(empty)',
          stdoutLength: stdout.length,
          stderrLength: stderr.length
        })

        if (code === 0) {
          const transcription = stdout.trim()
          resolve(transcription)
        } else {
          console.error(`[WhisperService] whisper.cpp exited with code ${code}`)
          console.error(`[WhisperService] stderr:`, stderr)
          reject(new Error(`Whisper process failed with exit code ${code}: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        this.activeProcesses.delete(sessionId)
        console.error(`[WhisperService] Process error:`, error)
        reject(error)
      })

      // Set timeout for long-running processes
      setTimeout(() => {
        if (this.activeProcesses.has(sessionId)) {
          console.warn(`[WhisperService] Process timeout, killing: ${sessionId}`)
          process.kill('SIGTERM')
          this.activeProcesses.delete(sessionId)
          reject(new Error('Transcription process timeout'))
        }
      }, 30000) // 30 second timeout
    })
  }

  /**
   * Analyze audio energy to detect speech vs noise
   */
  private analyzeAudioEnergy(audioBuffer: ArrayBuffer): {
    averageEnergy: number
    maxEnergy: number
    silentFrames: number
    totalFrames: number
  } {
    const samples = new Int16Array(audioBuffer)
    const frameSize = 1024 // Analyze in 1024-sample frames
    const silenceThreshold = 500 // Absolute amplitude threshold for silence

    let totalEnergy = 0
    let maxEnergy = 0
    let silentFrames = 0
    let totalFrames = 0

    for (let i = 0; i < samples.length; i += frameSize) {
      const frameEnd = Math.min(i + frameSize, samples.length)
      let frameEnergy = 0
      let maxFrameAmplitude = 0

      // Calculate RMS energy for this frame
      for (let j = i; j < frameEnd; j++) {
        const amplitude = Math.abs(samples[j])
        frameEnergy += amplitude * amplitude
        maxFrameAmplitude = Math.max(maxFrameAmplitude, amplitude)
      }

      const frameLength = frameEnd - i
      const rmsEnergy = Math.sqrt(frameEnergy / frameLength) / 32768 // Normalize to 0-1

      totalEnergy += rmsEnergy
      maxEnergy = Math.max(maxEnergy, rmsEnergy)
      totalFrames++

      // Count as silent frame if max amplitude is below threshold
      if (maxFrameAmplitude < silenceThreshold) {
        silentFrames++
      }
    }

    return {
      averageEnergy: totalFrames > 0 ? totalEnergy / totalFrames : 0,
      maxEnergy,
      silentFrames,
      totalFrames
    }
  }

  /**
   * Filter transcription results to remove hallucinations and noise artifacts
   */
  private filterTranscriptionResult(text: string, options: TranscriptionOptions): string {
    if (!text || !text.trim()) {
      return ''
    }

    const originalText = text.trim()

    // Pattern detection for common Whisper hallucinations
    const hallucination_patterns = [
      // Single or few Chinese/Japanese/Korean characters (common noise hallucination)
      /^[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]{1,3}$/,
      // Parenthetical expressions that are likely noise
      /^\([^)]*\)$/,
      // Bracket expressions
      /^\[[^\]]*\]$/,
      // Single words that are clearly not speech in expected language
      /^(Thanks for watching|Thank you|Thanks|Bye|Hello)$/i,
      // Very short nonsensical text
      /^[^a-zA-Z0-9\s]{1,5}$/,
      // Repeated characters or patterns
      /^(..)\1{3,}$/,
      // Only punctuation
      /^[\s\p{P}]+$/u
    ]

    // Check for hallucination patterns
    for (const pattern of hallucination_patterns) {
      if (pattern.test(originalText)) {
        console.log(
          `[WhisperService] Filtered hallucination: "${originalText}" (matched pattern: ${pattern})`
        )
        return ''
      }
    }

    // Language-specific filtering
    if (options.language && options.language.startsWith('en')) {
      // If English is expected, filter out mostly non-Latin text
      const latinChars = originalText.match(/[a-zA-Z0-9\s\p{P}]/gu)?.length || 0
      const totalChars = originalText.length
      const latinRatio = latinChars / totalChars

      if (latinRatio < 0.7 && totalChars < 50) {
        // Less than 70% Latin chars in short text
        console.log(
          `[WhisperService] Filtered non-English text: "${originalText}" (${(latinRatio * 100).toFixed(1)}% Latin characters)`
        )
        return ''
      }
    }

    // Length-based filtering for very short results
    if (originalText.length <= 2) {
      console.log(`[WhisperService] Filtered very short text: "${originalText}"`)
      return ''
    }

    // Check for repetitive content (likely noise artifacts)
    const words = originalText.toLowerCase().split(/\s+/)
    if (words.length > 1) {
      const uniqueWords = new Set(words)
      const repetitionRatio = words.length / uniqueWords.size
      if (repetitionRatio > 3) {
        // Same words repeated more than 3 times on average
        console.log(
          `[WhisperService] Filtered repetitive text: "${originalText}" (repetition ratio: ${repetitionRatio.toFixed(1)})`
        )
        return ''
      }
    }

    // Text passes all filters
    return originalText
  }
}

// Singleton instance
let whisperBackend: WhisperBackend | null = null

export function getWhisperBackend(): WhisperBackend {
  if (!whisperBackend) {
    whisperBackend = new WhisperBackend()
  }
  return whisperBackend
}
