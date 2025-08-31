import { WebSocketServer, WebSocket } from "ws";
import http from "http";
import https from "https";
import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import path from "path";

// --- Type Definitions ---
interface ClientConnection {
  ws: WebSocket;
  id: string;
  ip: string;
  geminiWs: WebSocket | null;
  isSetupComplete: boolean;
  lastActivity: number;
  language: string;
  mode: "transcription" | "conversation";
  customPrompt: string | null;
}

interface RateLimit {
  windowMs: number;
  maxConnections: number;
}

// --- Environment and Constants ---
dotenv.config({ path: path.resolve(process.cwd(), ".env") });
if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
  dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });
}

const MODEL = "models/gemini-2.0-flash-live-001";
const API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
const HOST = "generativelanguage.googleapis.com";
const WS_URL = `wss://${HOST}/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`;

function validateEnvironment() {
  if (!API_KEY) {
    console.error("\nEnvironment Validation Error");
    console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY.");
    console.error("Hint: Obtain from Google AI Studio (https://aistudio.google.com/app/apikey)");
    throw new Error("Missing required environment variables");
  }
}

validateEnvironment();

// --- Main Server Class ---
class GeminiProxyServer {
  private wss: WebSocketServer;
  private clients = new Map<string, ClientConnection>();
  private connectionCounts = new Map<string, number[]>();
  private rateLimit: RateLimit = {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxConnections: 100,
  };

  constructor(port: number) {
    const app = express();
    app.use(cors());
    app.use(express.json());

    const server = http.createServer(app);

    app.get("/health", (req, res) => {
      res.status(200).send("OK");
    });

    app.post("/api/ai", (req, res) => {
      this.handleApiRequest(res, req.body);
    });

    this.wss = new WebSocketServer({ server });
    server.listen(port, () => {
      console.log(`[Proxy] Server started on port ${port}`);
    });

    this.setupServer();
  }

  private setupServer() {
    this.wss.on("connection", (ws: WebSocket, req: http.IncomingMessage) => {
      const clientIp = req.socket.remoteAddress;
      if (!clientIp) {
        ws.close(1008, "Could not determine client IP");
        return;
      }

      const now = Date.now();
      const clientConnections = this.connectionCounts.get(clientIp) || [];
      const recentConnections = clientConnections.filter(
        (time) => now - time < this.rateLimit.windowMs,
      );

      if (recentConnections.length >= this.rateLimit.maxConnections) {
        console.log(`[Proxy] Rate limit exceeded for IP: ${clientIp}`);
        ws.close(1008, "Rate limit exceeded");
        return;
      }

      recentConnections.push(now);
      this.connectionCounts.set(clientIp, recentConnections);

      const clientId = this.generateClientId();
      console.log(`[Proxy] New client connected: ${clientId} from IP: ${clientIp}`);

      const clientConnection: ClientConnection = {
        ws,
        id: clientId,
        ip: clientIp,
        geminiWs: null,
        isSetupComplete: false,
        lastActivity: Date.now(),
        language: "zh-TW",
        mode: "transcription",
        customPrompt: null,
      };

      this.clients.set(clientId, clientConnection);

      const activityInterval = setInterval(() => {
        if (Date.now() - clientConnection.lastActivity > 5 * 60 * 1000) {
          console.log(`[Proxy] Client ${clientId} inactive, disconnecting`);
          this.cleanupClient(clientId);
        }
      }, 60 * 1000);

      ws.on("message", (message: Buffer) => {
        clientConnection.lastActivity = Date.now();
        try {
          const data = JSON.parse(message.toString());
          this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error(`[Proxy] Error handling client message:`, error);
        }
      });

      ws.on("close", () => {
        console.log(`[Proxy] Client disconnected: ${clientId}`);
        clearInterval(activityInterval);
        this.cleanupClient(clientId);
      });

      ws.on("error", (error: Error) => {
        console.error(`[Proxy] Client error for ${clientIp}:`, error);
        clearInterval(activityInterval);
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

    if (data.type === "mode") {
      client.mode = data.mode;
      if (client.geminiWs)
        this.sendInitialSetup(client.geminiWs, client.mode, client.customPrompt, client.language);
    } else if (data.type === "custom_prompt") {
      client.customPrompt = data.prompt;
      if (client.geminiWs)
        this.sendInitialSetup(client.geminiWs, client.mode, client.customPrompt, client.language);
    } else if (data.type === "language") {
      client.language = data.language;
      if (client.geminiWs)
        this.sendInitialSetup(client.geminiWs, client.mode, client.customPrompt, client.language);
    } else if (data.type === "media_chunk") {
      if (!client.geminiWs) {
        await this.connectToGemini(client);
      }
      this.forwardToGemini(client, data);
    } else if (data.type === "disconnect") {
      this.cleanupClient(clientId);
    }
  }

  private async connectToGemini(client: ClientConnection) {
    if (client.geminiWs) return;

    try {
      console.log(`[Proxy] Connecting to Gemini for client ${client.id}`);
      const geminiWs = new WebSocket(WS_URL);
      client.geminiWs = geminiWs;

      geminiWs.on("open", () => {
        console.log(`[Proxy] Gemini connection opened for client ${client.id}`);
        this.sendInitialSetup(geminiWs, client.mode, client.customPrompt, client.language);
      });

      geminiWs.on("message", (data: Buffer) => {
        this.forwardToClient(client, data);
      });

      geminiWs.on("close", () => {
        console.log(`[Proxy] Gemini connection closed for client ${client.id}`);
        this.cleanupGeminiConnection(client.id);
      });

      geminiWs.on("error", (error) => {
        console.error(`[Proxy] Gemini connection error for client ${client.id}:`, error);
        this.cleanupGeminiConnection(client.id);
      });
    } catch (error) {
      console.error(`[Proxy] Error connecting to Gemini for client ${client.id}:`, error);
      this.cleanupGeminiConnection(client.id);
    }
  }

  private sendInitialSetup(
    ws: WebSocket,
    mode: string,
    customPrompt: string | null,
    language: string,
  ) {
    console.log(
      `[Proxy] Sending initial setup for mode: ${mode}, customPrompt: ${customPrompt}, language: ${language}`,
    );
    let systemInstructionText: string;

    if (mode === "transcription") {
      systemInstructionText = `You are a real-time transcription assistant. For each audio input, respond in the following format, please respond as fast as possible:

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
      systemInstructionText =
        customPrompt ||
        `You are an AI assistant in a meeting. Your job is to listen silently and only respond when truly necessary, with natural spoken-style answers that the user can directly read out loud. Follow these strict rules:


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

    const setupMessage = {
      setup: {
        model: MODEL,
        generation_config: { response_modalities: ["TEXT"] },
        system_instruction: { parts: [{ text: systemInstructionText }] },
      },
    };
    ws.send(JSON.stringify(setupMessage));
  }

  private forwardToGemini(client: ClientConnection, data: any) {
    if (!client.geminiWs || !client.isSetupComplete) {
      return;
    }
    try {
      const message = {
        realtime_input: {
          media_chunks: [{ mime_type: data.mimeType, data: data.chunk }],
        },
      };
      client.geminiWs.send(JSON.stringify(message));
    } catch (error) {
      console.error(`[Proxy] Error forwarding to Gemini:`, error);
    }
  }

  private forwardToClient(client: ClientConnection, data: Buffer) {
    try {
      const messageData = JSON.parse(data.toString());

      if (messageData.setupComplete) {
        client.isSetupComplete = true;
        client.ws.send(JSON.stringify({ setupComplete: true }));
        return;
      }

      if (messageData.serverContent?.modelTurn?.parts) {
        const parts = messageData.serverContent.modelTurn.parts;
        for (const part of parts) {
          if (part.text) {
            client.ws.send(JSON.stringify({ text: part.text, turnComplete: false }));
          }
        }
      } else if (messageData.serverContent?.turnComplete) {
        client.ws.send(JSON.stringify({ text: "search web", turnComplete: true }));
      }
    } catch (error) {
      console.error(`[Proxy] Error processing Gemini response:`, error);
    }
  }

  private async handleApiRequest(res: express.Response, body: any) {
    const { messages, data } = body;
    const geminiMessages = messages.map((msg: any) => ({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    }));

    if (data?.screenshot) {
      const lastMessage = geminiMessages[geminiMessages.length - 1];
      if (lastMessage?.role === "user") {
        lastMessage.parts.push({
          inline_data: { mime_type: "image/jpeg", data: data.screenshot.split(",")[1] },
        });
      }
    }

    const postData = JSON.stringify({ contents: geminiMessages });
    const options = {
      hostname: HOST,
      path: `/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(postData),
      },
    };

    const apiReq = https.request(options, (apiRes) => {
      let apiResBody = "";
      apiRes.on("data", (chunk) => (apiResBody += chunk));
      apiRes.on("end", () => {
        try {
          const geminiResponse = JSON.parse(apiResBody);
          const content = geminiResponse.candidates[0]?.content?.parts[0]?.text || "";
          res.status(200).json({ id: `ai-${Date.now()}`, role: "assistant", content });
        } catch (e) {
          res.status(500).json({ error: "Error processing Gemini response" });
        }
      });
    });
    apiReq.on("error", (error) => res.status(500).json({ error: "Failed to call Gemini API" }));
    apiReq.write(postData);
    apiReq.end();
  }

  private cleanupClient(clientId: string) {
    const client = this.clients.get(clientId);
    if (client) {
      console.log(`[Proxy] Client disconnected: ${client.id}`);
      this.cleanupGeminiConnection(client.id);
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

const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 4567;
new GeminiProxyServer(PORT);
