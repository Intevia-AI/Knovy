import { EventEmitter } from 'events'
import type { OllamaService } from './ollamaService'

// Interface definitions based on plan specifications
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

// Batching configuration
interface BatchConfig {
  maxBatchSize: number
  maxWaitTime: number
  minBatchSize: number
}

interface PendingSegment {
  segment: TranscriptionSegment
  sessionContext: SessionContext
  timestamp: number
  isUrgent?: boolean
}

/**
 * Transcription Enhancement Service
 * Implements smart batching and progressive enhancement with local Ollama LLM
 */
export class TranscriptionEnhancementService extends EventEmitter {
  private pendingSegments = new Map<string, PendingSegment[]>() // sessionId -> segments
  private batchTimers = new Map<string, NodeJS.Timeout>() // sessionId -> timer
  private processingBatches = new Set<string>() // Track sessions currently being processed

  private readonly batchConfig: BatchConfig = {
    maxBatchSize: 3, // Smaller batches for local model (slower per segment)
    maxWaitTime: 5000, // Longer wait to accumulate more segments
    minBatchSize: 1, // Process immediately if urgent
  }

  private ollamaService: OllamaService

  constructor(ollamaService: OllamaService) {
    super()
    this.ollamaService = ollamaService
    console.log('[TranscriptionEnhancementService] Initialized with Ollama')
  }

  /**
   * Add a segment for enhancement with smart batching
   */
  enhanceSegment(
    segment: TranscriptionSegment,
    sessionContext: SessionContext,
    isUrgent = false
  ): void {
    // Skip enhancement if Ollama is not ready
    if (this.ollamaService.getStatus() !== 'ready') {
      console.log(
        `[TranscriptionEnhancementService] Skipping enhancement - Ollama status: ${this.ollamaService.getStatus()}`
      )
      return
    }

    const pendingSegment: PendingSegment = {
      segment,
      sessionContext,
      timestamp: Date.now(),
      isUrgent,
    }

    // Initialize pending segments for session if not exists
    if (!this.pendingSegments.has(sessionContext.sessionId)) {
      this.pendingSegments.set(sessionContext.sessionId, [])
    }

    const sessionSegments = this.pendingSegments.get(sessionContext.sessionId)!
    sessionSegments.push(pendingSegment)

    console.log(
      `[TranscriptionEnhancementService] Added segment for session ${sessionContext.sessionId}. Queue size: ${sessionSegments.length}`
    )

    // Determine if we should process immediately
    const shouldProcessImmediately =
      isUrgent ||
      sessionSegments.length >= this.batchConfig.maxBatchSize ||
      this.hasTimedOutSegments(sessionSegments)

    if (shouldProcessImmediately) {
      this.processBatch(sessionContext.sessionId)
    } else {
      this.scheduleProcessing(sessionContext.sessionId)
    }
  }

  /**
   * Check if any segments have timed out
   */
  private hasTimedOutSegments(segments: PendingSegment[]): boolean {
    const now = Date.now()
    return segments.some(
      (seg) => now - seg.timestamp > this.batchConfig.maxWaitTime
    )
  }

  /**
   * Schedule batch processing with timeout
   */
  private scheduleProcessing(sessionId: string): void {
    // Clear existing timer if any
    if (this.batchTimers.has(sessionId)) {
      clearTimeout(this.batchTimers.get(sessionId)!)
    }

    // Schedule new processing
    const timer = setTimeout(() => {
      this.processBatch(sessionId)
    }, this.batchConfig.maxWaitTime)

    this.batchTimers.set(sessionId, timer)
  }

  /**
   * Process a batch of segments for a session
   */
  private async processBatch(sessionId: string): Promise<void> {
    // Clear the timer
    if (this.batchTimers.has(sessionId)) {
      clearTimeout(this.batchTimers.get(sessionId)!)
      this.batchTimers.delete(sessionId)
    }

    // Prevent concurrent processing for the same session
    if (this.processingBatches.has(sessionId)) {
      console.log(`[TranscriptionEnhancementService] Already processing batch for session ${sessionId}`)
      return
    }

    const segments = this.pendingSegments.get(sessionId)
    if (!segments || segments.length === 0) {
      return
    }

    // Skip if Ollama is not ready
    if (this.ollamaService.getStatus() !== 'ready') {
      console.log(
        `[TranscriptionEnhancementService] Skipping batch - Ollama status: ${this.ollamaService.getStatus()}`
      )
      return
    }

    // Mark as processing
    this.processingBatches.add(sessionId)

    // Declare batchSegments outside try block for error handling access
    let batchSegments: PendingSegment[] = []

    try {
      console.log(`[TranscriptionEnhancementService] Processing batch of ${segments.length} segments for session ${sessionId}`)

      // Take up to maxBatchSize segments
      batchSegments = segments.splice(0, this.batchConfig.maxBatchSize)

      // Extract session context from first segment (they should all be the same session)
      const sessionContext = batchSegments[0].sessionContext

      // Call Ollama for enhancement
      const response = await this.ollamaService.enhance(
        batchSegments.map((ps) => ps.segment),
        sessionContext
      )

      if (response) {
        // Emit enhanced segments individually
        response.segments.forEach((enhancedSegment) => {
          this.emit('segmentEnhanced', {
            sessionId,
            original: batchSegments.find((ps) => ps.segment.id === enhancedSegment.id)?.segment,
            enhanced: enhancedSegment,
            processingTime: response.processingTime,
          })
        })

        // Emit errors if any
        if (response.errors && response.errors.length > 0) {
          response.errors.forEach((error) => {
            this.emit('enhancementError', {
              sessionId,
              segmentId: error.segmentId,
              error: error.error,
            })
          })
        }

        console.log(
          `[TranscriptionEnhancementService] Successfully enhanced ${response.segments.length} segments in ${response.processingTime}ms`
        )
      }

      // If there are remaining segments, schedule another batch
      if (segments.length > 0) {
        setTimeout(() => this.processBatch(sessionId), 100)
      }
    } catch (error) {
      console.error(`[TranscriptionEnhancementService] Error processing batch for session ${sessionId}:`, error)

      // Emit error for all segments in the batch
      batchSegments.forEach((ps) => {
        this.emit('enhancementError', {
          sessionId,
          segmentId: ps.segment.id,
          error: error instanceof Error ? error.message : 'Unknown error',
        })
      })
    } finally {
      // Mark as no longer processing
      this.processingBatches.delete(sessionId)
    }
  }

  /**
   * Clear pending segments for a session
   */
  clearSession(sessionId: string): void {
    if (this.batchTimers.has(sessionId)) {
      clearTimeout(this.batchTimers.get(sessionId)!)
      this.batchTimers.delete(sessionId)
    }
    this.pendingSegments.delete(sessionId)
    this.processingBatches.delete(sessionId)
    console.log(`[TranscriptionEnhancementService] Cleared session ${sessionId}`)
  }

  /**
   * Get current queue status for debugging
   */
  getQueueStatus(): Record<string, number> {
    const status: Record<string, number> = {}
    for (const [sessionId, segments] of this.pendingSegments.entries()) {
      status[sessionId] = segments.length
    }
    return status
  }

  /**
   * Cleanup service
   */
  destroy(): void {
    // Clear all timers
    for (const timer of this.batchTimers.values()) {
      clearTimeout(timer)
    }
    this.batchTimers.clear()
    this.pendingSegments.clear()
    this.processingBatches.clear()
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
