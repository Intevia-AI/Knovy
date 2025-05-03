import dotenv from "dotenv";

// Load environment variables
dotenv.config();

// const PROXY_SERVER_URL = process.env.PROXY_SERVER_URL || `ws://${process.env.PROXY_HOST || 'localhost'}:${process.env.PROXY_PORT || '4567'}`;
// const PROXY_SERVER_URL = "wss://intevia-api.adastra.tw";
const PROXY_SERVER_URL =
  process.env.NEXT_PUBLIC_GEMINI_WS_URL || "ws://localhost:4567";
console.log(PROXY_SERVER_URL);

export class GeminiClient {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private onMessageCallback:
    | ((text: string, turnComplete: boolean) => void)
    | null = null;
  private onSetupCompleteCallback: (() => void) | null = null;
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null;
  private onAudioLevelChange: ((level: number) => void) | null = null;
  private onTranscriptionCallback: ((text: string) => void) | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 1000;
  private streamingBuffer: string = "";
  private mode: "transcription" | "answer";
  private customPrompt: string | null = null;
  private language?: string;

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
      throw new Error(
        "Proxy server configuration is required in production environment",
      );
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
        // 發送自定義提示詞（如果有的話）
        if (this.customPrompt) {
          console.log("[Gemini] 發送自定義提示詞:", this.customPrompt);
          this.ws?.send(
            JSON.stringify({
              type: "custom_prompt",
              prompt: this.customPrompt,
            }),
          );
        }
        // 發送語言設置（如果有的話）
        if (this.language) {
          console.log("[Gemini] 發送語言設置:", this.language);
          this.ws?.send(
            JSON.stringify({ type: "language", language: this.language }),
          );
        }
        // 發送模式信息
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
      console.log(
        "[GeminiClient] Sending media chunk, data size:",
        data.length,
      );
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
      console.error(
        "[GeminiClient] WebSocket not ready, state:",
        this.ws?.readyState,
      );
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

  onTextResponse(text: string) {
    if (this.streamingBuffer.includes("TRANSCRIPTION:")) {
      // 使用正則表達式提取實際內容，完全移除標籤
      const transcriptionMatch = this.streamingBuffer.match(
        /TRANSCRIPTION:\s*(.*?)(?:\n|$)/s,
      );
      if (transcriptionMatch && transcriptionMatch[1]) {
        const cleanTranscription = transcriptionMatch[1]
          .replace(/^TRANSCRIPTION:\s*/i, "") // 再次確保移除開頭的標籤
          .replace(/\nTRANSCRIPTION:\s*/g, "\n") // 移除中間可能出現的標籤
          .trim();

        // 如果有關鍵字部分，也一併處理
        let keywords = "";
        if (this.streamingBuffer.includes("KEYWORDS:")) {
          const keywordsMatch = this.streamingBuffer.match(
            /KEYWORDS:\s*(.*?)(?:\n|$)/s,
          );
          if (keywordsMatch && keywordsMatch[1]) {
            keywords = keywordsMatch[1].trim();
          }
        }

        // 組合最終回應，確保格式乾淨
        const finalResponse =
          cleanTranscription + (keywords ? `\n關鍵字：${keywords}` : "");
        this.onTranscriptionCallback?.(finalResponse);
        this.streamingBuffer = "";
      }
    }
  }
}
