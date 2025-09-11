import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateUser } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

async function handler(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[ai-action-chat] function invoked at: ${new Date().toISOString()}`);
    const userOrResponse = await authenticateUser(req);
    if (userOrResponse instanceof Response) {
      return userOrResponse;
    }

    const { text_input, previous_summary, recent_transcriptions, language } = await req.json();
    if (!text_input) {
      return new Response(JSON.stringify({ error: "Text input is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!API_KEY) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    // Build the prompt
    let prompt = `You are a helpful AI assistant. Your goal is to answer the user's question based on the context provided. The context includes a summary of the entire conversation and the most recent transcriptions.

Please provide a concise and helpful response in ${language === 'zh-TW' ? 'Traditional Chinese' : language === 'ja-JP' ? 'Japanese' : 'English'}.

`;

    if (previous_summary) {
      prompt += `Here is the summary of the conversation so far:
---
${previous_summary}
---
`;
    }

    if (recent_transcriptions) {
      prompt += `Here are the most recent transcriptions from the conversation:
---
${recent_transcriptions}
---
`;
    }

    prompt += `Based on the available context, please answer the following user question:
User Question: "${text_input}"`;


    const contents = [{ role: "user", parts: [{ text: prompt }] }];
    const postData = JSON.stringify({ contents });

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-lite:generateContent?key=${API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: postData,
      },
    );

    if (!res.ok) {
      const errorBody = await res.text();
      console.error("Gemini API Error:", errorBody);
      throw new Error(`Gemini API request failed with status ${res.status}`);
    }

    const geminiResponse = await res.json();
    const response = geminiResponse.candidates[0]?.content?.parts[0]?.text || "Sorry, I could not generate a response.";

    return new Response(JSON.stringify({ response }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(`[ai-action-chat] Error: ${error.message}`);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(handler);
