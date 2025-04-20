import { google } from "@ai-sdk/google";
import { generateText, UserContent, Message, CoreMessage } from "ai";
import { NextResponse } from "next/server";

// Updated: Expect label in MediaFile
interface MediaFile { data: string; mimeType: string; label: string; }
interface AIRequestBody { audioInputs?: MediaFile[]; }
interface CompleteRequest { messages: Message[]; data?: AIRequestBody; }

export async function POST(req: Request) {
  try {
    const raw: CompleteRequest = await req.json();
    const { messages = [], data = {} } = raw;

    // Build user content parts with labels
    const parts: UserContent = [];
    if (data.audioInputs && data.audioInputs.length > 0) {
      // Group by label for clarity in the prompt
      const groupedAudio = data.audioInputs.reduce((acc, audio) => {
        acc[audio.label] = acc[audio.label] || [];
        acc[audio.label].push(audio);
        return acc;
      }, {} as Record<string, MediaFile[]>);

      // Add labeled audio parts
      for (const label in groupedAudio) {
        parts.push({ type: "text", text: `\n--- ${label.charAt(0).toUpperCase() + label.slice(1)} Audio ---` }); // e.g., --- Microphone Audio ---
        groupedAudio[label].forEach(audioInput => {
          parts.push({ type: "file", data: audioInput.data, mimeType: audioInput.mimeType });
        });
      }
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
          : typeof last.content === 'string' && last.content.trim() !== '' // Handle empty string case
            ? [{ type: "text", text: last.content }]
            : []; // If content is null/undefined/empty, start fresh
        // Prepend audio parts to existing text content
        last.content = [...parts, ...existingContent];
      } else {
        // If no user message exists, create one with the audio
        formatted.push({ role: "user", content: parts });
      }
    }

    // Ensure there's some content to send
    if (!formatted.some(m => m.content && (Array.isArray(m.content) ? m.content.length > 0 : String(m.content).trim() !== ''))) {
        console.warn("AI API: No input content after formatting.");
        return NextResponse.json({ error: "No input content" }, { status: 400 });
    }

    // console.log("Formatted messages sent to AI:", JSON.stringify(formatted, null, 2)); // DEBUG: Log formatted messages

    const { text } = await generateText({
      model: google("gemini-1.5-flash-latest"), // Using 1.5 Flash as it's good with multimodal
      // Removed grounding as it might interfere with direct audio analysis
      // model: google("gemini-2.0-flash", {
      //   useSearchGrounding: true,
      // }),
      messages: formatted,
    });

    return NextResponse.json({ content: text });
  } catch (e: unknown) {
    console.error("AI API Error:", e); // Log the full error server-side
    const errorMessage = e instanceof Error ? e.message : "Internal Server Error";
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
