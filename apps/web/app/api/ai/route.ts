import { google } from "@ai-sdk/google";
import { generateText, UserContent, Message, CoreMessage } from "ai";
import { NextResponse } from "next/server";

interface MediaFile { data: string; mimeType: string; }
interface AIRequestBody { micAudio?: MediaFile; systemAudio?: MediaFile; }
interface CompleteRequest { messages: Message[]; data?: AIRequestBody; }

export async function POST(req: Request) {
  try {
    const raw: CompleteRequest = await req.json();
    const { messages = [], data = {} } = raw;

    // Build user content parts
    const parts: UserContent = [];
    if (data.micAudio) parts.push({ type: "file", data: data.micAudio.data, mimeType: data.micAudio.mimeType });
    if (data.systemAudio) parts.push({ type: "text", text: "System Audio:" }, { type: "file", data: data.systemAudio.data, mimeType: data.systemAudio.mimeType });

    // If no media, just forward text messages
    const formatted: CoreMessage[] = messages.map(m => ({ role: m.role as "user"|"assistant", content: m.content }));

    // Merge media into the last user message or create new
    const lastIdx = formatted.map((m,i)=> (m.role==="user"?i:-1)).filter(i=>i!==-1).pop();
    if (parts.length) {
      if (lastIdx !== undefined) {
        const last = formatted[lastIdx] as CoreMessage & { content: any };
        last.content = Array.isArray(last.content) ? [...parts, ...last.content] : [...parts, { type:"text", text: String(last.content) }];
      } else {
        formatted.push({ role: "user", content: parts });
      }
    }

    if (!formatted.length) return NextResponse.json({ error: "No input" }, { status: 400 });

    const { text } = await generateText({
      model: google("gemini-2.0-flash-001", { useSearchGrounding: true }),
      system: "You are a concise, helpful assistant.",
      messages: formatted,
    });

    return NextResponse.json({ content: text });
  } catch (e: any) {
    return NextResponse.json({ error: e.message || "Internal" }, { status: 500 });
  }
}
