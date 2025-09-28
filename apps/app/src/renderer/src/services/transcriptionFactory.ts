/**
 * Transcription factory that manages both local and remote transcription services
 * Provides unified interface and automatic fallback capabilities
 */

import { GeminiClient } from './geminiClient'
import { getLocalTranscriptionClient, LocalTranscriptionClient, LocalTranscriptionOptions } from './localTranscriptionClient'

export type TranscriptionMode = 'local' | 'gemini' | 'auto'

export interface TranscriptionConfig {
  mode: TranscriptionMode
  localOptions?: {
    modelSize?: 'tiny' | 'base' | 'small' | 'medium'
    fallbackToGemini?: boolean
  }
  geminiOptions?: {
    customPrompt?: string
    language?: string
  }
}

export interface UnifiedTranscriptionResult {
  text: string
  sourceType: 'microphone' | 'system'
  processingTime?: number
  transcriptionMode: 'local' | 'gemini'
  confidence?: number
}

/**
 * Factory class for managing transcription services
 */
export class TranscriptionFactory {
  private localClient: LocalTranscriptionClient
  private geminiClients = new Map<string, GeminiClient>()
  private config: TranscriptionConfig

  constructor(config: TranscriptionConfig) {
    this.config = config
    this.localClient = getLocalTranscriptionClient()
  }

  /**
   * Initialize the transcription factory
   */
  async initialize(): Promise<boolean> {
    console.log('[TranscriptionFactory] Initializing with mode:', this.config.mode)

    if (this.config.mode === 'local' || this.config.mode === 'auto') {
      try {
        const localInitialized = await this.localClient.initialize()

        if (localInitialized) {
          const isAvailable = await this.localClient.isAvailable()
          if (!isAvailable) {
            console.warn('[TranscriptionFactory] Local transcription initialized but no models available')

            if (this.config.mode === 'local') {
              console.error('[TranscriptionFactory] Local mode required but no models available')
              return false
            }
          } else {
            console.log('[TranscriptionFactory] Local transcription ready')
          }
        } else {
          console.warn('[TranscriptionFactory] Local transcription initialization failed')

          if (this.config.mode === 'local') {
            return false
          }
        }
      } catch (error) {
        console.error('[TranscriptionFactory] Local transcription initialization error:', error)

        if (this.config.mode === 'local') {
          return false
        }
      }
    }

    return true
  }

  /**
   * Create a transcription processor for a specific audio source
   */
  async createTranscriptionProcessor(
    sourceType: 'microphone' | 'system',
    onTextResponse: (text: string, turnComplete: boolean, sourceType: 'microphone' | 'system') => void,
    onSetupComplete?: () => void,
    language?: string
  ): Promise<TranscriptionProcessor> {
    const effectiveMode = await this.determineEffectiveMode()

    console.log(`[TranscriptionFactory] Creating ${effectiveMode} transcription processor for ${sourceType}`)

    if (effectiveMode === 'local') {
      return new LocalTranscriptionProcessor(
        this.localClient,
        sourceType,
        onTextResponse,
        onSetupComplete,
        {
          modelSize: this.config.localOptions?.modelSize || 'tiny',
          language
        }
      )
    } else {
      return new GeminiTranscriptionProcessor(
        sourceType,
        onTextResponse,
        onSetupComplete,
        {
          customPrompt: this.config.geminiOptions?.customPrompt,
          language: this.config.geminiOptions?.language || language
        }
      )
    }
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<TranscriptionConfig>): void {
    this.config = { ...this.config, ...newConfig }
    console.log('[TranscriptionFactory] Configuration updated:', this.config)
  }

  /**
   * Get current configuration
   */
  getConfig(): TranscriptionConfig {
    return { ...this.config }
  }

  /**
   * Check if local transcription is available
   */
  async isLocalAvailable(): Promise<boolean> {
    try {
      return await this.localClient.isAvailable()
    } catch {
      return false
    }
  }

  /**
   * Get local transcription client for direct access (e.g., model management)
   */
  getLocalClient(): LocalTranscriptionClient {
    return this.localClient
  }

  // Private methods

  private async determineEffectiveMode(): Promise<'local' | 'gemini'> {
    if (this.config.mode === 'gemini') {
      return 'gemini'
    }

    if (this.config.mode === 'local') {
      return 'local'
    }

    // Auto mode: prefer local if available, fallback to Gemini
    const localAvailable = await this.isLocalAvailable()
    return localAvailable ? 'local' : 'gemini'
  }
}

/**
 * Abstract base class for transcription processors
 */
export abstract class TranscriptionProcessor {
  protected sourceType: 'microphone' | 'system'
  protected onTextResponse: (text: string, turnComplete: boolean, sourceType: 'microphone' | 'system') => void
  protected onSetupComplete?: () => void

  constructor(
    sourceType: 'microphone' | 'system',
    onTextResponse: (text: string, turnComplete: boolean, sourceType: 'microphone' | 'system') => void,
    onSetupComplete?: () => void
  ) {
    this.sourceType = sourceType
    this.onTextResponse = onTextResponse
    this.onSetupComplete = onSetupComplete
  }

  abstract connect(): Promise<void>
  abstract disconnect(): void
  abstract sendAudioChunk(chunk: string, mimeType: string): void
  abstract isConnected(): boolean
  abstract getStats(): any
}

/**
 * Local transcription processor using whisper.cpp
 */
export class LocalTranscriptionProcessor extends TranscriptionProcessor {
  private localClient: LocalTranscriptionClient
  private options: LocalTranscriptionOptions
  private audioBuffer: ArrayBuffer[] = []
  private isConnected = false
  private processingStats = {
    chunksReceived: 0,
    totalProcessingTime: 0,
    transcriptionsCompleted: 0
  }

  constructor(
    localClient: LocalTranscriptionClient,
    sourceType: 'microphone' | 'system',
    onTextResponse: (text: string, turnComplete: boolean, sourceType: 'microphone' | 'system') => void,
    onSetupComplete?: () => void,
    options: Omit<LocalTranscriptionOptions, 'sourceType'> = {}
  ) {
    super(sourceType, onTextResponse, onSetupComplete)
    this.localClient = localClient
    this.options = {
      ...options,
      sourceType
    }
  }

  async connect(): Promise<void> {
    console.log(`[LocalTranscriptionProcessor] Connecting ${this.sourceType} processor`)

    try {
      const initialized = await this.localClient.initialize()
      if (!initialized) {
        throw new Error('Local transcription client initialization failed')
      }

      this.isConnected = true
      this.onSetupComplete?.()

      console.log(`[LocalTranscriptionProcessor] ${this.sourceType} processor connected successfully`)
    } catch (error) {
      console.error(`[LocalTranscriptionProcessor] Failed to connect ${this.sourceType} processor:`, error)
      throw error
    }
  }

  disconnect(): void {
    console.log(`[LocalTranscriptionProcessor] Disconnecting ${this.sourceType} processor`)
    this.isConnected = false
    this.audioBuffer = []
  }

  sendAudioChunk(chunk: string, mimeType: string): void {
    if (!this.isConnected) {
      console.warn(`[LocalTranscriptionProcessor] Cannot send audio chunk - ${this.sourceType} processor not connected`)
      return
    }

    this.processingStats.chunksReceived++

    try {
      // Convert base64 chunk to ArrayBuffer
      const binaryString = atob(chunk)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const audioBuffer = bytes.buffer

      // Process audio immediately (could be optimized to batch for efficiency)
      this.processAudioBuffer(audioBuffer)
    } catch (error) {
      console.error(`[LocalTranscriptionProcessor] Error processing audio chunk for ${this.sourceType}:`, error)
    }
  }

  isConnected(): boolean {
    return this.isConnected
  }

  getStats(): any {
    return {
      ...this.processingStats,
      sourceType: this.sourceType,
      modelSize: this.options.modelSize,
      averageProcessingTime: this.processingStats.transcriptionsCompleted > 0
        ? this.processingStats.totalProcessingTime / this.processingStats.transcriptionsCompleted
        : 0
    }
  }

  private async processAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    try {
      const result = await this.localClient.transcribeAudio(audioBuffer, this.options)

      this.processingStats.transcriptionsCompleted++
      this.processingStats.totalProcessingTime += result.processingTime

      if (result.text && result.text.trim()) {
        this.onTextResponse(result.text, true, this.sourceType)
      }
    } catch (error) {
      console.error(`[LocalTranscriptionProcessor] Transcription failed for ${this.sourceType}:`, error)
    }
  }
}

/**
 * Gemini transcription processor (wrapper around existing GeminiClient)
 */
export class GeminiTranscriptionProcessor extends TranscriptionProcessor {
  private geminiClient: GeminiClient | null = null
  private options: {
    customPrompt?: string
    language?: string
  }

  constructor(
    sourceType: 'microphone' | 'system',
    onTextResponse: (text: string, turnComplete: boolean, sourceType: 'microphone' | 'system') => void,
    onSetupComplete?: () => void,
    options: { customPrompt?: string; language?: string } = {}
  ) {
    super(sourceType, onTextResponse, onSetupComplete)
    this.options = options
  }

  async connect(): Promise<void> {
    console.log(`[GeminiTranscriptionProcessor] Connecting ${this.sourceType} processor`)

    this.geminiClient = new GeminiClient(
      (text) => this.onTextResponse(text, false, this.sourceType),
      () => this.onSetupComplete?.(),
      () => {},
      () => {},
      () => {},
      'transcription',
      this.options.customPrompt,
      this.options.language
    )

    await this.geminiClient.connect()
  }

  disconnect(): void {
    console.log(`[GeminiTranscriptionProcessor] Disconnecting ${this.sourceType} processor`)

    if (this.geminiClient) {
      this.geminiClient.disconnect()
      this.geminiClient = null
    }
  }

  sendAudioChunk(chunk: string, mimeType: string): void {
    if (this.geminiClient) {
      this.geminiClient.sendMediaChunk(chunk, mimeType)
    }
  }

  isConnected(): boolean {
    return this.geminiClient !== null
  }

  getStats(): any {
    return this.geminiClient?.getStats() || {}
  }
}