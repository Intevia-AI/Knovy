import { EventEmitter } from 'events'
import type {
  EnhancedSegment,
  EnhanceResponse,
  TranscriptionSegment,
  SessionContext
} from './transcriptionEnhancementService'
import { getEnhancementPrompt, getEnhancementJsonSchema } from './localLLMPrompts'
import { classifyPullError, mapOllamaPullStatus, type PullErrorKind } from './ollamaErrors'

export type ModelPhase = 'idle' | 'downloading' | 'verifying' | 'ready' | 'error'

export interface ModelStateError {
  kind: PullErrorKind
  raw: string
}

export interface ModelState {
  phase: ModelPhase
  model: string
  progress: number
  reachable: boolean
  error: ModelStateError | null
  pendingModel: string | null
}

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
const DEFAULT_MODEL = 'gemma4:e2b'
const INFERENCE_TIMEOUT_MS = 30000
const CHAT_TIMEOUT_MS = 60000

export interface ChatParams {
  messages: Array<{ role: string; content: string; images?: string[] }>
  format?: object
  temperature?: number
  maxTokens?: number
}

export interface ChatResponse {
  content: string
  processingTime: number
}

type QueueItem =
  | {
      type: 'enhance'
      resolve: (value: EnhanceResponse) => void
      reject: (error: Error) => void
      request: { segments: TranscriptionSegment[]; sessionContext: SessionContext }
    }
  | {
      type: 'chat'
      resolve: (value: ChatResponse) => void
      reject: (error: Error) => void
      request: ChatParams
    }

export class OllamaService extends EventEmitter {
  private modelState: ModelState = {
    phase: 'idle',
    model: DEFAULT_MODEL,
    progress: 0,
    reachable: false,
    error: null,
    pendingModel: null
  }
  private connectionCheckInterval: NodeJS.Timeout | null = null
  private currentPull: AbortController | null = null
  private inferenceQueue: QueueItem[] = []
  private isProcessingQueue = false

  constructor() {
    super()
    console.log('[OllamaService] Initialized')
  }

  getModelState(): ModelState {
    return { ...this.modelState }
  }

  getActiveModel(): string {
    return this.modelState.model
  }

  setActiveModel(model: string): void {
    this.setModelState({ model })
    console.log(`[OllamaService] Active model set to: ${model}`)
  }

  setPendingModel(model: string | null): void {
    this.setModelState({ pendingModel: model })
  }

  private setModelState(patch: Partial<ModelState>): void {
    const next = { ...this.modelState, ...patch }
    const changed = (Object.keys(patch) as (keyof ModelState)[]).some(
      (k) => this.modelState[k] !== next[k]
    )
    this.modelState = next
    if (changed) {
      this.emit('modelState', this.getModelState())
    }
  }

  async checkConnection(): Promise<boolean> {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 5000)

      const response = await fetch(OLLAMA_BASE_URL, { signal: controller.signal })
      clearTimeout(timeout)

      if (response.ok) {
        const models = await this.getModels()
        const normalize = (name: string) => name.replace(/:latest$/, '')
        const hasActiveModel = models.some(
          (m) => normalize(m.name) === normalize(this.modelState.model)
        )
        // Don't clobber an in-flight download with a connection check.
        if (this.modelState.phase === 'downloading' || this.modelState.phase === 'verifying') {
          this.setModelState({ reachable: true })
          return true
        }
        this.setModelState({
          reachable: true,
          phase: hasActiveModel ? 'ready' : 'idle',
          progress: hasActiveModel ? 100 : 0,
          error: null
        })
        console.log(
          `[OllamaService] Connection check: server=OK, model=${this.modelState.model}, available=${hasActiveModel}`
        )
        return true
      }

      this.setModelState({ reachable: false })
      return false
    } catch {
      console.log('[OllamaService] Connection check: server not reachable')
      this.setModelState({ reachable: false })
      return false
    }
  }

  startConnectionMonitoring(intervalMs = 30000): void {
    this.stopConnectionMonitoring()
    this.checkConnection()
    this.connectionCheckInterval = setInterval(() => {
      const phase = this.modelState.phase
      if (phase !== 'downloading' && phase !== 'verifying') {
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
    // Supersede any in-flight pull (rapid toggling).
    if (this.currentPull) {
      this.currentPull.abort()
      this.currentPull = null
    }
    const controller = new AbortController()
    this.currentPull = controller

    this.setModelState({ phase: 'downloading', model: modelName, progress: 0, error: null })

    try {
      const response = await fetch(`${OLLAMA_BASE_URL}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: modelName, stream: true }),
        signal: controller.signal
      })

      if (!response.ok || !response.body) {
        throw new Error(`Pull failed: ${response.status}`)
      }

      const reader = response.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        // A newer selection superseded this pull — stop processing stale stream.
        if (this.currentPull !== controller) {
          return false
        }

        const lines = decoder.decode(value, { stream: true }).split('\n').filter(Boolean)
        for (const line of lines) {
          try {
            const progress: OllamaPullProgress = JSON.parse(line)
            const patch: Partial<ModelState> = {}
            if (progress.total && progress.completed) {
              patch.progress = Math.round((progress.completed / progress.total) * 100)
            }
            const mapped = progress.status ? mapOllamaPullStatus(progress.status) : null
            if (mapped) patch.phase = mapped
            if (Object.keys(patch).length > 0) this.setModelState(patch)
          } catch {
            // Skip malformed JSON lines
          }
        }
      }

      // Verify the model is now available.
      this.setModelState({ phase: 'verifying' })
      const models = await this.getModels()
      const pulled = models.some((m) => m.name === modelName)

      if (pulled) {
        this.setModelState({ phase: 'ready', progress: 100, error: null })
        console.log(`[OllamaService] Successfully pulled model: ${modelName}`)
      } else {
        this.setModelState({
          phase: 'error',
          error: { kind: 'generic', raw: 'Model not found after pull' }
        })
        console.error(`[OllamaService] Model not found after pull: ${modelName}`)
      }
      return pulled
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        console.log(`[OllamaService] Pull aborted: ${modelName}`)
        // Re-derive state from server; don't leave a stuck "downloading".
        await this.checkConnection()
        return false
      }
      const raw = error instanceof Error ? error.message : String(error)
      console.error(`[OllamaService] Failed to pull model ${modelName}:`, error)
      this.setModelState({ phase: 'error', error: { kind: classifyPullError(raw), raw } })
      return false
    } finally {
      if (this.currentPull === controller) this.currentPull = null
    }
  }

  cancelPull(): void {
    if (this.currentPull) {
      console.log('[OllamaService] Cancelling in-flight pull')
      this.currentPull.abort()
      this.currentPull = null
      // Clear the in-flight phase synchronously so checkConnection()'s
      // "don't clobber a download" guard doesn't skip re-deriving the state
      // (otherwise the phase stays stuck on 'downloading' after a cancel).
      this.setModelState({ phase: 'idle', progress: 0 })
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
        if (modelName === this.modelState.model) {
          this.setModelState({ phase: 'idle', progress: 0 })
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
        type: 'enhance',
        resolve,
        reject,
        request: { segments, sessionContext }
      })
      this.processQueue()
    })
  }

  /**
   * General-purpose chat with local LLM.
   * Supports multimodal (images), structured output (format), configurable temperature.
   * Queued sequentially like enhance() to avoid overwhelming the local model.
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    return new Promise((resolve, reject) => {
      this.inferenceQueue.push({
        type: 'chat',
        resolve,
        reject,
        request: params
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
        if (item.type === 'enhance') {
          const result = await this.runInference(item.request.segments, item.request.sessionContext)
          item.resolve(result)
        } else {
          const result = await this.runChat(item.request)
          item.resolve(result)
        }
      } catch (error) {
        item.reject(error instanceof Error ? error : new Error(String(error)))
      }
    }

    this.isProcessingQueue = false
  }

  private async runChat(params: ChatParams): Promise<ChatResponse> {
    if (this.modelState.phase !== 'ready') {
      throw new Error(`Ollama not ready (phase: ${this.modelState.phase})`)
    }

    const startTime = Date.now()
    console.log(
      `[OllamaService] Running chat: ${params.messages.length} message(s), model=${this.modelState.model}`
    )

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

    try {
      const body: Record<string, any> = {
        model: this.modelState.model,
        messages: params.messages,
        stream: false,
        options: {
          temperature: params.temperature ?? 0.7,
          num_predict: params.maxTokens ?? 2048
        }
      }

      if (params.format) {
        body.format = params.format
      }

      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: controller.signal
      })

      clearTimeout(timeout)

      if (!response.ok) {
        const errorText = await response.text()
        throw new Error(`Ollama chat failed (${response.status}): ${errorText}`)
      }

      const data = await response.json()
      const content = data.message?.content

      if (!content) {
        throw new Error('Empty response from Ollama')
      }

      const elapsed = Date.now() - startTime
      console.log(`[OllamaService] Chat complete: ${elapsed}ms, ${content.length} chars`)

      return { content, processingTime: elapsed }
    } catch (error) {
      clearTimeout(timeout)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Ollama chat timed out')
      }
      throw error
    }
  }

  private async runInference(
    segments: TranscriptionSegment[],
    sessionContext: SessionContext
  ): Promise<EnhanceResponse> {
    if (this.modelState.phase !== 'ready') {
      throw new Error(`Ollama not ready (phase: ${this.modelState.phase})`)
    }

    console.log(
      `[OllamaService] Running inference: ${segments.length} segment(s), model=${this.modelState.model}, lang=${sessionContext.userLanguage}`
    )
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

    const elapsed = Date.now() - startTime
    console.log(
      `[OllamaService] Inference complete: ${enhancedSegments.length} enhanced, ${errors.length} errors, ${elapsed}ms`
    )
    return {
      segments: enhancedSegments,
      processingTime: elapsed,
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
          model: this.modelState.model,
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

      console.log(
        `[OllamaService] Segment ${segment.id}: "${segment.rawText.substring(0, 50)}..." → "${(parsed.corrected || segment.rawText).substring(0, 50)}..." (${parsed.intention?.primary}, conf=${parsed.confidence})`
      )

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
          model: this.modelState.model,
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
