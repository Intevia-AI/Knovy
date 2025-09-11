import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateUser } from "../_shared/auth.ts";
import { corsHeaders } from "../_shared/cors.ts";

export async function handler(req: Request): Promise<Response> {
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[ai-action-recommend-response] function invoked at: ${new Date().toISOString()}`);
    const userOrResponse = await authenticateUser(req);
    if (userOrResponse instanceof Response) {
      return userOrResponse;
    }

    const { text_input } = await req.json();
    if (!text_input) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!API_KEY) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const prompt = `Recommend a response to the following text:\n\n${text_input}. \n\nPlease return a short response, no more than 50 words.`;
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
    const recommendation = geminiResponse.candidates[0]?.content?.parts[0]?.text || "";

    return new Response(JSON.stringify({ recommendation }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error(error.message);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

if (import.meta.main) {
  serve(handler);
}
