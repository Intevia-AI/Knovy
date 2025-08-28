/**
 * @fileoverview WebSocket client for connecting to Gemini AI proxy server.
 * Handles real-time audio streaming, transcription, and AI response generation
 * with automatic reconnection and error handling capabilities.
 */

import dotenv from "dotenv";

// Load environment variables
dotenv.config();

/** @type {string} WebSocket proxy server URL from environment or default localhost */
const PROXY_SERVER_URL = process.env.NEXT_PUBLIC_GEMINI_WS_URL || "ws://localhost:4567";
console.log(PROXY_SERVER_URL);

/**
 * WebSocket client for Gemini AI proxy server communication.
 * Provides real-time audio streaming, transcription, and AI response capabilities
 * with automatic reconnection, error handling, and multiple operation modes.
 *
 * @class GeminiClient
 */
export class GeminiClient {
  /** @type {WebSocket|null} WebSocket connection instance */
  private ws: WebSocket | null = null;

  /** @type {boolean} Connection status flag */
  private isConnected: boolean = false;

  /** @type {boolean} Setup completion status flag */
  private isSetupComplete: boolean = false;

  /** @type {Function|null} Callback for AI response messages */
  private onMessageCallback: ((text: string, turnComplete: boolean) => void) | null = null;

  /** @type {Function|null} Callback for setup completion */
  private onSetupCompleteCallback: (() => void) | null = null;

  /** @type {Function|null} Callback for audio playing state changes */
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null;

  /** @type {Function|null} Callback for audio level changes */
  private onAudioLevelChange: ((level: number) => void) | null = null;

  /** @type {Function|null} Callback for transcription results */
  private onTranscriptionCallback: ((text: string) => void) | null = null;

  /** @type {number} Current number of reconnection attempts */
  private reconnectAttempts: number = 0;

  /** @type {number} Maximum allowed reconnection attempts */
  private maxReconnectAttempts: number = 5;

  /** @type {number} Base timeout for reconnection attempts in milliseconds */
  private reconnectTimeout: number = 1000;

  /** @type {string} Buffer for streaming text responses */
  private streamingBuffer: string = "";

  /** @type {"transcription"|"answer"} Current operation mode */
  private mode: "transcription" | "answer";

  /** @type {string|null} Custom AI prompt for responses */
  private customPrompt: string | null = null;

  /** @type {string|undefined} User's preferred language setting */
  private language?: string;

  /**
   * Creates a new GeminiClient instance with callback handlers and configuration.
   * Validates production environment requirements and initializes client state.
   *
   * @constructor
   * @param {Function} onMessage - Callback for AI response messages (text, turnComplete)
   * @param {Function} onSetupComplete - Callback when WebSocket setup is complete
   * @param {Function} onPlayingStateChange - Callback for audio playing state changes
   * @param {Function} onAudioLevelChange - Callback for audio level updates
   * @param {Function} onTranscription - Callback for transcription results
   * @param {"transcription"|"answer"} [mode="transcription"] - Operation mode
   * @param {string} [customPrompt] - Custom AI prompt for responses
   * @param {string} [language] - User's preferred language setting
   * @throws {Error} When proxy server configuration is missing in production
   */
  constructor(
    onMessage: (text: string, turnComplete: boolean) => void,
    onSetupComplete: () => void,
    onPlayingStateChange: (isPlaying: boolean) => void,
    onAudioLevelChange: (level: number) => void,
    onTranscription: (text: string) => void,
    mode: "transcription" | "answer" = "transcription",
    customPrompt?: string,
    language?: string,
  ) {
    // Security check: Ensure we're not running in production without proper proxy configuration
    if (process.env.NODE_ENV === "production" && !PROXY_SERVER_URL) {
      throw new Error("Proxy server configuration is required in production environment");
    }

    this.onMessageCallback = onMessage;
    this.onSetupCompleteCallback = onSetupComplete;
    this.onPlayingStateChange = onPlayingStateChange;
    this.onAudioLevelChange = onAudioLevelChange;
    this.onTranscriptionCallback = onTranscription;
    this.mode = mode;
    this.customPrompt = customPrompt || null;
    this.language = language;
  }

  /**
   * Establishes WebSocket connection to the Gemini proxy server.
   * Sends initial configuration including custom prompt, language, and mode settings.
   * Sets up event handlers for connection lifecycle and message processing.
   *
   * @async
   * @function connect
   * @returns {Promise<void>}
   * @throws {Error} When connection to proxy server fails
   */
  async connect() {
    if (this.ws) {
      console.warn("[Gemini] WebSocket 已經連接");
      return;
    }

    try {
      console.log("[Gemini] 正在連接到代理服務器...");
      this.ws = new WebSocket(PROXY_SERVER_URL);

      this.ws.onopen = () => {
        console.log("[Gemini] WebSocket 連接成功");
        // Send custom prompt if available
        if (this.customPrompt) {
          console.log("[Gemini] 發送自定義提示詞:", this.customPrompt);
          this.ws?.send(
            JSON.stringify({
              type: "custom_prompt",
              prompt: this.customPrompt,
            }),
          );
        }
        // Send language setting if available
        if (this.language) {
          console.log("[Gemini] 發送語言設置:", this.language);
          this.ws?.send(JSON.stringify({ type: "language", language: this.language }));
        }
        // Send mode information
        console.log("[Gemini] 發送模式信息:", this.mode);
        this.ws?.send(JSON.stringify({ type: "mode", mode: this.mode }));
        this.onSetupCompleteCallback?.();
        this.isConnected = true;
        this.reconnectAttempts = 0;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.text) {
            this.onMessageCallback?.(data.text, data.turnComplete || false);
          } else if (data.setupComplete) {
            this.isSetupComplete = true;
          }
        } catch (error) {
          console.error("[Gemini] 處理消息時發生錯誤:", error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("[Gemini] WebSocket 錯誤:", error);
        this.onError(new Error("WebSocket connection error"));
      };

      this.ws.onclose = () => {
        console.log("[Gemini] WebSocket 已關閉");
        this.isConnected = false;
        this.onClose();
        this.reconnect();
      };
    } catch (error) {
      console.error("[Gemini] 連接到代理服務器時發生錯誤:", error);
    }
  }

  /**
   * Attempts to reconnect to the WebSocket server with exponential backoff.
   * Limits reconnection attempts to prevent infinite retry loops.
   *
   * @private
   * @function reconnect
   * @returns {void}
   */
  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(
          `Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`,
        );
        this.connect();
      }, this.reconnectTimeout * this.reconnectAttempts);
    }
  }

  /**
   * Sends raw audio data to the WebSocket server for processing.
   * Only sends data when WebSocket connection is open and ready.
   *
   * @function sendAudioData
   * @param {ArrayBuffer} data - Raw audio data buffer to send
   * @returns {void}
   */
  sendAudioData(data: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * Handles WebSocket error events.
   * Currently a placeholder for future error handling implementation.
   *
   * @private
   * @function onError
   * @param {Error} error - Error object from WebSocket
   * @returns {void}
   */
  private onError(error: Error) {
    // Implement error handling logic
  }

  /**
   * Handles WebSocket close events.
   * Currently a placeholder for future close handling implementation.
   *
   * @private
   * @function onClose
   * @returns {void}
   */
  private onClose() {
    // Implement close handling logic
  }

  /**
   * Sends media chunk data (audio/video) to the WebSocket server.
   * Formats data as JSON message with type, MIME type, and chunk data.
   *
   * @function sendMediaChunk
   * @param {string} data - Base64 encoded media chunk data
   * @param {string} mimeType - MIME type of the media chunk
   * @returns {void}
   */
  sendMediaChunk(data: string, mimeType: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      // console.log(
      //   "[GeminiClient] Sending media chunk, data size:",
      //   data.length,
      // );
      const message = {
        type: "media_chunk",
        mimeType,
        chunk: data,
      };
      try {
        this.ws.send(JSON.stringify(message));
        // console.log("[GeminiClient] Media chunk sent successfully");
      } catch (error) {
        console.error("[GeminiClient] Error sending media chunk:", error);
      }
    } else {
      console.error("[GeminiClient] WebSocket not ready, state:", this.ws?.readyState);
    }
  }

  /**
   * Disconnects from the WebSocket server and cleans up client state.
   * Closes the WebSocket connection and resets all status flags.
   *
   * @function disconnect
   * @returns {void}
   */
  disconnect() {
    this.isSetupComplete = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }

  /**
   * Processes text responses from the AI server and extracts transcription content.
   * Parses streaming buffer for TRANSCRIPTION and KEYWORDS tags, cleans the content,
   * and triggers the transcription callback with formatted results.
   *
   * @function onTextResponse
   * @param {string} text - Raw text response from the AI server
   * @returns {void}
   */
  onTextResponse(text: string) {
    if (this.streamingBuffer.includes("TRANSCRIPTION:")) {
      // Use regex to extract actual content, completely removing tags
      const transcriptionMatch = this.streamingBuffer.match(/TRANSCRIPTION:\s*(.*?)(?:\n|$)/s);
      if (transcriptionMatch && transcriptionMatch[1]) {
        const cleanTranscription = transcriptionMatch[1]
          .replace(/^TRANSCRIPTION:\s*/i, "") // Ensure removal of leading tag
          .replace(/\nTRANSCRIPTION:\s*/g, "\n") // Remove any middle tags
          .trim();

        // Process keywords section if present
        let keywords = "";
        if (this.streamingBuffer.includes("KEYWORDS:")) {
          const keywordsMatch = this.streamingBuffer.match(/KEYWORDS:\s*(.*?)(?:\n|$)/s);
          if (keywordsMatch && keywordsMatch[1]) {
            keywords = keywordsMatch[1].trim();
          }
        }

        // Combine final response with clean formatting
        const finalResponse = cleanTranscription + (keywords ? `\n關鍵字：${keywords}` : "");
        this.onTranscriptionCallback?.(finalResponse);
        this.streamingBuffer = "";
      }
    }
  }
}
