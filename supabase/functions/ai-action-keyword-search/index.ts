import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { authenticateUser } from "../_shared/auth.ts";

// Set CORS headers based on environment
const allowedOrigin = Deno.env.get("ENVIRONMENT") === "dev"
  ? "http://localhost:5173"
  : "https://intevia.app";

const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

export async function handler(req: Request): Promise<Response> {
  // Handle preflight OPTIONS request
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log(`[ai-action-keyword-search] function invoked at: ${new Date().toISOString()}`);
    const userOrResponse = await authenticateUser(req);
    if (userOrResponse instanceof Response) {
      return userOrResponse;
    }

    const { text } = await req.json();
    if (!text) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!API_KEY) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const prompt = `Extract the key terms from the following text. Return the answer as a JSON array of strings. For example: ["keyword1", "keyword2"].\n\nText: "${text}"`;
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
    const keywordsText = geminiResponse.candidates[0]?.content?.parts[0]?.text || "[]";

    const cleanedText = keywordsText.replace(/```json|```/g, "").trim();
    const keywords = JSON.parse(cleanedText);

    return new Response(JSON.stringify({ keywords }), {
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
