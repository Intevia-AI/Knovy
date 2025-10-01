import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { PROMPTS, getLanguage } from "../_shared/prompts.ts";
import { getGeminiClient } from "../_shared/gemini-client.ts";

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  try {
    console.log(`[ai-action-recommend-response] function invoked at: ${new Date().toISOString()}`);

    const { text_input, language } = await req.json();
    if (!text_input) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = getLanguage(language);
    const prompt = PROMPTS.recommendResponse[lang].base(text_input);

    // Use shared Gemini client with retry logic
    const geminiClient = getGeminiClient({
      temperature: 0.5,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 1024,
    });

    const { text: recommendation, usage } = await geminiClient.generateText(prompt);

    return new Response(JSON.stringify({
      recommendation: recommendation || "",
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

const recommendResponseHandler = withEntitlements(
  "allow_ai_action:recommend-response",
  "daily_ai_action:recommend-response_calls",
  handleRequest,
);

if (import.meta.main) {
  serve(recommendResponseHandler);
}
