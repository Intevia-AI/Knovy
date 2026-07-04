import { EventEmitter } from 'events'
import { Converter } from 'opencc-js'
import type { TranscriptionSegment, SessionContext } from './transcriptionEnhancementService'
import { getCorrectionPrompt } from './localLLMPrompts'
import { parseNdjsonStream } from './ndjsonStream'
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

// Any Chinese the model emits must reach the UI as Traditional. s2tw is a
// no-op on English/already-Traditional text, so it runs unconditionally.
const s2twConverter = Converter({ from: 'cn', to: 'tw' })

const OLLAMA_BASE_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'qwen3.5:0.8b'
const INFERENCE_TIMEOUT_MS = 30000
const CHAT_TIMEOUT_MS = 60000

export interface ChatParams {
  messages: Array<{ role: string; content: string; images?: string[] }>
  format?: object
  temperature?: number
  maxTokens?: number
  think?: boolean
}

export interface ChatResponse {
  content: string
  processingTime: number
}

export interface EnhanceStreamOptions {
  onToken: (chunk: string) => void
  onThinking?: () => void
  signal: AbortSignal
}

interface CorrectionItem {
  resolve: (value: string) => void
  reject: (error: Error) => void
  request: {
    segment: TranscriptionSegment
    sessionContext: SessionContext
    options: EnhanceStreamOptions
  }
}

interface ChatItem {
  resolve: (value: ChatResponse) => void
  reject: (error: Error) => void
  request: ChatParams
}

// ponytail: two lanes, fixed concurrency — corrections run up to
// CORRECTION_CONCURRENCY at once; chat stays serial. Bump if profiling
// shows GPU headroom on the local model.
const CORRECTION_CONCURRENCY = 2

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
  // Corrections lane: FIFO starts, up to CORRECTION_CONCURRENCY in flight.
  private correctionQueue: CorrectionItem[] = []
  private activeCorrections = 0
  // Chat lane: FIFO, one at a time. Independent of the corrections lane so
  // neither blocks the other.
  private chatQueue: ChatItem[] = []
  private chatBusy = false
  private thinkEnabled = false

  constructor() {
    super()
    console.log('[OllamaService] Initialized')
  }

  getModelState(): ModelState {
    return { ...this.modelState }
  }

  getThinkEnabled(): boolean {
    return this.thinkEnabled
  }

  setThinkEnabled(enabled: boolean): void {
    this.thinkEnabled = enabled
    console.log(`[OllamaService] Think mode: ${enabled ? 'on' : 'off'}`)
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
   * Queued on the corrections lane, which runs up to CORRECTION_CONCURRENCY
   * at a time. Corrections may complete out of order — callers track results
   * per transcriptId, so start order (FIFO) is all that's preserved here.
   */
  async enhanceStream(
    segment: TranscriptionSegment,
    sessionContext: SessionContext,
    options: EnhanceStreamOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.correctionQueue.push({ resolve, reject, request: { segment, sessionContext, options } })
      this.pumpCorrections()
    })
  }

  /**
   * General-purpose chat with local LLM.
   * Supports multimodal (images), structured output (format), configurable temperature.
   * Runs on its own serial lane so chat and corrections never block each other.
   */
  async chat(params: ChatParams): Promise<ChatResponse> {
    return new Promise((resolve, reject) => {
      this.chatQueue.push({ resolve, reject, request: params })
      this.pumpChat()
    })
  }

  private pumpCorrections(): void {
    while (this.activeCorrections < CORRECTION_CONCURRENCY && this.correctionQueue.length > 0) {
      const item = this.correctionQueue.shift()!
      this.activeCorrections++
      this.runStreamingCorrection(
        item.request.segment,
        item.request.sessionContext,
        item.request.options
      )
        .then(item.resolve, (error) =>
          item.reject(error instanceof Error ? error : new Error(String(error)))
        )
        .finally(() => {
          this.activeCorrections--
          this.pumpCorrections()
        })
    }
  }

  private pumpChat(): void {
    if (this.chatBusy || this.chatQueue.length === 0) return
    this.chatBusy = true
    const item = this.chatQueue.shift()!
    this.runChat(item.request)
      .then(item.resolve, (error) =>
        item.reject(error instanceof Error ? error : new Error(String(error)))
      )
      .finally(() => {
        this.chatBusy = false
        this.pumpChat()
      })
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

      const shouldThink = params.think !== undefined ? params.think : this.thinkEnabled
      if (!shouldThink) {
        body.think = false
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

      return { content: s2twConverter(content), processingTime: elapsed }
    } catch (error) {
      clearTimeout(timeout)

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Ollama chat timed out')
      }
      throw error
    }
  }

  private async runStreamingCorrection(
    segment: TranscriptionSegment,
    sessionContext: SessionContext,
    options: EnhanceStreamOptions
  ): Promise<string> {
    if (this.modelState.phase !== 'ready') {
      throw new Error(`Ollama not ready (phase: ${this.modelState.phase})`)
    }
    // Already cancelled before our turn in the queue: stop immediately.
    if (options.signal.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
    }

    const messages = getCorrectionPrompt({
      rawText: segment.rawText,
      conversationHistory: sessionContext.conversationHistory.slice(-3),
      userLanguage: sessionContext.userLanguage
    })

    // Inactivity timeout: abort if no token arrives within INFERENCE_TIMEOUT_MS.
    const controller = new AbortController()
    const onExternalAbort = () => controller.abort()
    options.signal.addEventListener('abort', onExternalAbort)
    let inactivity = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)

    try {
      // Correction never thinks, regardless of the user's think toggle: it runs
      // per-utterance on a sequential queue, and thinking inflates a one-sentence
      // fix to minutes. The toggle only governs runChat (chat/recommend/deep/etc.).
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.modelState.model,
          messages,
          stream: true,
          options: { temperature: 0.1, num_predict: 512 },
          think: false
        }),
        signal: controller.signal
      })

      if (!response.ok || !response.body) {
        throw new Error(`Ollama stream failed: ${response.status}`)
      }

      let full = ''
      let notifiedThinking = false
      for await (const obj of parseNdjsonStream(response.body)) {
        clearTimeout(inactivity)
        inactivity = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)
        if (obj?.message?.thinking && !notifiedThinking) {
          notifiedThinking = true
          options.onThinking?.()
        }
        const chunk: string = obj?.message?.content ?? ''
        if (chunk) {
          full += chunk
          options.onToken(chunk)
        }
        if (obj?.done) break
      }
      return full
    } finally {
      clearTimeout(inactivity)
      options.signal.removeEventListener('abort', onExternalAbort)
    }
  }

  destroy(): void {
    this.stopConnectionMonitoring()
    // Reject all pending queued items in both lanes (in-flight ones settle
    // on their own).
    for (const item of [...this.correctionQueue, ...this.chatQueue]) {
      item.reject(new Error('OllamaService destroyed'))
    }
    this.correctionQueue = []
    this.chatQueue = []
    this.activeCorrections = 0
    this.chatBusy = false
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
