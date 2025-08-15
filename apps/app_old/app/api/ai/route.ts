/**
 * @fileoverview AI API route for processing chat messages and generating responses.
 * Handles text and image inputs using Google's Gemini model with search grounding.
 * Supports screenshot analysis and conversational AI interactions.
 */

import { google } from "@ai-sdk/google";
import { generateText, CoreMessage, UserContent } from "ai";
import { NextResponse } from "next/server";

/**
 * Request interface for AI API endpoint.
 *
 * @interface AIRequest
 * @property {any[]} messages - Array of conversation messages
 * @property {string} [action] - Optional action type for the request
 * @property {Object} [data] - Optional additional data
 * @property {string} [data.text] - Text content for processing
 * @property {number} [data.timestamp] - Timestamp of the request
 * @property {string} [data.screenshot] - Base64 encoded screenshot data
 */
interface AIRequest {
  messages: any[];
  action?: string;
  data?: {
    text?: string;
    timestamp?: number;
    screenshot?: string;
  };
}

/**
 * Handles POST requests to the AI API endpoint.
 * Processes conversation messages and optional screenshot data to generate
 * AI responses using Google's Gemini model with search grounding capabilities.
 *
 * @async
 * @function POST
 * @param {Request} request - The incoming HTTP request
 * @returns {Promise<NextResponse>} JSON response with AI-generated content or error
 *
 * @example
 * // Request body structure:
 * {
 *   "messages": [
 *     { "role": "user", "content": "Hello, how are you?" },
 *     { "role": "assistant", "content": "I'm doing well, thank you!" }
 *   ],
 *   "action": "chat",
 *   "data": {
 *     "screenshot": "data:image/png;base64,..."
 *   }
 * }
 *
 * @example
 * // Response structure:
 * {
 *   "id": "ai-1234567890",
 *   "role": "assistant",
 *   "content": "Generated response text..."
 * }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Received request body:", JSON.stringify(body, null, 2));

    const { messages, action, data } = body as AIRequest;

    // Format messages for the AI model
    const formatted: CoreMessage[] = messages.map((msg: any) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    console.log("Formatted messages:", JSON.stringify(formatted, null, 2));

    // If there's a screenshot, add it to the last user message for multimodal processing
    if (data?.screenshot) {
      console.log("Processing screenshot data...");
      const lastUserMessage = formatted[formatted.length - 1];
      if (lastUserMessage && lastUserMessage.role === "user") {
        const content: UserContent = [
          { type: "text", text: lastUserMessage.content as string },
          { type: "image", image: data.screenshot },
        ];
        lastUserMessage.content = content;
        console.log("Updated last user message with screenshot");
      }
    }

    // Generate text using the Gemini model with search grounding enabled
    console.log("Generating text with Gemini model...");
    const { text } = await generateText({
      model: google("gemini-2.5-flash-lite", {
        useSearchGrounding: true,
      }),
      messages: formatted,
    });

    console.log("Generated text:", text);

    return NextResponse.json({
      id: `ai-${Date.now()}`,
      role: "assistant",
      content: text,
    });
  } catch (error) {
    console.error("Detailed error in AI route:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      {
        error: `Failed to process AI request: ${error instanceof Error ? error.message : String(error)}`,
      },
      { status: 500 }
    );
  }
}
