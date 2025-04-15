import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const MODEL = "models/gemini-2.0-flash-exp";
const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

// Security checks
if (!API_KEY) {
  throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set in environment variables. Please check your .env.local file.');
}

// Rate limiting configuration
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxConnections: 100, // limit each IP to 100 connections per windowMs
};

const connectionCounts = new Map();

class GeminiProxyServer {
  constructor(port) {
    this.wss = new WebSocketServer({ port });
    this.clients = new Map();
    this.setupServer();
  }

  setupServer() {
    this.wss.on('connection', (ws, req) => {
      // Get client IP
      const clientIp = req.socket.remoteAddress;
      
      // Rate limiting
      const now = Date.now();
      const clientConnections = connectionCounts.get(clientIp) || [];
      const recentConnections = clientConnections.filter(time => now - time < RATE_LIMIT.windowMs);
      
      if (recentConnections.length >= RATE_LIMIT.maxConnections) {
        console.log(`[Proxy] Rate limit exceeded for IP: ${clientIp}`);
        ws.close(1008, 'Rate limit exceeded');
        return;
      }
      
      recentConnections.push(now);
      connectionCounts.set(clientIp, recentConnections);

      const clientId = this.generateClientId();
      console.log(`[Proxy] New client connected: ${clientId} from IP: ${clientIp}`);

      const clientConnection = {
        ws,
        id: clientId,
        ip: clientIp,
        geminiWs: null,
        isSetupComplete: false,
        lastActivity: Date.now()
      };

      this.clients.set(clientId, clientConnection);

      // Set up activity monitoring
      const activityInterval = setInterval(() => {
        const now = Date.now();
        if (now - clientConnection.lastActivity > 5 * 60 * 1000) { // 5 minutes inactivity
          console.log(`[Proxy] Client ${clientId} inactive for too long, disconnecting`);
          this.cleanupClient(clientId);
        }
      }, 60 * 1000); // Check every minute

      ws.on('message', async (message) => {
        try {
          clientConnection.lastActivity = Date.now();
          const data = JSON.parse(message);
          await this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error(`[Proxy] Error handling client message:`, error);
        }
      });

      ws.on('close', () => {
        console.log(`[Proxy] Client disconnected: ${clientId}`);
        clearInterval(activityInterval);
        this.cleanupClient(clientId);
      });

      ws.on('error', (error) => {
        console.error(`[Proxy] Client error:`, error);
        clearInterval(activityInterval);
        this.cleanupClient(clientId);
      });
    });
  }

  generateClientId() {
    return Math.random().toString(36).substring(2, 15);
  }

  async handleClientMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (data.type === 'connect') {
      console.log(`[Proxy] Client ${clientId} connecting to Gemini...`);
      await this.connectToGemini(client);
    } else if (data.type === 'media_chunk') {
      console.log(`[Proxy] Received media chunk from client ${clientId}, size: ${data.chunk.length}`);
      this.forwardToGemini(client, data);
    } else if (data.type === 'disconnect') {
      console.log(`[Proxy] Client ${clientId} disconnecting...`);
      this.cleanupClient(clientId);
    } else {
      console.log(`[Proxy] Unknown message type from client ${clientId}:`, data.type);
    }
  }

  async connectToGemini(client) {
    if (client.geminiWs) return;

    try {
      const geminiWs = new WebSocket(WS_URL);
      client.geminiWs = geminiWs;

      geminiWs.on('open', () => {
        console.log(`[Proxy] Gemini connection opened for client ${client.id}`);
        this.sendInitialSetup(geminiWs);
      });

      geminiWs.on('message', (data) => {
        console.log(`[Proxy] Received raw data from Gemini for client ${client.id}:`, data.toString());
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

  sendInitialSetup(ws) {
    console.log("[Proxy] Sending initial setup");
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

  forwardToGemini(client, data) {
    if (!client.geminiWs || !client.isSetupComplete) {
      console.log(`[Proxy] Cannot forward to Gemini: geminiWs=${!!client.geminiWs}, isSetupComplete=${client.isSetupComplete}`);
      return;
    }

    try {
      const message = {
        realtime_input: {
          media_chunks: [{
            mime_type: data.mimeType,
            data: data.chunk
          }]
        }
      };
      console.log(`[Proxy] Forwarding media chunk to Gemini, size: ${data.chunk.length}`);
      client.geminiWs.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[Proxy] Error forwarding to Gemini:`, error);
    }
  }

  forwardToClient(client, data) {
    try {
      console.log(`[Proxy] Processing Gemini response for client ${client.id}`);
      const messageData = JSON.parse(data);
      console.log(`[Proxy] Parsed message data:`, JSON.stringify(messageData, null, 2));
      
      if (messageData.setupComplete) {
        console.log(`[Proxy] Setup complete for client ${client.id}`);
        client.isSetupComplete = true;
        client.ws.send(JSON.stringify({ setupComplete: true }));
        return;
      }

      if (messageData.serverContent?.modelTurn?.parts) {
        console.log(`[Proxy] Received response from Gemini for client ${client.id}`);
        const parts = messageData.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.text) {
            console.log(`[Proxy] Forwarding text to client ${client.id}: ${part.text}`);
            client.ws.send(JSON.stringify({ text: part.text }));
          }
        }
      } else if (messageData.error) {
        console.error(`[Proxy] Gemini returned an error:`, messageData.error);
        client.ws.send(JSON.stringify({ error: messageData.error }));
      } else {
        console.log(`[Proxy] Unhandled message type:`, messageData);
      }
    } catch (error) {
      console.error(`[Proxy] Error processing Gemini response:`, error);
      console.error(`[Proxy] Raw data that caused error:`, data.toString());
    }
  }

  cleanupClient(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      this.cleanupGeminiConnection(clientId);
      client.ws.close();
      this.clients.delete(clientId);
    }
  }

  cleanupGeminiConnection(clientId) {
    const client = this.clients.get(clientId);
    if (client?.geminiWs) {
      client.geminiWs.close();
      client.geminiWs = null;
      client.isSetupComplete = false;
    }
  }
}

const PORT = process.env.PROXY_PORT || 8080;
const proxyServer = new GeminiProxyServer(PORT);
console.log(`[Proxy] Server started on port ${PORT}`); 