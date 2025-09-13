import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { withRBAC } from "../_shared/rbac.ts";
import { corsHeaders } from "../_shared/cors.ts";

const handleRequest = async (req: Request) => {
  try {
    console.log(`[ai-action-summarize] function invoked at: ${new Date().toISOString()}`);

    const { text_input, previous_summary } = await req.json();
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

    const prompt = previous_summary
      ? `You are given a previous summary and new conversation transcripts. Integrate the new transcripts into the summary, refining and extending it. The goal is to produce a single, coherent, updated summary. Format the output in Markdown without a "Summary" heading and use numbering for key takeaways.\n\nPrevious Summary:\n${previous_summary}\n\nNew Transcripts:\n${text_input}`
      : `Summarize the following text into a concise summary. Format the output in Markdown without a "Summary" heading and use numbering for key takeaways. The text to summarize is:\n\n${text_input}`;

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
    const summary = geminiResponse.candidates[0]?.content?.parts[0]?.text || "";

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
          action: "ai_action:summarize",
          metadata: { text_length: text_input.length },
        });
      }
    } catch (e) {
      console.error("An error occurred during action logging:", e);
    }

    return new Response(JSON.stringify({ summary }), {
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

const summarizeHandler = withRBAC("ai_action:summarize", handleRequest);

serve(summarizeHandler);
