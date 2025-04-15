import { WebSocketServer, WebSocket } from 'ws';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const MODEL = "models/gemini-2.0-flash-exp";
const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

if (!API_KEY) {
  throw new Error('GEMINI_API_KEY is not set in environment variables');
}

interface ClientConnection {
  ws: WebSocket;
  id: string;
  geminiWs: WebSocket | null;
  isSetupComplete: boolean;
}

export class GeminiProxyServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private geminiConnections: Map<string, WebSocket> = new Map();

  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  private setupServer() {
    this.wss.on('connection', (ws: WebSocket) => {
      const clientId = this.generateClientId();
      console.log(`[Proxy] New client connected: ${clientId}`);

      const clientConnection: ClientConnection = {
        ws,
        id: clientId,
        geminiWs: null,
        isSetupComplete: false
      };

      this.clients.set(clientId, clientConnection);

      ws.on('message', async (message: string) => {
        try {
          const data = JSON.parse(message);
          await this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error(`[Proxy] Error handling client message:`, error);
        }
      });

      ws.on('close', () => {
        console.log(`[Proxy] Client disconnected: ${clientId}`);
        this.cleanupClient(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[Proxy] Client error:`, error);
        this.cleanupClient(clientId);
      });
    });
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private async handleClientMessage(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (data.type === 'connect') {
      await this.connectToGemini(client);
    } else if (data.type === 'media_chunk') {
      this.forwardToGemini(client, data);
    } else if (data.type === 'disconnect') {
      this.cleanupClient(clientId);
    }
  }

  private async connectToGemini(client: ClientConnection) {
    if (client.geminiWs) return;

    try {
      const geminiWs = new WebSocket(WS_URL);
      client.geminiWs = geminiWs;

      geminiWs.on('open', () => {
        console.log(`[Proxy] Gemini connection opened for client ${client.id}`);
        this.sendInitialSetup(geminiWs);
      });

      geminiWs.on('message', (data: any) => {
        this.forwardToClient(client, data);
      });

      geminiWs.on('close', () => {
        console.log(`[Proxy] Gemini connection closed for client ${client.id}`);
        this.cleanupGeminiConnection(client.id);
      });

      geminiWs.on('error', (error) => {
        console.error(`[Proxy] Gemini connection error for client ${client.id}:`, error);
        this.cleanupGeminiConnection(client.id);
      });

    } catch (error) {
      console.error(`[Proxy] Error connecting to Gemini for client ${client.id}:`, error);
      this.cleanupGeminiConnection(client.id);
    }
  }

  private sendInitialSetup(ws: WebSocket) {
    const setupMessage = {
      setup: {
        model: MODEL,
        generation_config: {
          response_modalities: ["TEXT"]
        },
        system_instruction: {
          parts: [{
            text: `You are a real-time transcription assistant. For each audio input, respond in the following format:

TRANSCRIPTION: [transcribe the audio content here, please use chinese or english only]
KEYWORDS: [list any technical terms, specialized vocabulary, or complex concepts that might be difficult for a general audience to understand, separated by commas. If none, leave empty]

Example:
TRANSCRIPTION: The quantum entanglement phenomenon demonstrates non-local correlations between particles.
KEYWORDS: quantum entanglement, non-local correlations

If there are no difficult terms, respond with empty keywords:
TRANSCRIPTION: The weather is nice today.
KEYWORDS:`
          }]
        }
      }
    };
    ws.send(JSON.stringify(setupMessage));
  }

  private forwardToGemini(client: ClientConnection, data: any) {
    if (!client.geminiWs || !client.isSetupComplete) return;

    try {
      const message = {
        realtime_input: {
          media_chunks: [{
            mime_type: data.mimeType === "audio/pcm" ? "audio/pcm" : data.mimeType,
            data: data.chunk
          }]
        }
      };
      client.geminiWs.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[Proxy] Error forwarding to Gemini:`, error);
    }
  }

  private forwardToClient(client: ClientConnection, data: any) {
    try {
      if (data.setupComplete) {
        client.isSetupComplete = true;
      }
      client.ws.send(data);
    } catch (error) {
      console.error(`[Proxy] Error forwarding to client:`, error);
    }
  }

  private cleanupClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      this.cleanupGeminiConnection(clientId);
      client.ws.close();
      this.clients.delete(clientId);
    }
  }

  private cleanupGeminiConnection(clientId: string) {
    const client = this.clients.get(clientId);
    if (client?.geminiWs) {
      client.geminiWs.close();
      client.geminiWs = null;
      client.isSetupComplete = false;
    }
  }
} 