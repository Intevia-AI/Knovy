import { google } from "@ai-sdk/google";
import { generateText, UserContent, Message, CoreMessage } from "ai";
import { NextResponse } from "next/server";

interface MediaFile { data: string; mimeType: string; }
// Updated: Expect a single audio input
interface AIRequestBody { audioInput?: MediaFile; }
interface CompleteRequest { messages: Message[]; data?: AIRequestBody; }

export async function POST(req: Request) {
  try {
    const raw: CompleteRequest = await req.json();
    const { messages = [], data = {} } = raw;

    // Build user content parts
    const parts: UserContent = [];
    // Updated: Check for single audioInput
    if (data.audioInput) {
      parts.push({ type: "text", text: "Audio Input:" }); // Add context label
      parts.push({ type: "file", data: data.audioInput.data, mimeType: data.audioInput.mimeType });
    }

    // If no media, just forward text messages
    const formatted: CoreMessage[] = messages.map(m => ({ role: m.role as "user"|"assistant", content: m.content }));

    // Merge media into the last user message or create new
    const lastIdx = formatted.map((m,i)=> (m.role==="user"?i:-1)).filter(i=>i!==-1).pop();
    if (parts.length) {
      if (lastIdx !== undefined) {
        const last = formatted[lastIdx] as CoreMessage & { content: any };
        // Ensure existing content is treated as text if it's not already an array
        const existingContent = Array.isArray(last.content)
          ? last.content
          : [{ type: "text", text: String(last.content) }];
        last.content = [...parts, ...existingContent]; // Prepend audio parts
      } else {
        // If no user message exists, create one with the audio
        formatted.push({ role: "user", content: parts });
      }
    }

    // Ensure there's some content to send
    if (!formatted.some(m => m.content && (Array.isArray(m.content) ? m.content.length > 0 : String(m.content).trim() !== ''))) {
        return NextResponse.json({ error: "No input content" }, { status: 400 });
    }


    const { text } = await generateText({
      // Updated model potentially supporting grounding, ensure it's appropriate
      model: google("gemini-2.0-flash-lite"), // Using 2.0 Flash as it's generally good with multimodal
      system: "You are a concise, helpful assistant analyzing meeting audio.", // Slightly more specific system prompt
      messages: formatted,
    });

    return NextResponse.json({ content: text });
  } catch (e: unknown) {
    console.error("AI API Error:", e); // Log the full error server-side
    const errorMessage = e instanceof Error ? e.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
