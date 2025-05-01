import { google } from "@ai-sdk/google";
import { generateText, CoreMessage, UserContent } from "ai";
import { NextResponse } from "next/server";

interface AIRequest {
  messages: any[];
  action?: string;
  data?: {
    text?: string;
    timestamp?: number;
    screenshot?: string;
  };
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("Received request body:", JSON.stringify(body, null, 2));
    
    const { messages, action, data } = body as AIRequest;

    // Format messages for the AI
    const formatted: CoreMessage[] = messages.map((msg: any) => ({
      role: msg.role as "user" | "assistant",
      content: msg.content,
    }));

    console.log("Formatted messages:", JSON.stringify(formatted, null, 2));

    // If there's a screenshot, add it to the last user message
    if (data?.screenshot) {
      console.log("Processing screenshot data...");
      const lastUserMessage = formatted[formatted.length - 1];
      if (lastUserMessage && lastUserMessage.role === "user") {
        const content: UserContent = [
          { type: "text", text: lastUserMessage.content as string },
          { type: "image", image: data.screenshot }
        ];
        lastUserMessage.content = content;
        console.log("Updated last user message with screenshot");
      }
    }

    // Generate text using the Gemini model with search grounding enabled
    console.log("Generating text with Gemini model...");
    const { text } = await generateText({
      model: google("gemini-2.0-flash-001", {
        useSearchGrounding: true,
      }),
      messages: formatted,
    });

    console.log("Generated text:", text);

    return NextResponse.json({ 
      id: `ai-${Date.now()}`,
      role: "assistant",
      content: text 
    });
  } catch (error) {
    console.error("Detailed error in AI route:", error);
    if (error instanceof Error) {
      console.error("Error stack:", error.stack);
    }
    return NextResponse.json(
      { error: `Failed to process AI request: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
} 