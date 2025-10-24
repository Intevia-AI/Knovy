import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { PROMPTS, getLanguage } from "../_shared/prompts.ts";
import { getGeminiClient, GEMINI_MODELS } from "../_shared/gemini-client.ts";

// The main logic of the Edge Function, now wrapped with RBAC
const handleRequest = async (req: Request, profile: Record<string, any>) => {
  const startTime = Date.now(); // Track execution time for analytics

  try {
    console.log(`[ai-action-keyword-search] function invoked at: ${new Date().toISOString()}`);

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

    const { text_input, existing_summary, recent_transcriptions, language, session_id } = await req.json();
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
      model: GEMINI_MODELS.FLASH_LITE,
      temperature: 0.3,
      topK: 20,
      topP: 0.8,
      maxOutputTokens: 2048,
    });

    const { text: summary, usage } = await geminiClient.generateText(prompt);

    // Log feature usage to feature_usage table (analytics)
    const durationMs = Date.now() - startTime;
    try {
      const { error: logError } = await supabaseClient.from("feature_usage").insert({
        user_id: user.id,
        session_id: session_id || null,
        feature_name: "ai-keyword-search",
        feature_category: "ai-action",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        success: true,
        metadata: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          input_length: text_input.length,
          response_length: summary?.length || 0,
          has_existing_summary: !!existing_summary,
          has_recent_transcriptions: !!recent_transcriptions,
          language: lang,
          model: GEMINI_MODELS.FLASH_LITE,
        },
      });

      if (logError) {
        console.error("[ai-action-keyword-search] Failed to log feature usage:", logError);
        // Don't fail the request if logging fails
      }
    } catch (logException) {
      console.error("[ai-action-keyword-search] Exception while logging feature usage:", logException);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        response: summary || "Sorry, I could not find information on that topic.",
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
    console.error(`[ai-action-keyword-search] Error: ${error.message}`);

    // Log error to feature_usage table
    const durationMs = Date.now() - startTime;
    try {
      const supabaseClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_ANON_KEY") ?? "",
        { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
      );

      const {
        data: { user },
      } = await supabaseClient.auth.getUser();

      if (user) {
        const { text_input, session_id } = await req.json().catch(() => ({ text_input: "", session_id: null }));

        await supabaseClient.from("feature_usage").insert({
          user_id: user.id,
          session_id: session_id || null,
          feature_name: "ai-keyword-search",
          feature_category: "ai-action",
          started_at: new Date(startTime).toISOString(),
          completed_at: new Date().toISOString(),
          duration_ms: durationMs,
          success: false,
          error_type: error.name || "UnknownError",
          error_message: error.message || "Internal Server Error",
          metadata: {
            input_length: text_input?.length || 0,
          },
        });
      }
    } catch (logException) {
      console.error("[ai-action-keyword-search] Failed to log error:", logException);
    }

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
