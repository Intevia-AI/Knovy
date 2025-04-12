// =============================================================
//  File: app/api/ai/route.ts (Edge runtime – POST)
//  Changes: none of the logic changes, but the payload may now be
//           much smaller (only latest chunks). Kept for completeness.
// =============================================================

import { google } from "@ai-sdk/google";
import { generateText, UserContent } from "ai";
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

function extractRequestData(body: any): AIRequestBody {
  if (Array.isArray(body.messages) && body.data) {
    return body.data;
  }
  return body;
}

export async function POST(req: Request) {
  try {
    const raw = await req.json();
    const body = extractRequestData(raw) as AIRequestBody;

    const parts: UserContent = [];

    if (body.audio) {
      parts.push({
        type: "file",
        data: body.audio.data,
        mimeType: body.audio.mimeType,
      });
    }
    // if (body.video) {
    //   parts.push({
    //     type: "file",
    //     data: body.video.data,
    //     mimeType: body.video.mimeType,
    //   });
    // }
    body.screenshots?.forEach((img) =>
      parts.push({ type: "image", image: img.data, mimeType: img.mimeType })
    );
    if (body.query) parts.push({ type: "text", text: `Query: ${body.query}` });

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

    console.log("AI request:", parts);

    const { text } = await generateText({
      model: google("gemini-2.0-flash-001", {
        useSearchGrounding: true,
      }),
      messages: [{ role: "user", content: parts }],
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
