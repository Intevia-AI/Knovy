import { Base64 } from 'js-base64';
import { TranscriptionService } from './transcriptionService';
import { pcmToWav } from '../utils/audioUtils';

const MODEL = "models/gemini-2.0-flash-exp";
const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

export class GeminiWebSocket {
  private ws: WebSocket | null = null;
  private isConnected: boolean = false;
  private isSetupComplete: boolean = false;
  private onMessageCallback: ((text: string) => void) | null = null;
  private onSetupCompleteCallback: (() => void) | null = null;
  private audioContext: AudioContext | null = null;
  
  // Audio queue management
  private audioQueue: Float32Array[] = [];
  private isPlaying: boolean = false;
  private currentSource: AudioBufferSourceNode | null = null;
  private isPlayingResponse: boolean = false;
  private onPlayingStateChange: ((isPlaying: boolean) => void) | null = null;
  private onAudioLevelChange: ((level: number) => void) | null = null;
  private onTranscriptionCallback: ((text: string) => void) | null = null;
  private transcriptionService: TranscriptionService;
  private accumulatedPcmData: string[] = [];
  private readonly onText: (text: string) => void;
  private readonly onConnect: () => void;
  private readonly onPlaying: (isPlaying: boolean) => void;
  private readonly onAudioLevel: (level: number) => void;
  private readonly onTranscription: (text: string) => void;
  private readonly onKeywords: (keywords: string[]) => void;
  private readonly apiKey: string;
  private readonly model: string;
  private readonly baseUrl: string;
  private readonly maxRetries: number;
  private retryCount: number = 0;
  private retryTimeout: NodeJS.Timeout | null = null;
  private audioLevel: number = 0;
  private buffer: string = "";
  private readonly bufferSize: number = 1000; // Buffer size in characters
  private readonly keywordDetectionInterval: number = 5000; // Check for keywords every 5 seconds
  private keywordDetectionTimer: NodeJS.Timeout | null = null;

  constructor(
    onText: (text: string) => void,
    onConnect: () => void,
    onPlaying: (isPlaying: boolean) => void,
    onAudioLevel: (level: number) => void,
    onTranscription: (text: string) => void,
    onKeywords: (keywords: string[]) => void,
    apiKey: string = process.env.GEMINI_API_KEY || "",
    model: string = "gemini-pro",
    baseUrl: string = "wss://generativelanguage.googleapis.com/v1beta/models",
    maxRetries: number = 3
  ) {
    console.log("[GeminiWebSocket] Initializing with API key:", API_KEY ? "Present" : "Missing");
    this.onText = onText;
    this.onConnect = onConnect;
    this.onPlaying = onPlaying;
    this.onAudioLevel = onAudioLevel;
    this.onTranscription = onTranscription;
    this.onKeywords = onKeywords;
    this.apiKey = apiKey;
    this.model = model;
    this.baseUrl = baseUrl;
    this.maxRetries = maxRetries;
    // Create AudioContext for playback
    this.audioContext = new AudioContext({
      sampleRate: 24000  // Match the response audio rate
    });
    this.transcriptionService = new TranscriptionService();
  }

  private async detectKeywords(text: string): Promise<string[]> {
    try {
      const prompt = `Analyze the following text and identify technical terms, specialized vocabulary, or complex concepts that might be difficult for a general audience to understand. Return only the keywords, separated by commas:

Text: "${text}"

Keywords:`;

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${this.model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            contents: [
              {
                parts: [{ text: prompt }],
              },
            ],
          }),
        }
      );

      const data = await response.json();
      if (data.candidates && data.candidates[0].content.parts[0].text) {
        const keywords = data.candidates[0].content.parts[0].text
          .split(",")
          .map((k: string) => k.trim())
          .filter((k: string) => k.length > 0);
        return keywords;
      }
      return [];
    } catch (error) {
      console.error("Error detecting keywords:", error);
      return [];
    }
  }

  private startKeywordDetection() {
    if (this.keywordDetectionTimer) {
      clearInterval(this.keywordDetectionTimer);
    }

    this.keywordDetectionTimer = setInterval(async () => {
      if (this.buffer.length > 0) {
        const keywords = await this.detectKeywords(this.buffer);
        if (keywords.length > 0) {
          this.onKeywords(keywords);
        }
      }
    }, this.keywordDetectionInterval);
  }

  private stopKeywordDetection() {
    if (this.keywordDetectionTimer) {
      clearInterval(this.keywordDetectionTimer);
      this.keywordDetectionTimer = null;
    }
  }

  connect() {
    console.log("[GeminiWebSocket] Attempting to connect to:", WS_URL);
    if (this.ws?.readyState === WebSocket.OPEN) {
      console.log("[GeminiWebSocket] WebSocket already connected");
      return;
    }
    
    this.ws = new WebSocket(WS_URL);

    this.ws.onopen = () => {
      console.log("[GeminiWebSocket] WebSocket connection opened");
      this.isConnected = true;
      this.sendInitialSetup();
      this.retryCount = 0;
      this.onConnect();
      this.startKeywordDetection();
    };

    this.ws.onmessage = async (event) => {
      try {
        console.log("[GeminiWebSocket] Received message");
        let messageText: string;
        if (event.data instanceof Blob) {
          const arrayBuffer = await event.data.arrayBuffer();
          const bytes = new Uint8Array(arrayBuffer);
          messageText = new TextDecoder('utf-8').decode(bytes);
        } else {
          messageText = event.data;
        }
        
        await this.handleMessage(messageText);
      } catch (error) {
        console.error("[GeminiWebSocket] Error processing message:", error);
      }
    };

    this.ws.onerror = (error) => {
      console.error("[GeminiWebSocket] WebSocket error:", error);
      this.disconnect();
      this.retry();
    };

    this.ws.onclose = (event) => {
      console.log("[GeminiWebSocket] WebSocket closed:", event.code, event.reason);
      this.isConnected = false;
      
      // Only attempt to reconnect if we haven't explicitly called disconnect
      if (!event.wasClean && this.isSetupComplete) {
        console.log("[GeminiWebSocket] Attempting to reconnect...");
        setTimeout(() => this.connect(), 1000);
      }
      this.stopKeywordDetection();
    };
  }

  private sendInitialSetup() {
    console.log("[GeminiWebSocket] Sending initial setup");
    const setupMessage = {
      setup: {
        model: MODEL,
        generation_config: {
          response_modalities: ["TEXT"] 
        }
      }
    };
    this.ws?.send(JSON.stringify(setupMessage));
  }

  sendMediaChunk(b64Data: string, mimeType: string) {
    if (!this.isConnected || !this.ws || !this.isSetupComplete) return;

    const message = {
      realtime_input: {
        media_chunks: [{
          mime_type: mimeType === "audio/pcm" ? "audio/pcm" : mimeType,
          data: b64Data
        }]
      }
    };

    try {
      console.log("[Gemini] Sending audio chunk, size:", b64Data.length);
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      console.error("[WebSocket] Error sending media chunk:", error);
    }
  }

  private async playAudioResponse(base64Data: string) {
    if (!this.audioContext) return;

    try {
      // Decode base64 to bytes
      const binaryString = atob(base64Data);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      // Convert to Int16Array (PCM format)
      const pcmData = new Int16Array(bytes.buffer);
      
      // Convert to float32 for Web Audio API
      const float32Data = new Float32Array(pcmData.length);
      for (let i = 0; i < pcmData.length; i++) {
        float32Data[i] = pcmData[i] / 32768.0;
      }

      // Add to queue and start playing if not already playing
      this.audioQueue.push(float32Data);
      this.playNextInQueue();
    } catch (error) {
      console.error("[WebSocket] Error processing audio:", error);
    }
  }

  private async playNextInQueue() {
    if (!this.audioContext || this.isPlaying || this.audioQueue.length === 0) return;

    try {
      this.isPlaying = true;
      this.isPlayingResponse = true;
      this.onPlayingStateChange?.(true);
      const float32Data = this.audioQueue.shift()!;

      // Calculate audio level
      let sum = 0;
      for (let i = 0; i < float32Data.length; i++) {
        sum += Math.abs(float32Data[i]);
      }
      const level = Math.min((sum / float32Data.length) * 100 * 5, 100);
      this.onAudioLevelChange?.(level);

      const audioBuffer = this.audioContext.createBuffer(
        1,
        float32Data.length,
        24000
      );
      audioBuffer.getChannelData(0).set(float32Data);

      this.currentSource = this.audioContext.createBufferSource();
      this.currentSource.buffer = audioBuffer;
      this.currentSource.connect(this.audioContext.destination);
      
      this.currentSource.onended = () => {
        this.isPlaying = false;
        this.currentSource = null;
        if (this.audioQueue.length === 0) {
          this.isPlayingResponse = false;
          this.onPlayingStateChange?.(false);
        }
        this.playNextInQueue();
      };

      this.currentSource.start();
    } catch (error) {
      console.error("[WebSocket] Error playing audio:", error);
      this.isPlaying = false;
      this.isPlayingResponse = false;
      this.onPlayingStateChange?.(false);
      this.currentSource = null;
      this.playNextInQueue();
    }
  }

  private stopCurrentAudio() {
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch (e) {
        // Ignore errors if already stopped
      }
      this.currentSource = null;
    }
    this.isPlaying = false;
    this.isPlayingResponse = false;
    this.onPlayingStateChange?.(false);
    this.audioQueue = []; // Clear queue
  }

  private async handleMessage(message: string) {
    try {
      const messageData = JSON.parse(message);
      
      if (messageData.setupComplete) {
        this.isSetupComplete = true;
        this.onSetupCompleteCallback?.();
        return;
      }

      // Handle audio data
      if (messageData.serverContent?.modelTurn?.parts) {
        const parts = messageData.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.inlineData?.mimeType === "audio/pcm;rate=24000") {
            this.accumulatedPcmData.push(part.inlineData.data);
            this.playAudioResponse(part.inlineData.data);
          }
        }
      }

      // Handle turn completion separately
      if (messageData.serverContent?.turnComplete === true) {
        if (this.accumulatedPcmData.length > 0) {
          try {
            const fullPcmData = this.accumulatedPcmData.join('');
            const wavData = await pcmToWav(fullPcmData, 24000);
            
            const transcription = await this.transcriptionService.transcribeAudio(
              wavData,
              "audio/wav"
            );
            console.log("[Transcription]:", transcription);

            this.onTranscriptionCallback?.(transcription);
            this.accumulatedPcmData = []; // Clear accumulated data
          } catch (error) {
            console.error("[WebSocket] Transcription error:", error);
          }
        }
      }

      if (messageData.text) {
        this.buffer += messageData.text;
        if (this.buffer.length > this.bufferSize) {
          this.buffer = this.buffer.slice(-this.bufferSize);
        }
        this.onText(messageData.text);
      }

      if (messageData.audioLevel !== undefined) {
        this.audioLevel = messageData.audioLevel;
        this.onAudioLevel(this.audioLevel);
      }

      if (messageData.isPlaying !== undefined) {
        this.isPlaying = messageData.isPlaying;
        this.onPlaying(this.isPlaying);
      }
    } catch (error) {
      console.error("[WebSocket] Error parsing message:", error);
    }
  }

  disconnect() {
    this.isSetupComplete = false;
    if (this.ws) {
      this.ws.close(1000, "Intentional disconnect");
      this.ws = null;
    }
    this.isConnected = false;
    this.accumulatedPcmData = [];
    this.stopKeywordDetection();
  }

  private retry() {
    if (this.retryCount < this.maxRetries) {
      console.log(`[GeminiWebSocket] Retrying connection... (attempt ${this.retryCount + 1}/${this.maxRetries})`);
      this.retryCount++;
      setTimeout(() => this.connect(), 1000);
    } else {
      console.log("[GeminiWebSocket] Max retries reached. Giving up.");
    }
  }
} 