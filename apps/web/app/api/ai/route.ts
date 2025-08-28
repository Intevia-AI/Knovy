/**
 * @module AIService
 * @description API endpoint for interacting with Google's Gemini AI model
 */
import { google } from "@ai-sdk/google";
import { generateText, CoreMessage, UserContent } from "ai";
import { NextResponse } from "next/server";

/**
 * @interface AIRequest
 * @description Interface representing the structure of an AI request payload
 * @property {any[]} messages - Array of message objects with role and content properties
 * @property {string} [action] - Optional action to perform (e.g., "analyze", "summarize")
 * @property {Object} [data] - Optional additional data for the request
 * @property {string} [data.text] - Optional text data
 * @property {number} [data.timestamp] - Optional timestamp for the request
 * @property {string} [data.screenshot] - Optional base64-encoded screenshot image
 */
interface AIRequest {
  messages: any[];
  action?: string;
  data?: {
    text?: string;
    timestamp?: number;
    screenshot?: string;
    audioInputs?: { data: string; mimeType: string; label: string }[];
  };
}

/**
 * @function POST
 * @description Handles POST requests to the AI endpoint, processing messages and generating responses using Google's Gemini model
 * @route POST /api/ai
 * @param {Request} request - The incoming HTTP request object
 *
 * @requestBody {AIRequest} - The request body should conform to the AIRequest interface
 * @requestExample
 * {
 *   "messages": [
 *     { "role": "user", "content": "What is machine learning?" }
 *   ],
 *   "data": {
 *     "screenshot": "base64-encoded-image-data" // Optional
 *   }
 * }
 *
 * @responseBody {Object} - The response containing the AI-generated content
 * @responseExample
 * {
 *   "id": "ai-1626984512345",
 *   "role": "assistant",
 *   "content": "Machine learning is a subset of artificial intelligence..."
 * }
 *
 * @errorResponse {Object} - Error response when the request fails
 * @errorExample
 * {
 *   "error": "Failed to process AI request: Invalid message format"
 * }
 *
 * @returns {Promise<NextResponse>} JSON response with the generated text or error message
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Received request body:", JSON.stringify(body, null, 2));

    const { messages, data } = body as AIRequest;

    // Format messages for the AI
    const formatted: CoreMessage[] = messages.map((msg: any) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    console.log("Formatted messages:", JSON.stringify(formatted, null, 2));

    // If there's a screenshot or audio, add it to the last user message
    const lastUserMessage = formatted[formatted.length - 1];
    if (lastUserMessage && lastUserMessage.role === "user") {
      const content: UserContent = [{ type: "text", text: lastUserMessage.content as string }];

      if (data?.screenshot) {
        console.log("Processing screenshot data...");
        (content as any[]).push({ type: "image", image: data.screenshot });
      }

      if (data?.audioInputs && data.audioInputs.length > 0) {
        console.log("Processing audio data...");
        for (const audio of data.audioInputs) {
          (content as any[]).push({
            type: "file",
            data: Buffer.from(audio.data, "base64"),
            mimeType: audio.mimeType,
          });
        }
      }

      if ((content as any[]).length > 1) {
        lastUserMessage.content = content;
        console.log("Updated last user message with multimodal content");
      }
    }

    // Generate text using the Gemini model with search grounding enabled
    console.log("Generating text with Gemini model...");
    const { text } = await generateText({
      model: google("gemini-2.5-flash", {
        useSearchGrounding: true,
      }),
      messages: formatted,
    });

    console.log("Generated text:", text);
    const headers = new Headers();
    headers.set("Content-Type", "application/json");
    headers.set("Access-Control-Allow-Origin", "*");
    headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    headers.set("Access-Control-Allow-Headers", "Content-Type");

    return NextResponse.json(
      {
        id: `ai-${Date.now()}`,
        role: "assistant",
        content: text,
      },
      { headers },
    );
  } catch (error) {
    console.error("Detailed error in AI route:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
    // Return a 500 error response with details
    return NextResponse.json(
      {
        error: `Failed to process AI request: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 },
    );
  }
}

/**
 * @function OPTIONS
 * @description Handles OPTIONS requests for CORS preflight checks
 * @route OPTIONS /api/ai
 * @param {Request} request - The incoming HTTP request object
 *
 * @returns {Response} Empty response with CORS headers
 */
export async function OPTIONS(request: Request) {
  const headers = new Headers();
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  return new Response(null, { headers });
}
