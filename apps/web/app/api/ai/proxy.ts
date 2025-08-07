/**
 * @module GeminiProxyService
 * @description WebSocket proxy server for Google's Gemini AI model
 * @requires ws
 * @requires @google/generative-ai
 * @requires dotenv
 */
import { WebSocketServer, WebSocket } from "ws";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();

const MODEL = "models/gemini-2.0-flash-live-001";
const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

if (!API_KEY) {
  throw new Error("GEMINI_API_KEY is not set in environment variables");
}

/**
 * @interface ClientConnection
 * @description Represents a client connection to the proxy server
 * @property {WebSocket} ws - The WebSocket connection to the client
 * @property {string} id - Unique identifier for the client connection
 * @property {WebSocket|null} geminiWs - The WebSocket connection to the Gemini API
 * @property {boolean} isSetupComplete - Whether the initial setup with Gemini is complete
 * @property {number} lastActivity - Timestamp of the last activity from this client
 */
interface ClientConnection {
  ws: WebSocket;
  id: string;
  geminiWs: WebSocket | null;
  isSetupComplete: boolean;
  lastActivity: number;
}

/**
 * @class GeminiProxyServer
 * @description WebSocket proxy server that handles connections between clients and Google's Gemini API
 * @property {WebSocketServer} wss - The WebSocket server instance
 * @property {Map<string, ClientConnection>} clients - Map of client connections by ID
 * @property {Map<string, WebSocket>} geminiConnections - Map of Gemini WebSocket connections by client ID
 * @property {Map<string, number>} reconnectAttempts - Map of reconnection attempts by client ID
 * @property {number} maxReconnectAttempts - Maximum number of reconnection attempts
 * @property {number} reconnectTimeout - Base timeout in ms between reconnection attempts
 * @property {number} healthCheckInterval - Interval in ms for health checks
 * @property {Map<string, NodeJS.Timeout>} healthCheckTimers - Map of health check timers by client ID
 */
export class GeminiProxyServer {
  private wss: WebSocketServer;
  private clients: Map<string, ClientConnection> = new Map();
  private geminiConnections: Map<string, WebSocket> = new Map();
  private reconnectAttempts: Map<string, number> = new Map();
  private maxReconnectAttempts: number = 5;
  private reconnectTimeout: number = 1000;
  private healthCheckInterval: number = 30000; // 30 seconds
  private healthCheckTimers: Map<string, NodeJS.Timeout> = new Map();

  /**
   * @constructor
   * @description Creates a new GeminiProxyServer instance
   * @param {number} port - The port number to listen on
   */
  constructor(port: number) {
    this.wss = new WebSocketServer({ port });
    this.setupServer();
  }

  /**
   * @method setupServer
   * @private
   * @description Sets up the WebSocket server and event handlers
   * @returns {void}
   */
  private setupServer() {
    this.wss.on("connection", (ws: WebSocket) => {
      const clientId = this.generateClientId();
      console.log(`[Proxy] New client connected: ${clientId}`);

      const clientConnection: ClientConnection = {
        ws,
        id: clientId,
        geminiWs: null,
        isSetupComplete: false,
        lastActivity: Date.now(),
      };

      this.clients.set(clientId, clientConnection);

      // Set up health check for this client
      this.setupHealthCheck(clientId);

      ws.on("message", async (message: string) => {
        try {
          clientConnection.lastActivity = Date.now();
          const data = JSON.parse(message);
          await this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error(`[Proxy] Error handling client message:`, error);
        }
      });

      ws.on("close", () => {
        console.log(`[Proxy] Client disconnected: ${clientId}`);
        this.cleanupClient(clientId);
      });

      ws.on("error", (error) => {
        console.error(`[Proxy] Client error:`, error);
        this.cleanupClient(clientId);
      });
    });
  }

  private setupHealthCheck(clientId: string) {
    // Clear any existing health check timer
    const existingTimer = this.healthCheckTimers.get(clientId);
    if (existingTimer) {
      clearInterval(existingTimer);
    }

    // Set up new health check timer
    const timer = setInterval(() => {
      const client = this.clients.get(clientId);
      if (!client) {
        clearInterval(timer);
        this.healthCheckTimers.delete(clientId);
        return;
      }

      const now = Date.now();
      if (now - client.lastActivity > this.healthCheckInterval) {
        console.log(
          `[Proxy] Client ${clientId} inactive for too long, sending ping`,
        );
        try {
          client.ws.ping();
        } catch (error) {
          console.error(
            `[Proxy] Error sending ping to client ${clientId}:`,
            error,
          );
          this.cleanupClient(clientId);
        }
      }

      // Check Gemini connection health
      if (client.geminiWs && client.geminiWs.readyState === WebSocket.OPEN) {
        try {
          client.geminiWs.ping();
        } catch (error) {
          console.error(
            `[Proxy] Error sending ping to Gemini for client ${clientId}:`,
            error,
          );
          this.attemptReconnect(client);
        }
      }
    }, this.healthCheckInterval);

    this.healthCheckTimers.set(clientId, timer);
  }

  private generateClientId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * @method handleClientMessage
   * @private
   * @description Handles messages received from clients
   * @param {string} clientId - The ID of the client sending the message
   * @param {any} data - The message data
   * @returns {Promise<void>}
   * 
   * @remarks
   * Handles three types of messages:
   * - "connect": Establishes a connection to the Gemini API
   * - "media_chunk": Forwards audio data to the Gemini API
   * - "disconnect": Cleans up the client connection
   */
  private async handleClientMessage(clientId: string, data: any) {
    const client = this.clients.get(clientId);
    if (!client) return;

    if (data.type === "connect") {
      await this.connectToGemini(client);
    } else if (data.type === "media_chunk") {
      this.forwardToGemini(client, data);
    } else if (data.type === "disconnect") {
      this.cleanupClient(clientId);
    }
  }

  /**
   * @method connectToGemini
   * @private
   * @description Establishes a WebSocket connection to the Gemini API for a client
   * @param {ClientConnection} client - The client connection
   * @returns {Promise<void>}
   * 
   * @remarks
   * Sets up event handlers for the Gemini WebSocket connection:
   * - "open": Sends initial setup message to Gemini
   * - "message": Forwards messages from Gemini to the client
   * - "close": Cleans up the connection and attempts to reconnect
   * - "error": Handles errors and attempts to reconnect
   * - "ping"/"pong": Handles WebSocket ping/pong for connection health checks
   */
  private async connectToGemini(client: ClientConnection) {
    if (client.geminiWs) return;

    try {
      const geminiWs = new WebSocket(WS_URL);
      client.geminiWs = geminiWs;

      geminiWs.on("open", () => {
        console.log(`[Proxy] Gemini connection opened for client ${client.id}`);
        this.reconnectAttempts.set(client.id, 0); // Reset reconnect attempts
        this.sendInitialSetup(geminiWs);
      });

      geminiWs.on("message", (data: any) => {
        this.forwardToClient(client, data);
      });

      geminiWs.on("close", () => {
        console.log(`[Proxy] Gemini connection closed for client ${client.id}`);
        this.cleanupGeminiConnection(client.id);
        this.attemptReconnect(client);
      });

      geminiWs.on("error", (error) => {
        console.error(
          `[Proxy] Gemini connection error for client ${client.id}:`,
          error,
        );
        this.cleanupGeminiConnection(client.id);
        this.attemptReconnect(client);
      });

      geminiWs.on("ping", () => {
        geminiWs.pong();
      });

      geminiWs.on("pong", () => {
        // Connection is healthy
        client.lastActivity = Date.now();
      });
    } catch (error) {
      console.error(
        `[Proxy] Error connecting to Gemini for client ${client.id}:`,
        error,
      );
      this.cleanupGeminiConnection(client.id);
      this.attemptReconnect(client);
    }
  }

  private sendInitialSetup(ws: WebSocket) {
    const setupMessage = {
      setup: {
        model: MODEL,
        generation_config: {
          response_modalities: ["TEXT"],
          streaming: true,
          max_output_tokens: 2048,
          temperature: 0.1,
          top_p: 0.8,
          top_k: 40,
        },
        system_instruction: {
          parts: [
            {
              text: `You are a real-time transcription assistant. For each audio input, respond in the following format:

TRANSCRIPTION: [transcribe the audio content here, the speaker will be speaking in chinese. Please respond in chinese.]
KEYWORDS: [list any technical terms, specialized vocabulary, or complex concepts that might be difficult for a general audience to understand, separated by commas. If none, leave empty]

Example:
TRANSCRIPTION: The quantum entanglement phenomenon demonstrates non-local correlations between particles.
KEYWORDS: quantum entanglement, non-local correlations

If there are no difficult terms, respond with empty keywords:
TRANSCRIPTION: The weather is nice today.
KEYWORDS:`,
            },
          ],
        },
      },
    };
    ws.send(JSON.stringify(setupMessage));
  }

  private forwardToGemini(client: ClientConnection, data: any) {
    if (!client.geminiWs || !client.isSetupComplete) return;

    try {
      const message = {
        realtime_input: {
          media_chunks: [
            {
              mime_type:
                data.mimeType === "audio/pcm" ? "audio/pcm" : data.mimeType,
              data: data.chunk,
            },
          ],
        },
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
      // Clear health check timer
      const healthCheckTimer = this.healthCheckTimers.get(clientId);
      if (healthCheckTimer) {
        clearInterval(healthCheckTimer);
        this.healthCheckTimers.delete(clientId);
      }

      this.cleanupGeminiConnection(clientId);
      client.ws.close();
      this.clients.delete(clientId);
      this.reconnectAttempts.delete(clientId);
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

  private attemptReconnect(client: ClientConnection) {
    const attempts = this.reconnectAttempts.get(client.id) || 0;
    if (attempts < this.maxReconnectAttempts) {
      this.reconnectAttempts.set(client.id, attempts + 1);
      const delay = this.reconnectTimeout * (attempts + 1);
      console.log(
        `[Proxy] Attempting to reconnect to Gemini for client ${client.id} (${attempts + 1}/${this.maxReconnectAttempts}) in ${delay}ms`,
      );
      setTimeout(() => this.connectToGemini(client), delay);
    } else {
      console.log(
        `[Proxy] Max reconnection attempts reached for client ${client.id}`,
      );
      this.cleanupClient(client.id);
    }
  }
}
