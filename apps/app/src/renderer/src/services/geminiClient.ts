/**
 * @fileoverview WebSocket client for connecting to Gemini AI proxy server.
 * Handles real-time audio streaming, transcription, and AI response generation
 * with automatic reconnection and error handling capabilities.
 */

const PROXY_SERVER_URL = import.meta.env.VITE_GEMINI_WS_URL

if (!PROXY_SERVER_URL) {
  throw new Error('VITE_GEMINI_WS_URL is not defined. Please check your .env file.')
}

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

  /** @type {boolean} Connection status flag */
  private isConnected: boolean = false

  /** @type {boolean} Flag to indicate intentional disconnect */
  private isIntentionalDisconnect: boolean = false

  /** @type {boolean} Setup completion status flag */
  private isSetupComplete: boolean = false

  /** @type {Function|null} Callback for AI response messages */
  private onMessageCallback: ((data: any) => void) | null = null

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

  /** @type {Map<string, object>} Track sent messages for debugging */
  private sentMessages: Map<string, { timestamp: number; retries: number; size: number }> = new Map()

  /** @type {number} Message sequence counter */
  private messageSequence: number = 0

  /** @type {number} Total messages sent */
  private totalMessagesSent: number = 0

  /** @type {number} Total messages received */
  private totalMessagesReceived: number = 0

  /** @type {NodeJS.Timeout|null} Health check interval */
  private healthCheckInterval: NodeJS.Timeout | null = null

  /** @type {number} Last ping timestamp */
  private lastPingTime: number = 0

  /** @type {number} Last pong timestamp */
  private lastPongTime: number = 0

  /** @type {boolean} Connection health status */
  private connectionHealthy: boolean = true

  /** @type {number} Health check interval in milliseconds */
  private readonly HEALTH_CHECK_INTERVAL = 30000 // 30 seconds

  /** @type {number} Ping timeout in milliseconds */
  private readonly PING_TIMEOUT = 10000 // 10 seconds

  constructor(
    onMessage: (data: any) => void,
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

  async connect() {
    this.isIntentionalDisconnect = false
    if (this.ws) {
      console.warn('[Gemini] WebSocket 已經連接')
      return
    }

    try {
      console.log('[Gemini] 正在連接到代理伺服器...')
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
          console.log('[Gemini] 發送語言設定:', this.language)
          this.ws?.send(JSON.stringify({ type: 'language', language: this.language }))
        }
        console.log('[Gemini] 發送模式訊息:', this.mode)
        this.ws?.send(JSON.stringify({ type: 'mode', mode: this.mode }))
        this.onSetupCompleteCallback?.()
        this.isConnected = true
        this.reconnectAttempts = 0
        this.connectionHealthy = true
        this.startHealthMonitoring()
      }

      this.ws.onmessage = (event) => {
        try {
          this.totalMessagesReceived++
          const data = JSON.parse(event.data)

          console.log(`[Gemini] Received message #${this.totalMessagesReceived}:`, {
            hasText: !!data.text,
            text: data.text ? `"${data.text}"` : null,
            textLength: data.text?.length || 0,
            turnComplete: data.turnComplete,
            setupComplete: data.setupComplete,
            error: data.error
          })

          if (data.text) {
            this.onMessageCallback?.(data.text, data.turnComplete || false)
          } else if (data.setupComplete) {
            this.isSetupComplete = true
            console.log(`[Gemini] Setup complete confirmed after ${this.totalMessagesSent} sent messages`)
          } else if (data.type === 'pong') {
            this.handlePong(data.timestamp)
          } else if (data.error) {
            console.error('[Gemini] Received error from server:', data.error)
            this.onError(new Error(`Server error: ${JSON.stringify(data.error)}`))
          }
        } catch (error) {
          console.error('[Gemini] 處理消息時發生錯誤:', error)
          console.error('[Gemini] Raw message data:', event.data)
        }
      }

      this.ws.onerror = (error) => {
        console.error('[Gemini] WebSocket 錯誤:', error)
        this.onError(new Error('WebSocket connection error'))
      }

      this.ws.onclose = () => {
        console.log('[Gemini] WebSocket 已關閉')
        this.isConnected = false
        this.connectionHealthy = false
        this.stopHealthMonitoring()
        this.onClose()
        if (!this.isIntentionalDisconnect) {
          this.reconnect()
        }
      }
    } catch (error) {
      console.error('[Gemini] 連接到代理伺服器時發生錯誤:', error)
    }
  }

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++
      const delay = Math.min(this.reconnectTimeout * Math.pow(2, this.reconnectAttempts - 1), 30000) // Exponential backoff with max 30s
      setTimeout(() => {
        console.log(
          `[Gemini] Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) with ${delay}ms delay`
        )
        this.connect()
      }, delay)
    } else {
      console.error('[Gemini] Max reconnection attempts reached. Connection failed permanently.')
      this.onError(new Error('Max reconnection attempts reached'))
    }
  }

  /**
   * Start health monitoring with periodic ping/pong
   */
  private startHealthMonitoring() {
    this.stopHealthMonitoring() // Clear any existing interval

    this.healthCheckInterval = setInterval(() => {
      this.performHealthCheck()
    }, this.HEALTH_CHECK_INTERVAL)

    console.log(`[Gemini] Started health monitoring (${this.HEALTH_CHECK_INTERVAL}ms interval)`)
  }

  /**
   * Stop health monitoring
   */
  private stopHealthMonitoring() {
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval)
      this.healthCheckInterval = null
      console.log('[Gemini] Stopped health monitoring')
    }
  }

  /**
   * Perform health check by sending ping
   */
  private performHealthCheck() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      console.warn('[Gemini] Health check: WebSocket not open')
      this.handleUnhealthyConnection()
      return
    }

    // Check if previous ping timed out
    if (this.lastPingTime > 0 && this.lastPongTime < this.lastPingTime) {
      const timeSincePing = Date.now() - this.lastPingTime
      if (timeSincePing > this.PING_TIMEOUT) {
        console.warn(`[Gemini] Health check: Ping timeout (${timeSincePing}ms)`)
        this.handleUnhealthyConnection()
        return
      }
    }

    this.sendPing()
  }

  /**
   * Send ping message to server
   */
  private sendPing() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      return
    }

    const pingMessage = {
      type: 'ping',
      timestamp: Date.now()
    }

    try {
      this.lastPingTime = Date.now()
      this.ws.send(JSON.stringify(pingMessage))
      console.log(`[Gemini] Sent ping at ${this.lastPingTime}`)
    } catch (error) {
      console.error('[Gemini] Error sending ping:', error)
      this.handleUnhealthyConnection()
    }
  }

  /**
   * Handle pong response from server
   */
  private handlePong(serverTimestamp: number) {
    this.lastPongTime = Date.now()
    const roundTripTime = this.lastPongTime - this.lastPingTime
    console.log(`[Gemini] Received pong, RTT: ${roundTripTime}ms`)

    this.connectionHealthy = true
  }

  /**
   * Handle unhealthy connection by attempting reconnection
   */
  private handleUnhealthyConnection() {
    console.warn('[Gemini] Connection detected as unhealthy, attempting reconnection')
    this.connectionHealthy = false
    this.stopHealthMonitoring()

    // Close current connection and reconnect
    if (this.ws) {
      this.ws.close()
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
    if (!this.ws) {
      console.error('[GeminiClient] Cannot send media chunk: WebSocket is null')
      return
    }

    if (this.ws.readyState !== WebSocket.OPEN) {
      console.error(`[GeminiClient] Cannot send media chunk: WebSocket not open (state: ${this.ws.readyState})`)
      return
    }

    const messageId = `chunk_${++this.messageSequence}_${Date.now()}`
    const message = {
      id: messageId,
      type: 'media_chunk',
      mimeType,
      chunk: data,
      timestamp: Date.now()
    }

    // Track sent message for debugging
    this.sentMessages.set(messageId, {
      timestamp: Date.now(),
      retries: 0,
      size: data.length
    })

    try {
      this.ws.send(JSON.stringify(message))
      this.totalMessagesSent++

      console.log(`[GeminiClient] Sent audio chunk ${messageId} (${this.totalMessagesSent} total), size: ${data.length}`)

      // Clean up old message tracking (keep last 100 messages)
      if (this.sentMessages.size > 100) {
        const oldestKey = this.sentMessages.keys().next().value
        this.sentMessages.delete(oldestKey)
      }
    } catch (error) {
      console.error(`[GeminiClient] Error sending media chunk ${messageId}:`, error)
      this.sentMessages.delete(messageId) // Remove failed message from tracking

      // Handle specific WebSocket errors
      if (error.message.includes('WebSocket is not open')) {
        console.warn('[GeminiClient] WebSocket closed during send, will attempt reconnection')
        this.reconnect()
      }
    }
  }

  disconnect() {
    console.log(`[GeminiClient] Disconnecting. Stats - Sent: ${this.totalMessagesSent}, Received: ${this.totalMessagesReceived}`)

    this.isSetupComplete = false
    this.stopHealthMonitoring()

    if (this.ws) {
      this.isIntentionalDisconnect = true
      this.ws.close()
      this.ws = null
    }
    this.isConnected = false
    this.connectionHealthy = false

    // Clear tracking data
    this.sentMessages.clear()
    this.messageSequence = 0
    this.lastPingTime = 0
    this.lastPongTime = 0
  }

  /**
   * Get connection statistics for debugging
   */
  getStats() {
    return {
      totalMessagesSent: this.totalMessagesSent,
      totalMessagesReceived: this.totalMessagesReceived,
      pendingMessages: this.sentMessages.size,
      isConnected: this.isConnected,
      isSetupComplete: this.isSetupComplete,
      reconnectAttempts: this.reconnectAttempts,
      connectionHealthy: this.connectionHealthy,
      lastPingTime: this.lastPingTime,
      lastPongTime: this.lastPongTime,
      roundTripTime: this.lastPongTime > this.lastPingTime ? this.lastPongTime - this.lastPingTime : null
    }
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
