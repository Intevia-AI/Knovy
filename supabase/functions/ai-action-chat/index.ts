import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { PROMPTS, getLanguage } from "../_shared/prompts.ts";

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  try {
    console.log(`[ai-action-chat] function invoked at: ${new Date().toISOString()}`);

    const { text_input, existing_summary, recent_transcriptions, language } = await req.json();
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

    const lang = getLanguage(language);
    const prompt = PROMPTS.chat[lang].base({
      text_input,
      existing_summary,
      recent_transcriptions,
    });

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
    const response =
      geminiResponse.candidates[0]?.content?.parts[0]?.text ||
      "Sorry, I could not generate a response.";

    const usage = {
      input_tokens: geminiResponse.usageMetadata?.promptTokenCount || 0,
      output_tokens: geminiResponse.usageMetadata?.candidatesTokenCount || 0,
    };

    return new Response(JSON.stringify({ response, usage }), {
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
};

const chatHandler = withEntitlements(
  "allow_ai_action:chat",
  "daily_ai_action:chat_calls",
  handleRequest,
);

serve(chatHandler);
