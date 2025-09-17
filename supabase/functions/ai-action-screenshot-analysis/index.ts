import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withEntitlements } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";

const handleRequest = async (req: Request, profile: Record<string, any>) => {
  try {
    console.log(`[ai-action-screenshot-analysis] function invoked at: ${new Date().toISOString()}`);

    const { text_input, image_input } = await req.json();
    if (!text_input || !image_input) {
      return new Response(JSON.stringify({ error: "Prompt and screenshot are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const API_KEY = Deno.env.get("GOOGLE_GENERATIVE_AI_API_KEY");
    if (!API_KEY) {
      throw new Error("GOOGLE_GENERATIVE_AI_API_KEY is not set");
    }

    const contents = [
      {
        role: "user",
        parts: [
          { text: text_input },
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: image_input.split(",")[1], // Remove base64 prefix
            },
          },
        ],
      },
    ];
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
    const analysis = geminiResponse.candidates[0]?.content?.parts[0]?.text || "";

    // Action logging
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
        await supabaseClient.from("action_logs").insert({
          user_id: user.id,
          action: "ai_action:screenshot-analysis",
          metadata: { text_length: text_input.length },
        });
      }
    } catch (e) {
      console.error("An error occurred during action logging:", e);
    }

    return new Response(JSON.stringify({ analysis }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error(error.message);
    return new Response(JSON.stringify({ error: "Internal Server Error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
};

const screenshotAnalysisHandler = withEntitlements("allow_ai_action:screenshot-analysis", "daily_ai_action:screenshot-analysis_calls", handleRequest);

serve(screenshotAnalysisHandler);
