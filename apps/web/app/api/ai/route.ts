// =============================================================
//  File: app/api/ai/route.ts (Edge runtime – POST)
//  Changes: none of the logic changes, but the payload may now be
//           much smaller (only latest chunks). Kept for completeness.
// =============================================================

import { google } from "@ai-sdk/google";
import { generateText, UserContent, Message } from "ai";
import { NextResponse } from "next/server";

interface MediaFile {
  data: string;
  mimeType: string;
}

interface Memory {
  content: string;
  timestamp?: string;
  source?: string;
}

interface AIRequestBody {
  audio?: MediaFile;
  video?: MediaFile;
  screenshots?: MediaFile[];
  memories?: Memory[];
  query?: string;
}

interface CompleteRequest {
  messages?: Message[];
  data?: AIRequestBody;
}

function extractRequestData(body: any): {
  data: AIRequestBody;
  messages?: Message[];
} {
  if (Array.isArray(body.messages) && body.data) {
    // Return both messages and data when they're present
    return {
      messages: body.messages,
      data: body.data,
    };
  }
  // For backward compatibility with older requests
  return { data: body };
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    console.log(raw);
    const { data, messages } = extractRequestData(raw);

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

    if (!parts.length) {
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

    // console.log("AI request:", parts);

    // Use messages from the request if available
    const userMessage =
      messages && messages.length > 0
        ? {
            role: "user",
            content: [...parts, { type: "text", text: messages[0]?.content }],
          }
        : { role: "user", content: parts };

    console.log("User message:", userMessage);

    const { text } = await generateText({
      model: google("gemini-2.0-flash-001", {
        useSearchGrounding: true,
      }),
      system:
        "You are a helpful assistant. You can answer questions and provide information based on the input and context you receive. Be concise and clear. If nothing should be done, say 'Nothing to do'.",
      messages: [userMessage],
    });

    console.log("AI response:", text);

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
