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
        const { action_name, metadata } = payload;
        if (!action_name) {
          throw new Error("`action_name` is required for log_type 'action'");
        }
        const { error } = await supabaseClient.from("action_logs").insert({
          user_id: user.id,
          action: action_name,
          metadata: metadata || {},
        });
        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Action logged" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 201,
        });
      }

      case "duration": {
        const { session_id, duration_seconds } = payload;
        if (!session_id || duration_seconds === undefined) {
          throw new Error("`session_id` and `duration_seconds` are required for log_type 'duration'");
        }
        const { error } = await supabaseClient.from("transcription_ledger").upsert(
          {
            session_id, // The column with the UNIQUE constraint
            user_id: user.id,
            duration_seconds,
          },
          { onConflict: 'session_id' } // Specify the conflict target
        );

        if (error) throw error;
        return new Response(JSON.stringify({ success: true, message: "Duration upserted" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200, // 200 OK for upsert, 201 is for creation
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
