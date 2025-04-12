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
  micAudio?: MediaFile; // Renamed from audio
  systemAudio?: MediaFile; // Added
  video?: MediaFile;
  screenshots?: MediaFile[];
  query?: string; // Keep query if needed, or rely on message content
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

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    console.log("Raw request:", JSON.stringify(raw).substring(0, 200) + "...");
    const { data, messages } = extractRequestData(raw);

    // Create parts for the current user message content
    const parts: UserContent = [];

    // Add text prefix for clarity if both audio sources are present
    const addAudioPrefix = !!(data.micAudio && data.systemAudio);

    if (data.micAudio) {
      if (addAudioPrefix)
        parts.push({ type: "text", text: "Microphone Audio:" });
      parts.push({
        type: "file",
        data: data.micAudio.data,
        mimeType: data.micAudio.mimeType,
      });
    }
    if (data.systemAudio) {
      if (addAudioPrefix) parts.push({ type: "text", text: "System Audio:" });
      parts.push({
        type: "file",
        data: data.systemAudio.data,
        mimeType: data.systemAudio.mimeType,
      });
    }
    // if (data.video) { // Keep video handling as is
    //   parts.push({ type: "text", text: "Screen Recording:" }); // Optional prefix
    //   parts.push({
    //     type: "file",
    //     data: data.video.data,
    //     mimeType: data.video.mimeType,
    //   });
    // }
    if (data.screenshots && data.screenshots.length > 0) {
      parts.push({ type: "text", text: "Screenshots:" }); // Optional prefix
      data.screenshots.forEach((img) =>
        parts.push({ type: "image", image: img.data, mimeType: img.mimeType })
      );
    }
    // The main query/instruction should ideally be the text content of the last user message
    // if (data.query) parts.push({ type: "text", text: `Query: ${data.query}` });

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
      // For the last user message in history, combine its text with the media parts
      if (index === lastUserMessageIndex) {
        const contentParts: UserContent = [];
        // Add media parts first
        contentParts.push(...parts);
        // Add the text part of the user message
        if (messageText.trim()) {
          contentParts.push({ type: "text", text: messageText });
        }
        // Only add the message if it has content (either text or media)
        if (contentParts.length > 0) {
          formattedMessages.push({
            role: "user",
            content: contentParts,
          });
        }
      } else {
        // Regular text messages (assistant or previous user messages)
        if (messageText.trim()) {
          formattedMessages.push({
            role: msg.role as "user" | "assistant",
            content: messageText,
          });
        }
      }
    });

    // If no user message was found in history but we have media parts, create a new user message
    // This case might be less likely now that the frontend always sends a user message
    if (lastUserMessageIndex === -1 && parts.length > 0) {
      formattedMessages.push({
        role: "user",
        content: parts,
      });
    }

    // Check if we actually have messages to send
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
        "You are a helpful assistant. You can answer questions and provide information based on the input and context you receive. Be concise and clear. If nothing should be done, say 'Nothing to do'.",
      messages: formattedMessages,
    });

    console.log(
      "AI response:",
      text.substring(0, 100) + (text.length > 100 ? "..." : "")
    );

    // Return a proper JSON response with the content field
    return NextResponse.json(
      { content: text },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  } catch (e: any) {
    console.error("Error:", e);
    return NextResponse.json(
      { error: e.message || "Internal Server Error" },
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      }
    );
  }
}
