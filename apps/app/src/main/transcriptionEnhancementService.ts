import { EventEmitter } from 'events'
import { randomUUID } from 'crypto'

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
 * Implements smart batching and progressive enhancement with Gemini API
 */
export class TranscriptionEnhancementService extends EventEmitter {
  private pendingSegments = new Map<string, PendingSegment[]>() // sessionId -> segments
  private batchTimers = new Map<string, NodeJS.Timeout>() // sessionId -> timer
  private processingBatches = new Set<string>() // Track sessions currently being processed

  private readonly batchConfig: BatchConfig = {
    maxBatchSize: 5, // Max segments per batch
    maxWaitTime: 3000, // Max 3 seconds wait
    minBatchSize: 1, // Process immediately if urgent
  }

  private supabaseUrl: string
  private supabaseAnonKey: string
  private userToken: string | null = null

  constructor(supabaseUrl: string, supabaseAnonKey: string) {
    super()
    this.supabaseUrl = supabaseUrl
    this.supabaseAnonKey = supabaseAnonKey
    console.log('[TranscriptionEnhancementService] Initialized')
  }

  /**
   * Set user authentication token
   */
  setUserToken(token: string): void {
    this.userToken = token
  }

  /**
   * Add a segment for enhancement with smart batching
   */
  enhanceSegment(
    segment: TranscriptionSegment,
    sessionContext: SessionContext,
    isUrgent = false
  ): void {
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

    // Mark as processing
    this.processingBatches.add(sessionId)

    try {
      console.log(`[TranscriptionEnhancementService] Processing batch of ${segments.length} segments for session ${sessionId}`)

      // Take up to maxBatchSize segments
      const batchSegments = segments.splice(0, this.batchConfig.maxBatchSize)

      // Extract session context from first segment (they should all be the same session)
      const sessionContext = batchSegments[0].sessionContext

      // Prepare request payload
      const enhanceRequest = {
        segments: batchSegments.map((ps) => ps.segment),
        sessionContext,
      }

      // Call Supabase Edge Function
      const response = await this.callEnhancementAPI(enhanceRequest)

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
          error: error.message || 'Unknown error',
        })
      })
    } finally {
      // Mark as no longer processing
      this.processingBatches.delete(sessionId)
    }
  }

  /**
   * Call the Supabase Edge Function for transcription enhancement
   */
  private async callEnhancementAPI(enhanceRequest: any): Promise<EnhanceResponse | null> {
    if (!this.userToken) {
      throw new Error('User token not set. Cannot call enhancement API.')
    }

    try {
      const response = await fetch(`${this.supabaseUrl}/functions/v1/transcription-enhance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.userToken}`,
        },
        body: JSON.stringify(enhanceRequest),
      })

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Enhancement API failed with status ${response.status}: ${errorText}`)
      }

      const result: EnhanceResponse = await response.json()
      return result
    } catch (error) {
      console.error('[TranscriptionEnhancementService] API call failed:', error)
      throw error
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
  supabaseUrl?: string,
  supabaseAnonKey?: string
): TranscriptionEnhancementService {
  if (!enhancementServiceInstance) {
    if (!supabaseUrl || !supabaseAnonKey) {
      throw new Error('Supabase configuration required to initialize TranscriptionEnhancementService')
    }
    enhancementServiceInstance = new TranscriptionEnhancementService(supabaseUrl, supabaseAnonKey)
  }
  return enhancementServiceInstance
}