import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

serve(async (req: Request) => {
  // This is needed if you're planning to invoke your function from a browser.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Authenticated user not found" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { log_type, ...payload } = await req.json();

    switch (log_type) {
      case "action": {
        // DEPRECATED: action_logs table no longer exists
        // This is kept for backward compatibility but does nothing
        console.warn("session-manager: 'action' log_type is deprecated. Use feature_usage table instead.");
        return new Response(JSON.stringify({ success: true, message: "Action logging deprecated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      case "duration": {
        // DEPRECATED: transcription_ledger table no longer exists
        // This is kept for backward compatibility but does nothing
        // Duration tracking is now handled by analytics service via user_sessions table
        console.warn("session-manager: 'duration' log_type is deprecated. Use analytics service instead.");
        return new Response(JSON.stringify({ success: true, message: "Duration logging deprecated" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        });
      }

      default:
        throw new Error(`Unsupported log_type: ${log_type}`);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
