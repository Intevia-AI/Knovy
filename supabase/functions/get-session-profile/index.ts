import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "../_shared/cors.ts";

async function getSessionProfile(req: Request) {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: req.headers.get("Authorization")! } } },
    );

    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser();

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Authentication failed" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Get user role
    const { data: profile, error: profileError } = await supabaseClient
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    let userRole;
    // Handle potential race condition where profile is not created yet for a new user
    if (profileError && profileError.code === "PGRST116") {
      console.warn(
        `Profile not found for user ${user.id}, likely a new user. Defaulting to 'free' role.`,
      );
      userRole = "free";
    } else if (profileError || !profile) {
      throw new Error(`Failed to retrieve user profile: ${profileError?.message}`);
    } else {
      userRole = profile.role;
    }

    // 2. Fetch all settings, entitlements, and quotas in parallel
    const [appSettingsRes, entitlementsRes, quotasRes] = await Promise.all([
      supabaseClient.from("app_settings").select("key, value"),
      supabaseClient.from("entitlements").select("config").eq("role", userRole).single(),
      supabaseClient.from("quotas").select("*").eq("role", userRole),
    ]);

    if (appSettingsRes.error || entitlementsRes.error || quotasRes.error) {
      console.error("Error fetching entitlements configuration:", {
        appSettingsError: appSettingsRes.error,
        entitlementsError: entitlementsRes.error,
        quotasError: quotasRes.error,
      });
      throw new Error("Failed to fetch entitlements configuration.");
    }

    // 3. Calculate current usage for each quota
    const usage = {};
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    for (const quota of quotasRes.data || []) {
      let currentUsage = 0;
      if (quota.metric.startsWith("daily_ai_action:")) {
        const actionName = quota.metric.replace("_calls", "").replace("daily_", "");
        const { count, error } = await supabaseClient
          .from("action_logs")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("action", actionName)
          .gte("timestamp", today.toISOString())
          .lt("timestamp", tomorrow.toISOString());
        if (error) console.error(`Error counting action logs for ${actionName}:`, error);
        currentUsage = count ?? 0;
      } else if (quota.metric === "daily_transcription_minutes") {
        const { data: ledger, error } = await supabaseClient
          .from("transcription_ledger")
          .select("duration_seconds")
          .eq("user_id", user.id)
          .gte("created_at", today.toISOString())
          .lt("created_at", tomorrow.toISOString());
        if (error) console.error("Error fetching transcription ledger:", error);
        currentUsage = (ledger ?? []).reduce((acc, item) => acc + item.duration_seconds, 0) / 60;
      }

      usage[quota.metric] = {
        limit: quota.limit,
        used: currentUsage,
      };
    }

    // 4. Construct the final session profile
    const sessionProfile = {
      user_id: user.id,
      role: userRole,
      user_metadata: user.user_metadata || {},
      app_settings: (appSettingsRes.data || []).reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {}),
      entitlements: entitlementsRes.data?.config ?? {},
      quotas: usage,
    };

    return new Response(JSON.stringify(sessionProfile), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    console.error("Error in get-session-profile:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}

serve(getSessionProfile);
