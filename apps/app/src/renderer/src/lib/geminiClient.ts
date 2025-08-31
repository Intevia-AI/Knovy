/**
 * @fileoverview WebSocket client for connecting to Gemini AI proxy server.
 * Handles real-time audio streaming, transcription, and AI response generation
 * with automatic reconnection and error handling capabilities.
 */

const PROXY_SERVER_URL = import.meta.env.VITE_GEMINI_WS_URL || 'ws://localhost:4568'
console.log(PROXY_SERVER_URL)

/**
 * WebSocket client for Gemini AI proxy server communication.
 * Provides real-time audio streaming, transcription, and AI response capabilities
 * with automatic reconnection, error handling, and multiple operation modes.
 *
 * @class GeminiClient
 */
export class GeminiClient {
  /** @type {WebSocket|null} WebSocket connection instance */
  private ws: WebSocket | null = null

  private _isConnected: boolean = false

  public get isConnected(): boolean {
    return this._isConnected && this.ws?.readyState === WebSocket.OPEN
  }

  /** @type {boolean} Setup completion status flag */
  private isSetupComplete: boolean = false

  /** @type {Function|null} Callback for AI response messages */
  private onMessageCallback: ((text: string, turnComplete: boolean) => void) | null = null

  /** @type {Function|null} Callback for setup completion */
  private onSetupCompleteCallback: (() => void) | null = null

  /** @type {Function|null} Callback for audio playing state changes */
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null

  /** @type {Function|null} Callback for audio level changes */
  private onAudioLevelChange: ((level: number) => void) | null = null

  /** @type {Function|null} Callback for transcription results */
  private onTranscriptionCallback: ((text: string) => void) | null = null

  /** @type {number} Current number of reconnection attempts */
  private reconnectAttempts: number = 0

  /** @type {number} Maximum allowed reconnection attempts */
  private maxReconnectAttempts: number = 5

  /** @type {number} Base timeout for reconnection attempts in milliseconds */
  private reconnectTimeout: number = 1000

  /** @type {string} Buffer for streaming text responses */
  private streamingBuffer: string = ''

  /** @type {"transcription"|"answer"} Current operation mode */
  private mode: 'transcription' | 'answer'

  /** @type {string|null} Custom AI prompt for responses */
  private customPrompt: string | null = null

  /** @type {string|undefined} User's preferred language setting */
  private language?: string

  private transcriptionQueue: string[] = []
  private processingInterval: number | null = null

  constructor(
    onMessage: (text: string, turnComplete: boolean) => void,
    onSetupComplete: () => void,
    onPlayingStateChange: (isPlaying: boolean) => void,
    onAudioLevelChange: (level: number) => void,
    onTranscription: (text: string) => void,
    mode: 'transcription' | 'answer' = 'transcription',
    customPrompt?: string,
    language?: string
  ) {
    if (import.meta.env.MODE === 'production' && !PROXY_SERVER_URL) {
      throw new Error('Proxy server configuration is required in production environment')
    }

    this.onMessageCallback = onMessage
    this.onSetupCompleteCallback = onSetupComplete
    this.onPlayingStateChange = onPlayingStateChange
    this.onAudioLevelChange = onAudioLevelChange
    this.onTranscriptionCallback = onTranscription
    this.mode = mode
    this.customPrompt = customPrompt || null
    this.language = language
  }

  private processQueue() {
    if (this.transcriptionQueue.length === 0) {
      return
    }
    const batchedText = this.transcriptionQueue.join(' ')
    this.transcriptionQueue = []
    this.onTranscriptionCallback?.(batchedText)
  }

  async connect() {
    if (this.ws) {
      console.warn('[Gemini] WebSocket 已經連接')
      return
    }

    try {
      console.log('[Gemini] 正在連接到代理服務器...')
      this.ws = new WebSocket(PROXY_SERVER_URL)

      this.ws.onopen = () => {
        console.log('[Gemini] WebSocket 連接成功')
        if (this.customPrompt) {
          console.log('[Gemini] 發送自定義提示詞:', this.customPrompt)
          this.ws?.send(
            JSON.stringify({
              type: 'custom_prompt',
              prompt: this.customPrompt
            })
          )
        }
        if (this.language) {
          console.log('[Gemini] 發送語言設置:', this.language)
          this.ws?.send(JSON.stringify({ type: 'language', language: this.language }))
        }
        console.log('[Gemini] 發送模式信息:', this.mode)
        this.ws?.send(JSON.stringify({ type: 'mode', mode: this.mode }))
        this.onSetupCompleteCallback?.()
        this._isConnected = true
        this.reconnectAttempts = 0

        // Start processing the queue
        if (this.processingInterval) {
          clearInterval(this.processingInterval)
        }
        this.processingInterval = window.setInterval(() => this.processQueue(), 2000)
      }

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data)
          if (data.text) {
            // Route based on mode
            if (this.mode === 'transcription') {
              this.transcriptionQueue.push(data.text)
            } else {
              this.onMessageCallback?.(data.text, data.turnComplete || false)
            }
          } else if (data.setupComplete) {
            this.isSetupComplete = true
          }
        } catch (error) {
          console.error('[Gemini] 處理消息時發生錯誤:', error)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[Gemini] WebSocket 錯誤:', error)
        this.onError(new Error('WebSocket connection error'))
      }

      this.ws.onclose = () => {
        console.log('[Gemini] WebSocket 已關閉')
        this._isConnected = false
        this.onClose()
        this.reconnect()
      }
    } catch (error) {
      console.error('[Gemini] 連接到代理服務器時發生錯誤:', error)
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      setTimeout(() => {
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
        )
        this.connect()
      }, this.reconnectTimeout * this.reconnectAttempts)
    }
  }

  sendAudioData(data: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data)
    }
  }

  private onError(error: Error) {
    // Implement error handling logic
  }

  private onClose() {
    // Implement close handling logic
  }

  sendMediaChunk(data: string, mimeType: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // console.log(
      //   "[GeminiClient] Sending media chunk, data size:",
      //   data.length,
      // );
      const message = {
        type: 'media_chunk',
        mimeType,
        chunk: data
      }
      try {
        this.ws.send(JSON.stringify(message))
        // console.log('[GeminiClient] Media chunk sent successfully')
      } catch (error) {
        console.error('[GeminiClient] Error sending media chunk:', error)
      }
    } else {
      console.error('[GeminiClient] WebSocket not ready, state:', this.ws?.readyState)
    }
  }

  disconnect() {
    this.isSetupComplete = false
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this._isConnected = false
  }

  onTextResponse(text: string) {
    if (this.streamingBuffer.includes('TRANSCRIPTION:')) {
      const transcriptionMatch = this.streamingBuffer.match(/TRANSCRIPTION:\s*(.*?)(?:\n|$)/s)
      if (transcriptionMatch && transcriptionMatch[1]) {
        const cleanTranscription = transcriptionMatch[1]
          .replace(/^TRANSCRIPTION:\s*/i, '')
          .replace(/\nTRANSCRIPTION:\s*/g, '\n')
          .trim()

        let keywords = ''
        if (this.streamingBuffer.includes('KEYWORDS:')) {
          const keywordsMatch = this.streamingBuffer.match(/KEYWORDS:\s*(.*?)(?:\n|$)/s)
          if (keywordsMatch && keywordsMatch[1]) {
            keywords = keywordsMatch[1].trim()
          }
        }

        const finalResponse = cleanTranscription + (keywords ? `\n關鍵字：${keywords}` : '')
        this.onTranscriptionCallback?.(finalResponse)
        this.streamingBuffer = ''
      }
    }
  }
}
