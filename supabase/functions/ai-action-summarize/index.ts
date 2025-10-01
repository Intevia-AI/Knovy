import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { PROMPTS, getLanguage } from "../_shared/prompts.ts";
import { getGeminiClient } from "../_shared/gemini-client.ts";

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  try {
    console.log(`[ai-action-summarize] function invoked at: ${new Date().toISOString()}`);

    const { text_input, existing_summary, language } = await req.json();
    if (!text_input) {
      return new Response(JSON.stringify({ error: "Text is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const lang = getLanguage(language);
    const prompt = existing_summary
      ? PROMPTS.summarize[lang].with_previous(text_input, existing_summary)
      : PROMPTS.summarize[lang].without_previous(text_input);

    // Use shared Gemini client with retry logic
    const geminiClient = getGeminiClient({
      temperature: 0.3,
      topK: 20,
      topP: 0.8,
      maxOutputTokens: 2048,
    });

    const { text: summary, usage } = await geminiClient.generateText(prompt);

    return new Response(JSON.stringify({
      summary: summary || "",
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

const summarizeHandler = withEntitlements(
  "allow_ai_action:summarize",
  "daily_ai_action:summarize_calls",
  handleRequest,
);

serve(summarizeHandler);
