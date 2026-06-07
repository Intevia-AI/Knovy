import { EventEmitter } from 'events'
import type { TranscriptionSegment, SessionContext } from './transcriptionEnhancementService'
import { getCorrectionPrompt } from './localLLMPrompts'
import { parseNdjsonStream } from './ndjsonStream'

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
const DEFAULT_MODEL = 'gemma3:4b'
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

export interface EnhanceStreamOptions {
  onToken: (chunk: string) => void
  signal: AbortSignal
}

type QueueItem =
  | {
      type: 'enhanceStream'
      resolve: (value: string) => void
      reject: (error: Error) => void
      request: {
        segment: TranscriptionSegment
        sessionContext: SessionContext
        options: EnhanceStreamOptions
      }
    }
  | {
      type: 'chat'
      resolve: (value: ChatResponse) => void
      reject: (error: Error) => void
      request: ChatParams
    }

export class OllamaService extends EventEmitter {
  private status: OllamaStatus = 'disconnected'
  private activeModel: string = DEFAULT_MODEL
  private connectionCheckInterval: NodeJS.Timeout | null = null
  private inferenceQueue: QueueItem[] = []
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
        const hasActiveModel = models.some((m) => {
          if (m.name === this.activeModel) return true
          const normalize = (name: string) => name.replace(/:latest$/, '')
          return normalize(m.name) === normalize(this.activeModel)
        })
        const newStatus = hasActiveModel ? 'ready' : 'connected'
        if (!hasActiveModel) {
          const availableNames = models.map((m) => m.name).join(', ')
          console.log(
            `[OllamaService] Model "${this.activeModel}" not found. Available: [${availableNames}]`
          )
        }
        console.log(
          `[OllamaService] Connection check: server=OK, model=${this.activeModel}, available=${hasActiveModel}, status=${newStatus}`
        )
        this.setStatus(newStatus)
        return true
      }

      console.log('[OllamaService] Connection check: server responded but not OK')
      this.setStatus('disconnected')
      return false
    } catch {
      console.log('[OllamaService] Connection check: server not reachable')
      this.setStatus('disconnected')
      return false
    }
  }

  startConnectionMonitoring(intervalMs = 30000): void {
    this.stopConnectionMonitoring()
    this.checkConnection()
    this.connectionCheckInterval = setInterval(() => {
      if (this.status !== 'ready' && this.status !== 'pulling') {
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
   * Stream a plain-text correction for one segment.
   * Queued sequentially like chat(). Resolves with the full corrected text.
   * onToken fires for each streamed chunk.
   *
   * Cancellation: honors options.signal and an internal inactivity timeout that
   * resets on every token (detects connection AND inter-token stalls). On cancel
   * or stall the returned promise REJECTS with an error whose `name` is
   * 'AbortError' — callers should treat that as a cancellation, not a failure.
   */
  async enhanceStream(
    segment: TranscriptionSegment,
    sessionContext: SessionContext,
    options: EnhanceStreamOptions
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      this.inferenceQueue.push({
        type: 'enhanceStream',
        resolve,
        reject,
        request: { segment, sessionContext, options }
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
        if (item.type === 'enhanceStream') {
          const result = await this.runStreamingCorrection(
            item.request.segment,
            item.request.sessionContext,
            item.request.options
          )
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
    if (this.status !== 'ready') {
      throw new Error(`Ollama not ready (status: ${this.status})`)
    }

    const startTime = Date.now()
    console.log(
      `[OllamaService] Running chat: ${params.messages.length} message(s), model=${this.activeModel}`
    )

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), CHAT_TIMEOUT_MS)

    try {
      const body: Record<string, any> = {
        model: this.activeModel,
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

  private async runStreamingCorrection(
    segment: TranscriptionSegment,
    sessionContext: SessionContext,
    options: EnhanceStreamOptions
  ): Promise<string> {
    if (this.status !== 'ready') {
      throw new Error(`Ollama not ready (status: ${this.status})`)
    }
    // Already cancelled before our turn in the queue: stop immediately.
    if (options.signal.aborted) {
      throw Object.assign(new Error('Aborted'), { name: 'AbortError' })
    }

    const prompt = getCorrectionPrompt({
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
      const response = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: this.activeModel,
          messages: [
            { role: 'system', content: prompt.system },
            { role: 'user', content: prompt.user }
          ],
          stream: true,
          options: { temperature: 0.1, num_predict: 512 }
        }),
        signal: controller.signal
      })

      if (!response.ok || !response.body) {
        throw new Error(`Ollama stream failed: ${response.status}`)
      }

      let full = ''
      for await (const obj of parseNdjsonStream(response.body)) {
        clearTimeout(inactivity)
        inactivity = setTimeout(() => controller.abort(), INFERENCE_TIMEOUT_MS)
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
