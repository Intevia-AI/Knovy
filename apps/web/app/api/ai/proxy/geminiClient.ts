/**
 * @module GeminiClient
 * @description Client for connecting to the Gemini AI service via WebSocket proxy
 * @requires dotenv
 */
const PROXY_SERVER_URL = process.env.NEXT_PUBLIC_PROXY_SERVER_URL || "ws://localhost:4567";

/**
 * @class GeminiClient
 * @description Client for connecting to the Gemini AI service via WebSocket proxy
 * @property {WebSocket|null} ws - The WebSocket connection to the proxy server
 * @property {boolean} isConnected - Whether the client is connected to the proxy server
 * @property {boolean} isSetupComplete - Whether the initial setup with Gemini is complete
 * @property {function|null} onMessageCallback - Callback for handling messages from Gemini
 * @property {function|null} onSetupCompleteCallback - Callback for when setup is complete
 * @property {function|null} onPlayingStateChange - Callback for audio playing state changes
 * @property {function|null} onAudioLevelChange - Callback for audio level changes
 * @property {function|null} onTranscriptionCallback - Callback for transcription results
 * @property {number} reconnectAttempts - Number of reconnection attempts made
 * @property {number} maxReconnectAttempts - Maximum number of reconnection attempts
 * @property {number} reconnectTimeout - Base timeout in ms between reconnection attempts
 * @property {string} streamingBuffer - Buffer for streaming transcription data
 */
export class GeminiClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private onMessageCallback: ((text: string) => void) | null = null;
  private onSetupCompleteCallback: (() => void) | null = null;
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null;
  private onAudioLevelChange: ((level: number) => void) | null = null;
  private onTranscriptionCallback: ((text: string) => void) | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 1000;
  private streamingBuffer: string = "";

  /**
   * @constructor
   * @description Creates a new GeminiClient instance
   * @param {function} onMessage - Callback for handling messages from Gemini
   * @param {function} onSetupComplete - Callback for when setup is complete
   * @param {function} onPlayingStateChange - Callback for audio playing state changes
   * @param {function} onAudioLevelChange - Callback for audio level changes
   * @param {function} onTranscription - Callback for transcription results
   * @throws {Error} If running in production without proper proxy configuration
   */
  constructor(
    onMessage: (text: string) => void,
    onSetupComplete: () => void,
    onPlayingStateChange: (isPlaying: boolean) => void,
    onAudioLevelChange: (level: number) => void,
    onTranscription: (text: string) => void,
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
  }

  /**
   * @method connect
   * @description Establishes a WebSocket connection to the proxy server
   * @returns {void}
   *
   * @remarks
   * Sets up event handlers for the WebSocket connection:
   * - "open": Sends initialization message to the proxy server
   * - "message": Processes messages from the proxy server
   * - "error": Handles WebSocket errors
   * - "close": Handles WebSocket closure and attempts to reconnect
   */
  connect() {
    try {
      this.ws = new WebSocket(PROXY_SERVER_URL);

      this.ws.onopen = () => {
        console.log("Connected to proxy server: ", PROXY_SERVER_URL);
        this.isConnected = true;
        this.reconnectAttempts = 0;
        // Send initialization message
        this.ws?.send(JSON.stringify({ type: "connect" }));
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.text) {
            this.onMessageCallback?.(data.text);
          } else if (data.setupComplete) {
            this.isSetupComplete = true;
            this.onSetupCompleteCallback?.();
          }
        } catch (error) {
          this.onError(error as Error);
        }
      };

      this.ws.onerror = (error) => {
        console.error("WebSocket error:", error);
        this.onError(new Error("WebSocket error occurred"));
      };

      this.ws.onclose = () => {
        console.log("WebSocket closed");
        this.isConnected = false;
        this.onClose();
        this.reconnect();
      };
    } catch (error) {
      this.onError(error as Error);
    }
  }

  /**
   * @method reconnect
   * @private
   * @description Attempts to reconnect to the proxy server after a connection failure
   * @returns {void}
   *
   * @remarks
   * Implements an exponential backoff strategy for reconnection attempts.
   * Gives up after reaching the maximum number of reconnection attempts.
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
   * @method sendAudioData
   * @description Sends raw audio data to the proxy server
   * @param {ArrayBuffer} data - The audio data to send
   * @returns {void}
   *
   * @remarks
   * Sends the raw ArrayBuffer data directly to the WebSocket if the connection is open.
   */
  sendAudioData(data: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
    }
  }

  /**
   * @method onError
   * @private
   * @description Handles WebSocket errors
   * @param {Error} error - The error that occurred
   * @returns {void}
   *
   * @remarks
   * Placeholder for error handling logic.
   */
  private onError(error: Error) {
    // Implement error handling logic
  }

  /**
   * @method onClose
   * @private
   * @description Handles WebSocket closure
   * @returns {void}
   *
   * @remarks
   * Placeholder for close handling logic.
   */
  private onClose() {
    // Implement close handling logic
  }

  /**
   * @method sendMediaChunk
   * @description Sends an audio media chunk to the proxy server
   * @param {string} data - Base64 encoded audio data
   * @param {string} mimeType - MIME type of the audio data
   * @returns {void}
   *
   * @remarks
   * Formats the data as a JSON message with type "media_chunk" and sends it to the proxy server.
   * Logs errors if the WebSocket is not ready or if sending fails.
   */
  sendMediaChunk(data: string, mimeType: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      console.log("[GeminiClient] Sending media chunk, data size:", data.length);
      const message = {
        type: "media_chunk",
        mimeType,
        chunk: data,
      };
      try {
        this.ws.send(JSON.stringify(message));
        console.log("[GeminiClient] Media chunk sent successfully");
      } catch (error) {
        console.error("[GeminiClient] Error sending media chunk:", error);
      }
    } else {
      console.error("[GeminiClient] WebSocket not ready, state:", this.ws?.readyState);
    }
  }

  /**
   * @method disconnect
   * @description Closes the WebSocket connection to the proxy server
   * @returns {void}
   *
   * @remarks
   * Resets the setup state, closes the WebSocket connection, and updates the connection state.
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
   * @method onTextResponse
   * @description Processes text responses from the Gemini API
   * @param {string} text - The text response from Gemini
   * @returns {void}
   *
   * @remarks
   * Parses the streaming buffer for transcription and keyword data.
   * Extracts the transcription content using regex and formats it.
   * If keywords are present, they are added to the final response.
   * The formatted response is passed to the transcription callback.
   */
  onTextResponse(text: string) {
    if (this.streamingBuffer.includes("TRANSCRIPTION:")) {
      // 使用正則表達式提取實際內容，完全移除標籤
      const transcriptionMatch = this.streamingBuffer.match(/TRANSCRIPTION:\s*(.*?)(?:\n|$)/s);
      if (transcriptionMatch && transcriptionMatch[1]) {
        const cleanTranscription = transcriptionMatch[1]
          .replace(/^TRANSCRIPTION:\s*/i, "") // 再次確保移除開頭的標籤
          .replace(/\nTRANSCRIPTION:\s*/g, "\n") // 移除中間可能出現的標籤
          .trim();

        // 如果有關鍵字部分，也一併處理
        let keywords = "";
        if (this.streamingBuffer.includes("KEYWORDS:")) {
          const keywordsMatch = this.streamingBuffer.match(/KEYWORDS:\s*(.*?)(?:\n|$)/s);
          if (keywordsMatch && keywordsMatch[1]) {
            keywords = keywordsMatch[1].trim();
          }
        }

        // 組合最終回應，確保格式乾淨
        const finalResponse =
          cleanTranscription + (keywords ? `\nDetected Keywords: ${keywords}` : "");
        this.onTranscriptionCallback?.(finalResponse);
        this.streamingBuffer = "";
      }
    }
  }
}
