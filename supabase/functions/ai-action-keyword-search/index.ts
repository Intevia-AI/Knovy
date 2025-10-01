import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { PROMPTS, getLanguage } from "../_shared/prompts.ts";
import { getGeminiClient } from "../_shared/gemini-client.ts";

// The main logic of the Edge Function, now wrapped with RBAC
const handleRequest = async (req: Request, profile: Record<string, any>) => {
  try {
    console.log(`[ai-action-keyword-search] function invoked at: ${new Date().toISOString()}`);

    const { text_input, existing_summary, recent_transcriptions, language } = await req.json();
    if (!text_input) {
      return new Response(JSON.stringify({ error: "Text input is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = getLanguage(language);
    const prompt = PROMPTS.keywordSearch[lang].base({
      text_input,
      existing_summary,
      recent_transcriptions,
    });

    // Use shared Gemini client with retry logic
    const geminiClient = getGeminiClient({
      temperature: 0.3,
      topK: 20,
      topP: 0.8,
      maxOutputTokens: 2048,
    });

    const { text: summary, usage } = await geminiClient.generateText(prompt);

    return new Response(JSON.stringify({
      response: summary || "Sorry, I could not find information on that topic.",
      usage: {
        input_tokens: usage.input_tokens,
        output_tokens: usage.output_tokens,
      },
    }), {
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
};

// Wrap the handler with the RBAC middleware, requiring the specific permission
const keywordSearchHandler = withEntitlements(
  "allow_ai_action:keyword-search",
  "daily_ai_action:keyword-search_calls",
  handleRequest,
);

if (import.meta.main) {
  serve(keywordSearchHandler);
}
