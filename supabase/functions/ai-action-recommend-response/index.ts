import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { PROMPTS, getLanguage } from "../_shared/prompts.ts";
import { getGeminiClient, GEMINI_MODELS } from "../_shared/gemini-client.ts";

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  try {
    console.log(`[ai-action-recommend-response] function invoked at: ${new Date().toISOString()}`);

    // Create Supabase client for logging
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "User not authenticated" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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
      model: GEMINI_MODELS.FLASH_LITE,
      temperature: 0.5,
      topK: 40,
      topP: 0.9,
      maxOutputTokens: 1024,
    });

    const { text: recommendation, usage } = await geminiClient.generateText(prompt);

    // Log the action with token usage to action_logs table
    try {
      const { error: logError } = await supabaseClient.from("action_logs").insert({
        user_id: user.id,
        action: "ai_action:recommend-response",
        metadata: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        },
      });

      if (logError) {
        console.error("[ai-action-recommend-response] Failed to log action:", logError);
        // Don't fail the request if logging fails
      }
    } catch (logException) {
      console.error("[ai-action-recommend-response] Exception while logging action:", logException);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        recommendation: recommendation || "",
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
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
