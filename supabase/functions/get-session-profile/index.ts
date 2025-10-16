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
        // Extract feature name from metric (e.g., "daily_ai_action:summarize_calls" -> "ai-summarize")
        const actionName = quota.metric
          .replace("daily_ai_action:", "")
          .replace("_calls", "")
          .replace(/_/g, "-");
        const featureName = `ai-${actionName}`;

        const { count, error } = await supabaseClient
          .from("feature_usage")
          .select("*", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("feature_name", featureName)
          .gte("created_at", today.toISOString())
          .lt("created_at", tomorrow.toISOString());
        if (error) console.error(`Error counting feature usage for ${featureName}:`, error);
        currentUsage = count ?? 0;
      } else if (quota.metric === "daily_transcription_minutes") {
        // Sum transcription_minutes from all sessions today
        const { data: sessions, error } = await supabaseClient
          .from("user_sessions")
          .select("transcription_minutes")
          .eq("user_id", user.id)
          .gte("started_at", today.toISOString())
          .lt("started_at", tomorrow.toISOString());
        if (error) console.error("Error fetching user sessions:", error);
        currentUsage = (sessions ?? []).reduce((acc, session) => acc + (parseFloat(session.transcription_minutes) || 0), 0);
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
