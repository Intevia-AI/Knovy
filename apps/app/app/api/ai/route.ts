import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

// Initialize the Gemini API client
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || "");

export async function POST(request: Request) {
  try {
    const { messages, mode } = await request.json();

    // Get the Gemini model - using the correct model name
    const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash-001" });

    // Start a chat
    const chat = model.startChat({
      history: messages.slice(0, -1).map((msg: any) => ({
        role: msg.role,
        parts: msg.content,
      })),
    });

    // Get the last message
    const lastMessage = messages[messages.length - 1];
    
    // Send the message and get the response
    const result = await chat.sendMessage(lastMessage.content);
    const response = await result.response;
    const text = response.text();

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