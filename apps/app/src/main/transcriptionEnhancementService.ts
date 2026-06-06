import { EventEmitter } from 'events'
import type { OllamaService } from './ollamaService'

// Interface definitions used by other modules
export interface TranscriptionSegment {
  id: string
  rawText: string
  timestamp: number
  sourceType: 'microphone' | 'system'
}

export interface SessionContext {
  sessionId: string
  conversationHistory: string[]
  userLanguage: string
}

export interface EnhancedSegment {
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

export interface EnhanceResponse {
  segments: EnhancedSegment[]
  processingTime: number
  errors?: Array<{ segmentId: string; error: string }>
}

/**
 * Transcription Enhancement Service
 * Thin wrapper around OllamaService for direct per-segment enhancement.
 * Batch logic removed - enhancement is now done inline in transcription:data handler.
 */
export class TranscriptionEnhancementService extends EventEmitter {
  private ollamaService: OllamaService

  constructor(ollamaService: OllamaService) {
    super()
    this.ollamaService = ollamaService
    console.log('[TranscriptionEnhancementService] Initialized with Ollama (direct mode)')
  }

  /**
   * Enhance a single segment directly (no batching).
   * Called from the transcription:data handler for real-time enhancement.
   */
  async enhanceSegment(
    segment: TranscriptionSegment,
    sessionContext: SessionContext
  ): Promise<EnhanceResponse> {
    if (this.ollamaService.getStatus() !== 'ready') {
      console.log(
        `[TranscriptionEnhancementService] Skipping enhancement - Ollama status: ${this.ollamaService.getStatus()}`
      )
      throw new Error(`Ollama not ready (status: ${this.ollamaService.getStatus()})`)
    }

    return await this.ollamaService.enhance([segment], sessionContext)
  }

  /**
   * Cleanup service
   */
  destroy(): void {
    this.removeAllListeners()
    console.log('[TranscriptionEnhancementService] Service destroyed')
  }
}

/**
 * Singleton instance for the enhancement service
 */
let enhancementServiceInstance: TranscriptionEnhancementService | null = null

export function getTranscriptionEnhancementService(
  ollamaService?: OllamaService
): TranscriptionEnhancementService {
  if (!enhancementServiceInstance) {
    if (!ollamaService) {
      throw new Error('OllamaService required to initialize TranscriptionEnhancementService')
    }
    enhancementServiceInstance = new TranscriptionEnhancementService(ollamaService)
  }
  return enhancementServiceInstance
}
