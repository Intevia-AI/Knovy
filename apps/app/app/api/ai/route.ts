import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { messages } = await request.json();

    // Format messages for the AI
    const formatted = messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Generate text using the Gemini model with search grounding enabled
    const { text } = await generateText({
      model: google("gemini-2.0-flash-001", {
        useSearchGrounding: true,
      }),
      messages: formatted,
    });

    return NextResponse.json({ 
      id: `ai-${Date.now()}`,
      role: "assistant",
      content: text 
    });
  } catch (error) {
    console.error("Error in AI route:", error);
    return NextResponse.json(
      { error: "Failed to process AI request" },
      { status: 500 }
    );
  }
} 