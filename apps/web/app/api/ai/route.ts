// =============================================================
//  File: app/api/ai/route.ts (Edge runtime – POST)
//  Changes: none of the logic changes, but the payload may now be
//           much smaller (only latest chunks). Kept for completeness.
// =============================================================

import { google } from "@ai-sdk/google";
import { generateText, UserContent, Message, CoreMessage } from "ai";
import { NextResponse } from "next/server";

interface MediaFile {
  data: string;
  mimeType: string;
}

interface AIRequestBody {
  micAudio?: MediaFile; // Represents the single audio source (could be mic or system)
  video?: MediaFile;
  screenshots?: MediaFile[];
  query?: string;
}

interface CompleteRequest {
  messages: Message[];
  data?: AIRequestBody;
}

function extractRequestData(body: any): {
  data: AIRequestBody;
  messages: Message[];
} {
  // Always ensure we have a messages array (default to empty if not present)
  const messages = Array.isArray(body.messages) ? body.messages : [];

  // Extract data object
  const data = body.data || body;

  return { data, messages };
}

// Helper function to select and validate the single audio file
function pickSingleAudio(data: AIRequestBody): MediaFile | undefined {
  // The frontend now sends the single audio source in the micAudio field
  const file = data.micAudio;
  if (!file) return undefined; // No audio provided

  // Validate MIME type against Gemini's allow-list
  if (!/^audio\/(ogg|wav|mp3|aac|flac|aiff)/.test(file.mimeType)) {
    console.error(`Unsupported audio mimeType received: ${file.mimeType}`);
    throw new Error(
      `Unsupported audio mimeType ${file.mimeType}. Record with OGG or WAV.`
    );
  }

  // Estimate byte size from base64 and check against limit (e.g., 19MB)
  const bytes = (file.data.length * 3) / 4;
  const MAX_AUDIO_BYTES = 19 * 1024 * 1024; // ~19 MB limit for inline data

  if (bytes > MAX_AUDIO_BYTES) {
    console.error(
      `Audio data size (${(bytes / (1024 * 1024)).toFixed(1)} MB) exceeds limit of ${
        MAX_AUDIO_BYTES / (1024 * 1024)
      } MB.`
    );
    throw new Error(
      `Inline audio size exceeds ${
        MAX_AUDIO_BYTES / (1024 * 1024)
      } MB limit. Consider using the Files API for larger files.`
    );
  }

  console.log(
    `Validated audio: ${file.mimeType}, size: ${(bytes / 1024).toFixed(1)} KB`
  );
  return file; // Return the validated audio file
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    console.log("Raw request:", JSON.stringify(raw).substring(0, 200) + "...");
    const { data, messages } = extractRequestData(raw);

    // Create parts for the current user message content
    const parts: UserContent = [];

    // --- Process Single Audio File ---
    const audio = pickSingleAudio(data); // Use the helper function
    if (audio) {
      parts.push({ type: "text", text: "Audio Input:" }); // Generic prefix
      parts.push({
        type: "file",
        data: audio.data,
        mimeType: audio.mimeType,
      });
    }

    // --- Process Video (Screen Recording) ---
    if (data.video) {
      parts.push({ type: "text", text: "Screen Recording:" });
      parts.push({
        type: "file",
        data: data.video.data,
        mimeType: data.video.mimeType,
      });
    }

    // --- Process Screenshots ---
    if (data.screenshots && data.screenshots.length > 0) {
      parts.push({ type: "text", text: "Screenshots:" });
      data.screenshots.forEach((img) =>
        parts.push({ type: "image", image: img.data, mimeType: img.mimeType })
      );
    }

    // Check if there's any content to process (either media parts or message text)
    const lastUserMessageContent = messages[messages.length - 1]?.content;
    const hasTextMessage =
      typeof lastUserMessageContent === "string" &&
      lastUserMessageContent.trim() !== "";

    if (!parts.length && !hasTextMessage) {
      return NextResponse.json(
        { error: "No valid input provided (no media or text message)" },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(
      "Processing AI request with message history of",
      messages.length,
      "messages"
    );

    // Format message history for the AI model
    const formattedMessages: CoreMessage[] = [];

    // Find the last user message in the history
    const lastUserMessageIndex =
      messages.length > 0
        ? messages.map((m) => m.role === "user").lastIndexOf(true)
        : -1;

    // Process the message history
    messages.forEach((msg, index) => {
      const messageText = typeof msg.content === "string" ? msg.content : "";
      if (index === lastUserMessageIndex) {
        const contentParts: UserContent = [];
        contentParts.push(...parts); // Add validated media parts
        if (messageText.trim()) {
          contentParts.push({ type: "text", text: messageText });
        }
        if (contentParts.length > 0) {
          formattedMessages.push({
            role: "user",
            content: contentParts,
          });
        }
      } else {
        if (messageText.trim()) {
          formattedMessages.push({
            role: msg.role as "user" | "assistant",
            content: messageText,
          });
        }
      }
    });

    if (lastUserMessageIndex === -1 && parts.length > 0) {
      formattedMessages.push({
        role: "user",
        content: parts,
      });
    }

    if (formattedMessages.length === 0) {
      console.warn("No formatted messages to send to AI.");
      return NextResponse.json(
        { error: "No content to process after formatting." },
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        }
      );
    }

    console.log(
      "Sending messages to AI:",
      formattedMessages.map((m) => ({
        role: m.role,
        contentLength:
          typeof m.content === "string" ? m.content.length : "multipart",
      }))
    );

    const { text } = await generateText({
      model: google("gemini-2.0-flash-001", {
        useSearchGrounding: true,
      }),
      system:
        "You are a helpful assistant. You can answer questions and provide information based on the input and context you receive (audio, screen recording, screenshots). Be concise and clear. If nothing should be done, say 'Nothing to do'.",
      messages: formattedMessages,
    });

    console.log(
      "AI response:",
      text.substring(0, 100) + (text.length > 100 ? "..." : "")
    );

    return NextResponse.json(
      { content: text },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e: any) {
    console.error("Error in AI API route:", e);
    const errorMessage = e instanceof Error ? e.message : "Internal Server Error";
    const statusCode =
      errorMessage.includes("Unsupported audio mimeType") ||
      errorMessage.includes("exceeds limit")
        ? 400
        : 500;
    return NextResponse.json(
      { error: errorMessage },
      {
        status: statusCode,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
