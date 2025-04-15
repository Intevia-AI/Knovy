import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const PROXY_SERVER_URL = process.env.PROXY_SERVER_URL || `ws://${process.env.PROXY_HOST || 'localhost'}:${process.env.PROXY_PORT || '8080'}`;

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

  constructor(
    onMessage: (text: string) => void,
    onSetupComplete: () => void,
    onPlayingStateChange: (isPlaying: boolean) => void,
    onAudioLevelChange: (level: number) => void,
    onTranscription: (text: string) => void
  ) {
    // Security check: Ensure we're not running in production without proper proxy configuration
    if (process.env.NODE_ENV === 'production' && (!PROXY_SERVER_URL)) {
      throw new Error('Proxy server configuration is required in production environment');
    }

    this.onMessageCallback = onMessage;
    this.onSetupCompleteCallback = onSetupComplete;
    this.onPlayingStateChange = onPlayingStateChange;
    this.onAudioLevelChange = onAudioLevelChange;
    this.onTranscriptionCallback = onTranscription;
  }

  connect() {
    try {
      this.ws = new WebSocket(PROXY_SERVER_URL);

      this.ws.onopen = () => {
        console.log("Connected to proxy server");
        this.isConnected = true;
        this.reconnectAttempts = 0;
        // Send initialization message
        this.ws?.send(JSON.stringify({ type: 'connect' }));
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

  private reconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      this.reconnectAttempts++;
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts})`);
        this.connect();
      }, this.reconnectTimeout * this.reconnectAttempts);
    }
  }

  sendAudioData(data: ArrayBuffer) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(data);
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
      console.log("[GeminiClient] Sending media chunk, data size:", data.length);
      const message = {
        type: 'media_chunk',
        mimeType,
        chunk: data
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

  disconnect() {
    this.isSetupComplete = false;
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.isConnected = false;
  }
} 