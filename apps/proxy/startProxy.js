/**
 * @module GeminiProxyServer
 * @description WebSocket proxy server for Google's Gemini AI model that handles real-time audio transcription and AI responses
 * @requires ws
 * @requires dotenv
 * @requires path
 * @requires http
 * 
 * This server acts as a bridge between client applications and Google's Gemini AI API.
 * It handles WebSocket connections from clients, forwards audio data to Gemini,
 * and streams back AI-generated responses. The server supports multiple concurrent
 * client connections with rate limiting and automatic cleanup of inactive connections.
 * It also includes an HTTP server for health checks.
 */

import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
import { WebSocket } from 'ws';
import path from 'path';
import http from 'http';

/**
 * Load environment variables from .env file
 * First tries the standard .env file, then falls back to .env.local for backward compatibility
 * @description This ensures the application can find API keys and other configuration in different environments
 */
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
// Also try .env.local as fallback for backward compatibility
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });
}

/**
 * @constant {string} MODEL - The Gemini model identifier used for real-time audio processing
 * @constant {string} API_KEY - Google Generative AI API key from environment variables
 * @constant {string} HOST - Google's generative language API host
 * @constant {string} WS_URL - WebSocket URL for connecting to the Gemini API with authentication
 */
const MODEL = "models/gemini-2.0-flash-live-001";
const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

/**
 * @function validateEnvironment
 * @description Validates that all required environment variables are present
 * @throws {Error} If any required environment variables are missing
 * @returns {boolean} True if all required variables are present
 * 
 * @remarks
 * This function checks for the presence of critical environment variables
 * and provides detailed error messages with hints on how to obtain them
 * if they are missing. This helps developers quickly resolve configuration issues.
 */
function validateEnvironment() {
  const requiredVars = [
    {
      name: 'GOOGLE_GENERATIVE_AI_API_KEY',
      description: 'Google Generative AI API Key for Gemini integration',
      hint: 'Obtain from Google AI Studio (https://aistudio.google.com/app/apikey)'
    }
  ];

  const missingVars = requiredVars.filter(
    variable => !process.env[variable.name]
  );

  if (missingVars.length > 0) {
    console.error('\n❌ Environment Validation Error ❌');
    console.error('The following required environment variables are missing:');
    
    missingVars.forEach(variable => {
      console.error(`\n  → ${variable.name}`);
      console.error(`    Description: ${variable.description}`);
      console.error(`    Hint: ${variable.hint}`);
    });
    
    console.error('\nPlease check your .env file and ensure all required variables are set.');
    console.error('You can copy the .env.example file to .env to get started:\n');
    console.error('  cp .env.example .env\n');
    
    throw new Error('Missing required environment variables');
  }
  
  return true;
}

// Validate environment variables
validateEnvironment();

/**
 * @constant {Object} RATE_LIMIT - Configuration for rate limiting client connections
 * @property {number} windowMs - Time window in milliseconds for rate limiting (15 minutes)
 * @property {number} maxConnections - Maximum number of connections allowed per IP in the time window
 */
const RATE_LIMIT = {
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxConnections: 100, // limit each IP to 100 connections per windowMs
};

/**
 * @type {Map<string, Array<number>>}
 * @description Tracks connection timestamps by IP address for rate limiting
 * Each IP maps to an array of connection timestamps within the rate limit window
 */
const connectionCounts = new Map();

/**
 * @class GeminiProxyServer
 * @description WebSocket proxy server that handles connections between clients and Google's Gemini API
 * @property {WebSocketServer} wss - The WebSocket server instance
 * @property {Map<string, Object>} clients - Map of client connections by ID
 */
class GeminiProxyServer {
  /**
   * @constructor
   * @description Creates a new GeminiProxyServer instance
   * @param {number} port - The port number to listen on
   */
  constructor(port) {
    const server = http.createServer((req, res) => {
      if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end('OK');
      } else {
        res.writeHead(404);
        res.end();
      }
    });

    this.wss = new WebSocketServer({ server });
    this.clients = new Map();
    
    server.listen(port, () => {
      console.log(`[Proxy] Server started on port ${port}`);
    });

    this.setupServer();
  }

  /**
   * @method setupServer
   * @description Sets up the WebSocket server and event handlers for client connections
   * @private
   * 
   * This method configures the WebSocket server to:
   * 1. Accept new client connections with rate limiting
   * 2. Create a unique client ID and connection object
   * 3. Set up activity monitoring to disconnect inactive clients
   * 4. Handle client messages, connection closures, and errors
   */
  setupServer() {
    this.wss.on('connection', (ws, req) => {
      // Get client IP
      const clientIp = req.socket.remoteAddress;
      
      // Rate limiting - prevents abuse by limiting connections per IP
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

      // Create client connection object with default settings
      const clientConnection = {
        ws,
        id: clientId,
        ip: clientIp,
        geminiWs: null,
        isSetupComplete: false,
        lastActivity: Date.now(),
        language: 'zh-TW'
      };

      this.clients.set(clientId, clientConnection);

      // Set up activity monitoring to disconnect inactive clients
      const activityInterval = setInterval(() => {
        const now = Date.now();
        if (now - clientConnection.lastActivity > 5 * 60 * 1000) { // 5 minutes inactivity
          console.log(`[Proxy] Client ${clientId} inactive for too long, disconnecting`);
          this.cleanupClient(clientId);
        }
      }, 60 * 1000); // Check every minute

      // Handle incoming messages from the client
      ws.on('message', async (message) => {
        try {
          clientConnection.lastActivity = Date.now();
          const data = JSON.parse(message);
          await this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error(`[Proxy] Error handling client message:`, error);
        }
      });

      // Handle client disconnection
      ws.on('close', () => {
        console.log(`[Proxy] Client disconnected: ${clientId}`);
        clearInterval(activityInterval);
        this.cleanupClient(clientId);
      });

      // Handle client errors
      ws.on('error', (error) => {
        console.error(`[Proxy] Client error:`, error);
        clearInterval(activityInterval);
        this.cleanupClient(clientId);
      });
    });
  }

  /**
   * @method generateClientId
   * @description Generates a random unique identifier for a client connection
   * @returns {string} A random string to use as client ID
   * @private
   */
  generateClientId() {
    return Math.random().toString(36).substring(2, 15);
  }

  /**
   * @method handleClientMessage
   * @description Processes messages received from clients and takes appropriate actions
   * @param {string} clientId - The ID of the client sending the message
   * @param {Object} data - The message data
   * @returns {Promise<void>}
   * @private
   * 
   * @remarks
   * Handles different types of client messages:
   * - "mode": Changes the AI operation mode (transcription or conversation)
   * - "custom_prompt": Sets a custom system prompt for the AI
   * - "language": Sets the preferred language for responses
   * - "media_chunk": Forwards audio data to Gemini
   * - "disconnect": Cleans up the client connection
   */
  async handleClientMessage(clientId, data) {
    const client = this.clients.get(clientId);
    if (!client) {
      console.log(`[Proxy] Client ${clientId} not found`);
      return;
    }

    if (data.type === "mode") {
      console.log(`[Proxy] Client ${clientId} set mode to: ${data.mode}`);
      client.mode = data.mode;
      if (client.geminiWs) {
        this.sendInitialSetup(client.geminiWs, data.mode, client.customPrompt, client.language);
      }
      return;
    }

    if (data.type === "custom_prompt") {
      console.log(`[Proxy] Client ${clientId} set custom prompt`);
      client.customPrompt = data.prompt;
      if (client.geminiWs) {
        this.sendInitialSetup(client.geminiWs, client.mode, client.customPrompt, client.language);
      }
      return;
    }

    if (data.type === "language") {
      console.log(`[Proxy] Client ${clientId} set language to: ${data.language}`);
      client.language = data.language;
      if (client.geminiWs) {
        this.sendInitialSetup(client.geminiWs, client.mode, client.customPrompt, client.language);
      }
      return;
    }

    if (data.type === "media_chunk") {
      if (!client.geminiWs) {
        await this.connectToGemini(client);
      }
      this.forwardToGemini(client, data);
    } else if (data.type === 'disconnect') {
      console.log(`[Proxy] Client ${clientId} disconnecting...`);
      this.cleanupClient(clientId);
    } else {
      console.log(`[Proxy] Unknown message type from client ${clientId}:`, data.type);
    }
  }

  /**
   * @method connectToGemini
   * @description Establishes a WebSocket connection to the Gemini API for a client
   * @param {Object} client - The client connection object
   * @returns {Promise<void>}
   * @private
   * 
   * @remarks
   * Sets up event handlers for the Gemini WebSocket connection:
   * - "open": Sends initial setup message to Gemini with client preferences
   * - "message": Forwards responses from Gemini to the client
   * - "close": Cleans up the connection
   * - "error": Handles connection errors
   */
  async connectToGemini(client) {
    if (client.geminiWs) return;

    try {
      const geminiWs = new WebSocket(WS_URL);
      client.geminiWs = geminiWs;

      geminiWs.on('open', () => {
        console.log(`[Proxy] Gemini connection opened for client ${client.id}`);
        this.sendInitialSetup(geminiWs, client.mode || 'transcription', client.customPrompt || null, client.language || 'zh-TW');
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

  sendInitialSetup(ws, mode = 'transcription', customPrompt = null, language = 'zh-TW') {
    console.log(`[Proxy] Sending initial setup for mode: ${mode}, customPrompt: ${customPrompt}, language: ${language}`);
    let systemInstruction;
    
    if (mode === 'transcription') {
      systemInstruction = `You are a real-time transcription assistant. For each audio input, respond in the following format, please respond as fast as possible:

TRANSCRIPTION: [transcribe the audio content here. If the language is different from ${language}, please translate to ${language}. But if the language is original, please only do transcription.]
KEYWORDS: [list any technical terms, specialized vocabulary, or complex concepts that might be difficult for a general audience to understand, separated by commas. If none, leave empty]

Example:
TRANSCRIPTION: The quantum entanglement phenomenon demonstrates non-local correlations between particles.
KEYWORDS: quantum entanglement, non-local correlations

If there are no difficult terms, respond with empty keywords:
TRANSCRIPTION: The weather is nice today.
KEYWORDS:
`;
    } else {
      if (customPrompt) {
        systemInstruction = customPrompt;
      } else {
        systemInstruction = `You are an AI assistant in a meeting. Your job is to listen silently and only respond when truly necessary, with natural spoken-style answers that the user can directly read out loud. Follow these strict rules:


1. Wait until a full speaker turn or a complete sentence is received before making any decision. Do NOT react to partial input.
2. Do NOT ask questions or take any initiative. You are purely reactive.
3. Do NOT respond to greetings, small talk, or simple confirmations (such as "okay," "hi," "do you get it?").
4. Only respond if the full utterance clearly:
   - Contains a request for help or request for information
   - Includes a complex or technical question
   - Shows confusion or ambiguity that needs clarification
   - If the input uses imperative language (e.g., "Explain this", "Fix the code", "Give me an answer", "Summarize this", "Help me with this"), treat it as a valid request and respond accordingly

5. Please respond at least 50 words.
6. If none of these are detected, respond with: NULL
7. Please answer the question detailed, business-oriented, professional and academically.
8. For web-related questions (such as real-time info or news), or if you think search web is needed for answering the question, respond with: [WEB] {user question here}


User: What is the stock price of NVIDIA?
Assistant: [WEB] What is the stock price of NVIDIA?

Please answer in ${language} !!!!!`;
      }

    }

    console.log(`[Proxy] System instruction: ${systemInstruction}`);
    const setupMessage = {
      setup: {
        model: MODEL,
        generation_config: {
          response_modalities: ["TEXT"],
        },
        system_instruction: {
          parts: [{
            text: systemInstruction
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
            client.ws.send(JSON.stringify({ 
              text: part.text,
              turnComplete: false
            }));
          }
        }
      } else if (messageData.serverContent?.turnComplete === true) {
        console.log(`[Proxy] Turn complete received for client ${client.id}`);
        client.ws.send(JSON.stringify({ 
          text: "search web",
          turnComplete: true
        }));
      } else if (messageData.error) {
        console.error(`[Proxy] Gemini returned an error:`, messageData.error);
        client.ws.send(JSON.stringify({ error: messageData.error }));
      } else {
        console.log("[WebSocket] Message data:", messageData);
        console.log("[WebSocket] Turn complete value:", messageData.serverContent?.turnComplete);
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

/**
 * @constant {number} PORT - The port number the proxy server will listen on
 * Uses the PROXY_PORT environment variable if set, otherwise defaults to 4567
 */
const PORT = process.env.PROXY_PORT || 4567;

/**
 * @instance
 * @description Creates and starts the GeminiProxyServer instance
 * This is the main entry point for the proxy server application
 */
new GeminiProxyServer(PORT);