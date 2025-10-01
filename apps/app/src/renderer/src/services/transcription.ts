/**
 * Transcription factory for whisper.cpp-based transcription
 * Provides unified interface for whisper-based transcription services
 */

import { getWhisperClient, WhisperClient, WhisperOptions } from './whisperClient'

export interface TranscriptionConfig {
  modelSize?: 'tiny' | 'base' | 'small' | 'medium'
  enableNoiseFiltering?: boolean
  energyThreshold?: number
  minSpeechConfidence?: number
}

export interface TranscriptionResult {
  text: string
  sourceType: 'microphone' | 'system'
  processingTime?: number
  confidence?: number
}

// Enhanced transcription interfaces
export interface EnhancedTranscription {
  id: string
  corrected: string
  translation?: string
  intention: {
    primary: 'question' | 'command' | 'statement' | 'schedule' | 'reminder' | 'concern' | 'request'
    confidence: number
    suggestedActions?: string[]
  }
  keywords?: string[]
  confidence: number
}

export interface SegmentEnhancedEvent {
  sessionId: string
  original: {
    id: string
    rawText: string
    timestamp: number
    sourceType: 'microphone' | 'system'
  }
  enhanced: EnhancedTranscription
  processingTime: number
}

export interface EnhancementErrorEvent {
  sessionId: string
  segmentId: string
  error: string
}

/**
 * Factory class for managing whisper transcription services
 */
export class TranscriptionFactory {
  private whisperClient: WhisperClient
  private config: TranscriptionConfig

  constructor(config: TranscriptionConfig) {
    this.config = config
    this.whisperClient = getWhisperClient()
  }

  /**
   * Initialize the transcription factory
   */
  async initialize(): Promise<boolean> {
    console.log('[TranscriptionFactory] Initializing whisper transcription...')

    try {
      const whisperInitialized = await this.whisperClient.initialize()

      if (whisperInitialized) {
        const isAvailable = await this.whisperClient.isAvailable()
        if (!isAvailable) {
          console.warn('[TranscriptionFactory] Whisper transcription initialized but no models available')

          // Try to ensure models are available
          const ensured = await this.whisperClient.ensureModelAvailable()
          if (!ensured) {
            console.error('[TranscriptionFactory] Failed to ensure models are available')
            return false
          }
        }

        console.log('[TranscriptionFactory] Whisper transcription ready')
        return true
      } else {
        console.error('[TranscriptionFactory] Whisper transcription initialization failed')
        return false
      }
    } catch (error) {
      console.error('[TranscriptionFactory] Whisper transcription initialization error:', error)
      return false
    }
  }

  /**
   * Setup transcription enhancement service
   */
  async setupEnhancement(supabaseUrl: string, supabaseAnonKey: string, userToken?: string): Promise<boolean> {
    try {
      const result = await window.electronAPI.transcriptionSetupEnhancement(supabaseUrl, supabaseAnonKey, userToken)
      return result.success
    } catch (error) {
      console.error('[TranscriptionFactory] Failed to setup enhancement:', error)
      return false
    }
  }

  /**
   * Update user token for enhancement service
   */
  async setEnhancementToken(token: string): Promise<boolean> {
    try {
      const result = await window.electronAPI.transcriptionSetEnhancementToken(token)
      return result.success
    } catch (error) {
      console.error('[TranscriptionFactory] Failed to set enhancement token:', error)
      return false
    }
  }

  /**
   * Subscribe to enhancement events
   */
  onSegmentEnhanced(callback: (data: SegmentEnhancedEvent) => void): () => void {
    return window.electronAPI.on('transcription:enhanced', callback)
  }

  /**
   * Subscribe to enhancement error events
   */
  onEnhancementError(callback: (error: EnhancementErrorEvent) => void): () => void {
    return window.electronAPI.on('transcription:enhancement-error', callback)
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
    console.log(`[TranscriptionFactory] Creating whisper transcription processor for ${sourceType} with auto-detection enabled`)

    return new WhisperTranscriptionProcessor(
      this.whisperClient,
      sourceType,
      onTextResponse,
      onSetupComplete,
      {
        modelSize: this.config.modelSize || 'tiny',
        language, // Keep for potential fallback scenarios
        autoDetectLanguage: true, // Enable auto-detection by default
        enableNoiseFiltering: this.config.enableNoiseFiltering,
        energyThreshold: this.config.energyThreshold,
        minSpeechConfidence: this.config.minSpeechConfidence
      }
    )
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
   * Check if whisper transcription is available
   */
  async isWhisperAvailable(): Promise<boolean> {
    try {
      return await this.whisperClient.isAvailable()
    } catch {
      return false
    }
  }


  /**
   * Get whisper client for direct access (e.g., model management)
   */
  getWhisperClient(): WhisperClient {
    return this.whisperClient
  }


  // Private methods - simplified for local-only operation
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
 * Whisper transcription processor using whisper.cpp
 */
export class WhisperTranscriptionProcessor extends TranscriptionProcessor {
  private whisperClient: WhisperClient
  private options: WhisperOptions
  private audioBuffers: ArrayBuffer[] = []
  private connected = false
  private processingStats = {
    chunksReceived: 0,
    totalProcessingTime: 0,
    transcriptionsCompleted: 0
  }
  private readonly MAX_BUFFER_SIZE = 20 // Maximum number of chunks to buffer
  private vadEventListener: ((event: CustomEvent) => void) | null = null

  constructor(
    whisperClient: WhisperClient,
    sourceType: 'microphone' | 'system',
    onTextResponse: (text: string, turnComplete: boolean, sourceType: 'microphone' | 'system') => void,
    onSetupComplete?: () => void,
    options: Omit<WhisperOptions, 'sourceType'> = {}
  ) {
    super(sourceType, onTextResponse, onSetupComplete)
    this.whisperClient = whisperClient
    this.options = {
      ...options,
      sourceType
    }

    // Setup VAD event listener for this source type
    this.setupVADListener()
  }

  private setupVADListener(): void {
    const eventName = this.sourceType === 'microphone' ? 'mic_segment' : 'system_segment'

    this.vadEventListener = (event: CustomEvent) => {
      if (event.detail?.vadTriggered && this.audioBuffers.length > 0) {
        console.log(`[WhisperTranscriptionProcessor] VAD triggered for ${this.sourceType}, processing ${this.audioBuffers.length} buffered chunks`)
        this.processBufferedAudio()
      }
    }

    window.addEventListener(eventName, this.vadEventListener as EventListener)
    console.log(`[WhisperTranscriptionProcessor] Listening for VAD events: ${eventName}`)
  }

  async connect(): Promise<void> {
    console.log(`[WhisperTranscriptionProcessor] Connecting ${this.sourceType} processor`)

    try {
      const initialized = await this.whisperClient.initialize()
      if (!initialized) {
        throw new Error('Whisper client initialization failed')
      }

      this.connected = true
      this.onSetupComplete?.()

      console.log(`[WhisperTranscriptionProcessor] ${this.sourceType} processor connected successfully`)
    } catch (error) {
      console.error(`[WhisperTranscriptionProcessor] Failed to connect ${this.sourceType} processor:`, error)
      throw error
    }
  }

  disconnect(): void {
    console.log(`[WhisperTranscriptionProcessor] Disconnecting ${this.sourceType} processor`)
    this.connected = false

    // Remove VAD event listener
    if (this.vadEventListener) {
      const eventName = this.sourceType === 'microphone' ? 'mic_segment' : 'system_segment'
      window.removeEventListener(eventName, this.vadEventListener as EventListener)
      this.vadEventListener = null
      console.log(`[WhisperTranscriptionProcessor] Removed VAD event listener: ${eventName}`)
    }

    this.audioBuffers = []
  }

  sendAudioChunk(chunk: string, mimeType: string): void {
    if (!this.connected) {
      console.warn(`[WhisperTranscriptionProcessor] Cannot send audio chunk - ${this.sourceType} processor not connected`)
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

      // Add to buffer
      this.audioBuffers.push(audioBuffer)

      // Only process by buffer size (VAD will trigger processing)
      const shouldProcessBySize = this.audioBuffers.length >= this.MAX_BUFFER_SIZE

      console.log(`[WhisperTranscriptionProcessor] ${this.sourceType} buffering status:`, {
        chunksBuffered: this.audioBuffers.length,
        shouldProcessBySize,
        waitingForVAD: !shouldProcessBySize
      })

      if (shouldProcessBySize && this.audioBuffers.length > 0) {
        console.log(`[WhisperTranscriptionProcessor] Buffer size limit reached for ${this.sourceType}, processing immediately`)
        this.processBufferedAudio()
      }
    } catch (error) {
      console.error(`[WhisperTranscriptionProcessor] Error processing audio chunk for ${this.sourceType}:`, error)
    }
  }

  isConnected(): boolean {
    return this.connected
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

  private processBufferedAudio(): void {
    if (this.audioBuffers.length === 0) return

    console.log(`[WhisperTranscriptionProcessor] Processing ${this.audioBuffers.length} buffered chunks for ${this.sourceType}`)

    // Combine all buffered audio chunks into one ArrayBuffer
    const combinedBuffer = this.combineAudioBuffers(this.audioBuffers)

    // Clear the buffer
    this.audioBuffers = []

    // Process the combined audio
    this.processAudioBuffer(combinedBuffer)
  }

  private combineAudioBuffers(buffers: ArrayBuffer[]): ArrayBuffer {
    // Calculate total length
    const totalLength = buffers.reduce((sum, buffer) => sum + buffer.byteLength, 0)

    // Create combined buffer
    const combined = new Uint8Array(totalLength)
    let offset = 0

    // Copy all buffers
    for (const buffer of buffers) {
      combined.set(new Uint8Array(buffer), offset)
      offset += buffer.byteLength
    }

    return combined.buffer
  }

  private async processAudioBuffer(audioBuffer: ArrayBuffer): Promise<void> {
    try {
      const result = await this.whisperClient.transcribeAudio(audioBuffer, this.options)

      this.processingStats.transcriptionsCompleted++
      this.processingStats.totalProcessingTime += result.processingTime

      if (result.text && result.text.trim()) {
        console.log(`[WhisperTranscriptionProcessor] Got transcription for ${this.sourceType}: "${result.text}"`)

        // Extract keywords from the transcription for highlighting
        const keywords = this.extractKeywords(result.text.trim())

        // Format the response to match the expected UI format for compatibility
        // The UI parser expects "TRANSCRIPTION:" prefix and optionally "KEYWORDS:"
        const formattedResponse = `TRANSCRIPTION: ${result.text.trim()}\nKEYWORDS: ${keywords.join(', ')}`

        console.log(`[WhisperTranscriptionProcessor] Sending formatted response with ${keywords.length} keywords: "${formattedResponse}"`)
        this.onTextResponse(formattedResponse, true, this.sourceType)
      } else {
        console.log(`[WhisperTranscriptionProcessor] Empty transcription result for ${this.sourceType} (${audioBuffer.byteLength} bytes, ${result.processingTime}ms)`)
      }
    } catch (error) {
      console.error(`[WhisperTranscriptionProcessor] Transcription failed for ${this.sourceType}:`, error)

      // Handle model missing error specifically
      if (error instanceof Error && error.message.includes('No whisper models available')) {
        console.error(`[WhisperTranscriptionProcessor] Models were deleted during session - attempting recovery`)

        // Notify the main app about the model error
        if ((window as any).electronAPI?.send) {
          (window as any).electronAPI.send('transcription:model-error', {
            sourceType: this.sourceType,
            error: error.message
          })
        }

        await this.handleModelMissingError()
      } else if (error instanceof Error && error.message.includes('whisper.cpp binary')) {
        console.error(`[WhisperTranscriptionProcessor] Binary error during transcription`)
        this.notifyUserOfTranscriptionError('Local transcription unavailable - binary error')
      } else {
        // Generic transcription error
        this.notifyUserOfTranscriptionError('Transcription temporarily unavailable')
      }
    }
  }

  /**
   * Handle the case where models are missing during active transcription
   */
  private async handleModelMissingError(): Promise<void> {
    try {
      console.log(`[WhisperTranscriptionProcessor] Attempting to recover from missing models...`)

      // Try to re-initialize and download models
      const initialized = await this.whisperClient.initialize()
      if (initialized) {
        const ensured = await this.whisperClient.ensureModelAvailable()
        if (ensured) {
          console.log(`[WhisperTranscriptionProcessor] Successfully recovered models for ${this.sourceType}`)
          this.notifyUserOfTranscriptionError('Model recovered - transcription resumed', 'info')
          return
        }
      }

      // If recovery fails, notify user
      console.error(`[WhisperTranscriptionProcessor] Failed to recover models for ${this.sourceType}`)
      this.notifyUserOfTranscriptionError('Local transcription models missing - please restart the app')
    } catch (error) {
      console.error(`[WhisperTranscriptionProcessor] Error during model recovery:`, error)
      this.notifyUserOfTranscriptionError('Unable to recover transcription - please restart the app')
    }
  }

  /**
   * Notify user of transcription errors through the UI
   */
  private notifyUserOfTranscriptionError(message: string, type: 'error' | 'warning' | 'info' = 'error'): void {
    // Send a formatted error message that the UI can display
    const errorResponse = `TRANSCRIPTION: [${type.toUpperCase()}] ${message}\nKEYWORDS: error, ${type}`

    console.warn(`[WhisperTranscriptionProcessor] Notifying user of ${type}: ${message}`)
    this.onTextResponse(errorResponse, true, this.sourceType)
  }

  /**
   * Extract keywords from transcription text
   * Identifies technical terms, specialized vocabulary, and complex concepts
   */
  private extractKeywords(text: string): string[] {
    const keywords: string[] = []

    // Common technical/specialized vocabulary patterns
    const technicalPatterns = [
      // Technology terms
      /\b(?:API|SDK|UI|UX|HTTP|URL|DNS|VPN|CPU|GPU|RAM|SSD|AI|ML|IoT|AR|VR)\b/gi,
      // Programming terms
      /\b(?:function|variable|array|object|database|server|client|frontend|backend|algorithm|encryption|authentication|authorization)\b/gi,
      // Business/financial terms
      /\b(?:revenue|profit|margin|ROI|KPI|analytics|metrics|dashboard|pipeline|workflow|optimization|strategy)\b/gi,
      // Scientific terms
      /\b(?:hypothesis|experiment|analysis|methodology|protocol|parameters|variables|correlation|significance|variance)\b/gi,
      // Complex compound words (3+ syllables, technical-sounding)
      /\b[a-z]+(?:tion|sion|ment|ness|ship|hood|ward|wise|like|able|ible|ical|ous|ive|ful|less|ing|ed|er|est|ly)\b/gi
    ]

    // Words that are typically complex/technical
    const complexWords = text.toLowerCase().split(/\s+/).filter(word => {
      // Remove punctuation
      word = word.replace(/[^\w]/g, '')

      // Skip common words, short words, and numbers
      if (word.length < 4 || /^\d+$/.test(word)) return false

      // Common words to exclude
      const commonWords = new Set([
        'that', 'this', 'with', 'have', 'will', 'from', 'they', 'been', 'said', 'each', 'which',
        'their', 'time', 'would', 'there', 'could', 'other', 'after', 'first', 'well', 'also',
        'some', 'very', 'what', 'know', 'just', 'into', 'over', 'think', 'also', 'back', 'work',
        'good', 'much', 'before', 'right', 'through', 'still', 'should', 'never', 'here', 'more',
        'need', 'come', 'take', 'make', 'want', 'about', 'when', 'where', 'being', 'going'
      ])

      if (commonWords.has(word)) return false

      // Include words that are likely technical/specialized
      // Long words (6+ chars) that aren't common
      // Words with technical suffixes
      // Words with multiple syllables and technical patterns
      return word.length >= 6 ||
             /(?:tion|sion|ment|ness|ship|hood|ward|wise|like|able|ible|ical|ous|ive|ful|less)$/.test(word) ||
             /^(?:auto|bio|geo|micro|nano|multi|inter|trans|pre|post|anti|pro|meta)/.test(word)
    })

    // Apply technical patterns
    for (const pattern of technicalPatterns) {
      const matches = text.match(pattern)
      if (matches) {
        keywords.push(...matches.map(match => match.toLowerCase()))
      }
    }

    // Add complex words
    keywords.push(...complexWords)

    // Remove duplicates and return limited set
    const uniqueKeywords = [...new Set(keywords)]
      .filter(keyword => keyword.trim().length > 0)
      .slice(0, 5) // Limit to 5 keywords max for performance

    return uniqueKeywords
  }
}


