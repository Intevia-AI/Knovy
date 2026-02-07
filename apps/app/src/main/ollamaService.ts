import { EventEmitter } from 'events'
import type { EnhancedSegment, EnhanceResponse, TranscriptionSegment, SessionContext } from './transcriptionEnhancementService'
import { getEnhancementPrompt, getEnhancementJsonSchema } from './localLLMPrompts'

export type OllamaStatus = 'disconnected' | 'connected' | 'pulling' | 'ready' | 'error'

export interface OllamaModel {
  name: string
  size: number
  modifiedAt: string
  digest: string
}

export interface OllamaPullProgress {
  status: string
  digest?: string
  total?: number
  completed?: number
  percentage?: number
}

const OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'qwen2.5:3b'
const INFERENCE_TIMEOUT_MS = 30000

export class OllamaService extends EventEmitter {
  private status: OllamaStatus = 'disconnected'
  private activeModel: string = DEFAULT_MODEL
  private connectionCheckInterval: NodeJS.Timeout | null = null
  private inferenceQueue: Array<{
    resolve: (value: EnhanceResponse) => void
    reject: (error: Error) => void
    request: { segments: TranscriptionSegment[]; sessionContext: SessionContext }
  }> = []
  private isProcessingQueue = false

  constructor() {
    super()
    console.log('[OllamaService] Initialized')
  }

  getStatus(): OllamaStatus {
    return this.status
  }

  getActiveModel(): string {
    return this.activeModel
  }

  setActiveModel(model: string): void {
    this.activeModel = model
    console.log(`[OllamaService] Active model set to: ${model}`)
  }

  private setStatus(newStatus: OllamaStatus): void {
    if (this.status !== newStatus) {
      const oldStatus = this.status
      this.status = newStatus
      this.emit('statusChanged', { oldStatus, newStatus })
      console.log(`[OllamaService] Status changed: ${oldStatus} -> ${newStatus}`)
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(OLLAMA_BASE_URL, { signal: controller.signal })
      clearTimeout(timeout)

      if (response.ok) {
        // Check if the active model is available
        const models = await this.getModels()
        const hasActiveModel = models.some((m) => m.name === this.activeModel)
        this.setStatus(hasActiveModel ? 'ready' : 'connected')
        return true
      }

      this.setStatus('disconnected')
      return false
    } catch {
      this.setStatus('disconnected')
      return false
    }
  }

  startConnectionMonitoring(intervalMs = 30000): void {
    this.stopConnectionMonitoring()
    this.checkConnection()
    this.connectionCheckInterval = setInterval(() => {
      if (this.status === 'disconnected' || this.status === 'error') {
        this.checkConnection()
      }
    }, intervalMs)
  }

  stopConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval)
      this.connectionCheckInterval = null
    }
  }

  async getModels(): Promise<OllamaModel[]> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`)
      if (!response.ok) {
        throw new Error(`Failed to list models: ${response.status}`)
      }
      const data = await response.json()
      return (data.models || []).map((m: any) => ({
        name: m.name,
        size: m.size,
        modifiedAt: m.modified_at,
        digest: m.digest
      }))
    } catch (error) {
      console.error('[OllamaService] Failed to get models:', error)
      return []
    }
  }

  async pullModel(modelName: string): Promise<boolean> {
    const previousStatus = this.status
    this.setStatus('pulling')

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true })
      })

      if (!response.ok || !response.body) {
        throw new Error(`Pull failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const progress: OllamaPullProgress = JSON.parse(line)
            if (progress.total && progress.completed) {
              progress.percentage = Math.round((progress.completed / progress.total) * 100)
            }
            this.emit('pullProgress', { model: modelName, ...progress })
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Verify model is now available
      const models = await this.getModels()
      const pulled = models.some((m) => m.name === modelName)

      if (pulled) {
        if (modelName === this.activeModel) {
          this.setStatus('ready')
        } else {
          this.setStatus(previousStatus === 'ready' ? 'ready' : 'connected')
        }
        console.log(`[OllamaService] Successfully pulled model: ${modelName}`)
      } else {
        this.setStatus(previousStatus)
        console.error(`[OllamaService] Model not found after pull: ${modelName}`)
      }

      return pulled
    } catch (error) {
      console.error(`[OllamaService] Failed to pull model ${modelName}:`, error)
      this.setStatus(previousStatus === 'disconnected' ? 'disconnected' : 'error')
      return false
    }
  }

  async deleteModel(modelName: string): Promise<boolean> {
    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/delete`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName })
      })

      if (response.ok) {
        console.log(`[OllamaService] Deleted model: ${modelName}`)
        // Update status if we deleted the active model
        if (modelName === this.activeModel) {
          this.setStatus('connected')
        }
        return true
      }
      return false
    } catch (error) {
      console.error(`[OllamaService] Failed to delete model ${modelName}:`, error)
      return false
    }
  }

  /**
   * Enhance transcription segments using local LLM.
   * Requests are queued and processed sequentially to avoid overwhelming the local model.
   */
  async enhance(
    segments: TranscriptionSegment[],
    sessionContext: SessionContext
  ): Promise<EnhanceResponse> {
    return new Promise((resolve, reject) => {
      this.inferenceQueue.push({
        resolve,
        reject,
        request: { segments, sessionContext }
      })
      this.processQueue()
    })
  }

  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.inferenceQueue.length === 0) return
    this.isProcessingQueue = true

    while (this.inferenceQueue.length > 0) {
      const item = this.inferenceQueue.shift()!
      try {
        const result = await this.runInference(item.request.segments, item.request.sessionContext)
        item.resolve(result)
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    this.isProcessingQueue = false
  }

  private async runInference(
    segments: TranscriptionSegment[],
    sessionContext: SessionContext
  ): Promise<EnhanceResponse> {
    if (this.status !== 'ready') {
      throw new Error(`Ollama not ready (status: ${this.status})`)
    }

    const startTime = Date.now()
    const enhancedSegments: EnhancedSegment[] = []
    const errors: Array<{ segmentId: string; error: string }> = []

    for (const segment of segments) {
      try {
        const enhanced = await this.enhanceSingleSegment(segment, sessionContext)
        enhancedSegments.push(enhanced)
      } catch (error) {
        console.error(`[OllamaService] Failed to enhance segment ${segment.id}:`, error)
        errors.push({
          segmentId: segment.id,
          error: error instanceof Error ? error.message : String(error)
        })
      }
    }

    return {
      segments: enhancedSegments,
      processingTime: Date.now() - startTime,
      errors: errors.length > 0 ? errors : undefined
    }
  }

  private async enhanceSingleSegment(
    segment: TranscriptionSegment,
    sessionContext: SessionContext
  ): Promise<EnhancedSegment> {
    const prompt = getEnhancementPrompt({
      rawText: segment.rawText,
      conversationHistory: sessionContext.conversationHistory.slice(-3),
      userLanguage: sessionContext.userLanguage
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          format: getEnhancementJsonSchema(),
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 512
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama inference failed (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      const content = data.message?.content

      if (!content) {
        throw new Error('Empty response from Ollama')
      }

      const parsed = JSON.parse(content)

      return {
        id: segment.id,
        corrected: parsed.corrected || segment.rawText,
        translation: parsed.translation || undefined,
        intention: {
          primary: parsed.intention?.primary || 'statement',
          confidence: parsed.intention?.confidence ?? 0.5,
          suggestedActions: parsed.intention?.suggestedActions
        },
        keywords: parsed.keywords,
        confidence: parsed.confidence ?? 0.5
      }
    } catch (error) {
      clearTimeout(timeout)

      if (error instanceof Error && error.name === 'AbortError') {
        console.warn(`[OllamaService] Inference timed out for segment ${segment.id}`)
        // Return raw text as fallback on timeout
        return {
          id: segment.id,
          corrected: segment.rawText,
          intention: { primary: 'statement', confidence: 0.3 },
          confidence: 0.3
        }
      }

      // Retry once on non-timeout errors
      try {
        console.log(`[OllamaService] Retrying inference for segment ${segment.id}`)
        return await this.retryInference(segment, sessionContext)
      } catch {
        // Return raw text as ultimate fallback
        return {
          id: segment.id,
          corrected: segment.rawText,
          intention: { primary: 'statement', confidence: 0.3 },
          confidence: 0.3
        }
      }
    }
  }

  private async retryInference(
    segment: TranscriptionSegment,
    sessionContext: SessionContext
  ): Promise<EnhancedSegment> {
    const prompt = getEnhancementPrompt({
      rawText: segment.rawText,
      conversationHistory: sessionContext.conversationHistory.slice(-3),
      userLanguage: sessionContext.userLanguage
    })

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          format: getEnhancementJsonSchema(),
          stream: false,
          options: {
            temperature: 0.1,
            num_predict: 512
          }
        }),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        throw new Error(`Retry failed: ${response.status}`)
      }

      const data = await response.json()
      const parsed = JSON.parse(data.message?.content || '{}')

      return {
        id: segment.id,
        corrected: parsed.corrected || segment.rawText,
        translation: parsed.translation || undefined,
        intention: {
          primary: parsed.intention?.primary || 'statement',
          confidence: parsed.intention?.confidence ?? 0.5,
          suggestedActions: parsed.intention?.suggestedActions
        },
        keywords: parsed.keywords,
        confidence: parsed.confidence ?? 0.5
      }
    } catch {
      clearTimeout(timeout)
      throw new Error('Retry inference failed')
    }
  }

  destroy(): void {
    this.stopConnectionMonitoring()
    // Reject all pending queue items
    for (const item of this.inferenceQueue) {
      item.reject(new Error('OllamaService destroyed'))
    }
    this.inferenceQueue = []
    this.isProcessingQueue = false
    this.removeAllListeners()
    console.log('[OllamaService] Service destroyed')
  }
}

// Singleton
let ollamaServiceInstance: OllamaService | null = null

export function getOllamaService(): OllamaService {
  if (!ollamaServiceInstance) {
    ollamaServiceInstance = new OllamaService()
  }
  return ollamaServiceInstance
}
