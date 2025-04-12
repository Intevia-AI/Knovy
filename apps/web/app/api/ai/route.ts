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
  audio?: MediaFile;
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

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    console.log("Raw request:", JSON.stringify(raw).substring(0, 200) + "...");
    const { data, messages } = extractRequestData(raw);

    // Create parts for the current user message content
    const parts: UserContent = [];

    if (data.audio) {
      parts.push({
        type: "file",
        data: data.audio.data,
        mimeType: data.audio.mimeType,
      });
    }
    // if (data.video) {
    //   parts.push({
    //     type: "file",
    //     data: data.video.data,
    //     mimeType: data.video.mimeType,
    //   });
    // }
    data.screenshots?.forEach((img) =>
      parts.push({ type: "image", image: img.data, mimeType: img.mimeType })
    );
    if (data.query) parts.push({ type: "text", text: `Query: ${data.query}` });

    if (!parts.length && (!messages || messages.length === 0)) {
      return NextResponse.json(
        { error: "No valid input provided" },
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
      // For the last user message in history, append the media parts
      if (index === lastUserMessageIndex && parts.length > 0) {
        formattedMessages.push({
          role: "user",
          content: [...parts, { type: "text", text: msg.content || "" }],
        });
      } else {
        // Regular text messages (assistant or other user messages)
        formattedMessages.push({
          role: msg.role as "user" | "assistant",
          content: typeof msg.content === "string" ? msg.content : "",
        });
      }
    });

    // If no user message was found in history but we have parts, create a new user message
    if (lastUserMessageIndex === -1 && parts.length > 0) {
      formattedMessages.push({
        role: "user",
        content: parts,
      });
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
