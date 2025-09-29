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
    enableNoiseFiltering?: boolean
    energyThreshold?: number
    minSpeechConfidence?: number
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
          language,
          enableNoiseFiltering: this.config.localOptions?.enableNoiseFiltering,
          energyThreshold: this.config.localOptions?.energyThreshold,
          minSpeechConfidence: this.config.localOptions?.minSpeechConfidence
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
  private audioBuffers: ArrayBuffer[] = []
  private connected = false
  private processingStats = {
    chunksReceived: 0,
    totalProcessingTime: 0,
    transcriptionsCompleted: 0
  }
  private lastProcessTime = 0
  private readonly BUFFER_DURATION_MS = 5000 // Process every 5 seconds
  private readonly MAX_BUFFER_SIZE = 20 // Maximum number of chunks to buffer

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

      this.connected = true
      this.lastProcessTime = Date.now() // Initialize timing for buffering
      this.onSetupComplete?.()

      console.log(`[LocalTranscriptionProcessor] ${this.sourceType} processor connected successfully`)
    } catch (error) {
      console.error(`[LocalTranscriptionProcessor] Failed to connect ${this.sourceType} processor:`, error)
      throw error
    }
  }

  disconnect(): void {
    console.log(`[LocalTranscriptionProcessor] Disconnecting ${this.sourceType} processor`)
    this.connected = false
    this.audioBuffers = []
    this.lastProcessTime = 0
  }

  sendAudioChunk(chunk: string, mimeType: string): void {
    if (!this.connected) {
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

      // Add to buffer
      this.audioBuffers.push(audioBuffer)

      // Check if we should process buffered audio
      const now = Date.now()
      const timeSinceLastProcess = now - this.lastProcessTime
      const shouldProcessByTime = timeSinceLastProcess >= this.BUFFER_DURATION_MS
      const shouldProcessBySize = this.audioBuffers.length >= this.MAX_BUFFER_SIZE

      console.log(`[LocalTranscriptionProcessor] ${this.sourceType} buffering status:`, {
        chunksBuffered: this.audioBuffers.length,
        timeSinceLastProcess: `${timeSinceLastProcess}ms`,
        shouldProcessByTime,
        shouldProcessBySize
      })

      if ((shouldProcessByTime || shouldProcessBySize) && this.audioBuffers.length > 0) {
        this.processBufferedAudio()
        this.lastProcessTime = now
      }
    } catch (error) {
      console.error(`[LocalTranscriptionProcessor] Error processing audio chunk for ${this.sourceType}:`, error)
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

    console.log(`[LocalTranscriptionProcessor] Processing ${this.audioBuffers.length} buffered chunks for ${this.sourceType}`)

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
      const result = await this.localClient.transcribeAudio(audioBuffer, this.options)

      this.processingStats.transcriptionsCompleted++
      this.processingStats.totalProcessingTime += result.processingTime

      if (result.text && result.text.trim()) {
        console.log(`[LocalTranscriptionProcessor] Got transcription for ${this.sourceType}: "${result.text}"`)

        // Extract keywords from the transcription for highlighting
        const keywords = this.extractKeywords(result.text.trim())

        // Format the response to match the expected Gemini format for UI compatibility
        // The UI parser expects "TRANSCRIPTION:" prefix and optionally "KEYWORDS:"
        const formattedResponse = `TRANSCRIPTION: ${result.text.trim()}\nKEYWORDS: ${keywords.join(', ')}`

        console.log(`[LocalTranscriptionProcessor] Sending formatted response with ${keywords.length} keywords: "${formattedResponse}"`)
        this.onTextResponse(formattedResponse, true, this.sourceType)
      } else {
        console.log(`[LocalTranscriptionProcessor] Empty transcription result for ${this.sourceType} (${audioBuffer.byteLength} bytes, ${result.processingTime}ms)`)
      }
    } catch (error) {
      console.error(`[LocalTranscriptionProcessor] Transcription failed for ${this.sourceType}:`, error)
    }
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