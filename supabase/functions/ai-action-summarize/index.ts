import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";
import { PROMPTS, getLanguage } from "../_shared/prompts.ts";
import { getGeminiClient, GEMINI_MODELS } from "../_shared/gemini-client.ts";

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  const startTime = Date.now(); // Track execution time for analytics

  try {
    console.log(`[ai-action-summarize] function invoked at: ${new Date().toISOString()}`);

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

    const { text_input, existing_summary, language, session_id } = await req.json();
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
      model: GEMINI_MODELS.FLASH_LITE,
      temperature: 0.3,
      topK: 20,
      topP: 0.8,
      maxOutputTokens: 2048,
    });

    const { text: rawResponse, usage } = await geminiClient.generateText(prompt);

    // Parse JSON response
    let structuredSummary;
    try {
      // Clean the response: remove markdown code blocks if present
      const cleanedResponse = rawResponse.replace(/^```json\n?/gm, '').replace(/\n?```$/gm, '').trim();
      structuredSummary = JSON.parse(cleanedResponse);

      // Validate structure
      if (!structuredSummary.short_summary || !structuredSummary.long_summary || !structuredSummary.context) {
        throw new Error("Missing required fields in structured summary");
      }
    } catch (parseError) {
      console.error("[ai-action-summarize] Failed to parse JSON response:", parseError);
      console.error("[ai-action-summarize] Raw response:", rawResponse);

      // Fallback: return as plain text summary
      return new Response(
        JSON.stringify({
          summary: rawResponse || "",
          short_summary: rawResponse?.slice(0, 100) || "",
          long_summary: rawResponse || "",
          context: {
            participants: [],
            topics: [],
            keywords: [],
            time_context: null,
            scenario: null,
            key_points: []
          },
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
    }

    // Log feature usage to feature_usage table (analytics)
    const durationMs = Date.now() - startTime;
    try {
      // Estimate API cost (rough approximation: $0.075 per 1M input tokens, $0.30 per 1M output tokens for Flash)
      const inputCost = (usage.input_tokens / 1_000_000) * 0.075;
      const outputCost = (usage.output_tokens / 1_000_000) * 0.30;
      const apiCostUsd = inputCost + outputCost;

      const { error: logError } = await supabaseClient.from("feature_usage").insert({
        user_id: user.id,
        session_id: session_id || null,
        feature_name: "ai-summarize",
        feature_category: "ai-action",
        started_at: new Date(startTime).toISOString(),
        completed_at: new Date().toISOString(),
        duration_ms: durationMs,
        success: true,
        metadata: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
          input_length: text_input.length,
          has_existing_summary: !!existing_summary,
          language: lang,
          model: GEMINI_MODELS.FLASH_LITE,
        },
        api_cost_usd: apiCostUsd,
      });

      if (logError) {
        console.error("[ai-action-summarize] Failed to log feature usage:", logError);
        // Don't fail the request if logging fails
      }
    } catch (logException) {
      console.error("[ai-action-summarize] Exception while logging feature usage:", logException);
      // Don't fail the request if logging fails
    }

    return new Response(
      JSON.stringify({
        summary: structuredSummary.long_summary || "",  // Backward compatibility
        short_summary: structuredSummary.short_summary || "",
        long_summary: structuredSummary.long_summary || "",
        context: structuredSummary.context || {
          participants: [],
          topics: [],
          keywords: [],
          time_context: null,
          scenario: null,
          key_points: []
        },
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
          feature_name: "ai-summarize",
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
      console.error("[ai-action-summarize] Failed to log error:", logException);
    }

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
