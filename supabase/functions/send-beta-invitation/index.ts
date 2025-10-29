import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend";
import { renderToString } from "https://esm.sh/react-dom/server";
import { withRBAC } from "../_shared/rbac.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import BetaInvitationEmail from "./emails/beta-invitation.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

/**
 * Send beta invitation email to a single user or batch of users
 */
async function handleSendInvitation(req: Request, corsHeaders: Record<string, string>) {
  console.log("Handling POST /send-beta-invitation");

  try {
    const body = await req.json();
    const { emails, locale = "en" } = body;

    // Validate input
    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "Invalid request: 'emails' must be a non-empty array." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create service role client to update waitlist
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const results = {
      success: [] as string[],
      failed: [] as { email: string; error: string }[],
      alreadyInvited: [] as string[],
      immediatelyUpgraded: [] as string[],
    };

    // Process each email
    for (const email of emails) {
      // Validate email format
      if (!email || !email.includes("@")) {
        results.failed.push({ email, error: "Invalid email format" });
        continue;
      }

      // Check if email exists in waitlist
      let { data: waitlistRecord, error: waitlistError } = await supabase
        .from("waitlist")
        .select("id, email, invited_to_beta, invited_at")
        .eq("email", email)
        .single();

      // If error due to missing columns, try with basic columns only
      if (waitlistError && waitlistError.code === "42703") {
        console.log(`Columns not found, trying basic query for ${email}`);
        const fallbackResult = await supabase
          .from("waitlist")
          .select("id, email, created_at")
          .eq("email", email)
          .single();

        if (fallbackResult.error || !fallbackResult.data) {
          results.failed.push({
            email,
            error: "Email not found in waitlist",
          });
          console.error(`Waitlist lookup error for ${email}:`, fallbackResult.error);
          continue;
        }

        // Add default values for missing columns
        waitlistRecord = {
          ...fallbackResult.data,
          invited_to_beta: false,
          invited_at: null,
        };
        waitlistError = null;
      } else if (waitlistError || !waitlistRecord) {
        results.failed.push({
          email,
          error: waitlistError ? `Database error: ${waitlistError.message}` : "Email not found in waitlist",
        });
        console.error(`Waitlist lookup error for ${email}:`, waitlistError);
        continue;
      }

      // Check if already invited
      if (waitlistRecord.invited_to_beta) {
        results.alreadyInvited.push(email);
        console.log(`Email ${email} was already invited on ${waitlistRecord.invited_at}`);
        continue;
      }

      // Check if user already has a profile and upgrade if needed
      const { data: authUserData } = await supabase.auth.admin.listUsers();
      const existingUser = authUserData?.users?.find(u => u.email === email);

      if (existingUser) {
        // User has already signed up, check their current role
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', existingUser.id)
          .single();

        if (profile && profile.role === 'free') {
          // Upgrade user to beta immediately
          const { error: upgradeError } = await supabase
            .from('profiles')
            .update({ role: 'beta', updated_at: new Date().toISOString() })
            .eq('id', existingUser.id);

          if (!upgradeError) {
            console.log(`Immediately upgraded existing user ${email} from free to beta`);
            results.immediatelyUpgraded.push(email);

            // Mark as converted in waitlist since they're already upgraded
            await supabase
              .from('waitlist')
              .update({
                converted_to_beta: true,
                converted_at: new Date().toISOString(),
              })
              .eq('id', waitlistRecord.id);
          } else {
            console.error(`Error upgrading user ${email} to beta:`, upgradeError);
          }
        } else if (profile && ['pro', 'beta', 'admin'].includes(profile.role)) {
          console.log(`User ${email} already has ${profile.role} role, skipping upgrade`);
        }
      } else {
        console.log(`User ${email} does not have a profile yet, will be upgraded on first login`);
      }

      // Render email HTML
      const emailSubjects = {
        en: "You're invited to Knovy Beta!",
        "zh-TW": "您已被邀請加入 Knovy Beta！",
      };

      const emailHtml = renderToString(
        BetaInvitationEmail({
          username: email.split("@")[0],
          locale: locale || "en",
        })
      );

      // Send email via Resend
      const { data: resendData, error: resendError } = await resend.emails.send({
        from: "info@intevia.app",
        to: email,
        replyTo: "info@intevia.app",
        subject:
          emailSubjects[locale as keyof typeof emailSubjects] ||
          emailSubjects["en"],
        html: emailHtml,
      });

      if (resendError) {
        console.error(`Error sending email to ${email}:`, resendError);
        results.failed.push({
          email,
          error: resendError.message || "Failed to send email",
        });
        continue;
      }

      // Update waitlist record to mark as invited (skip if columns don't exist)
      const { error: updateError } = await supabase
        .from("waitlist")
        .update({
          invited_to_beta: true,
          invited_at: new Date().toISOString(),
        })
        .eq("id", waitlistRecord.id);

      if (updateError) {
        // If error is due to missing columns, just log warning and continue
        if (updateError.code === "42703") {
          console.warn(`Cannot update waitlist status for ${email}: columns don't exist yet. Email was sent successfully.`);
        } else {
          console.error(`Error updating waitlist record for ${email}:`, updateError);
          // Don't fail the invitation - email was already sent
        }
      }

      results.success.push(email);
      console.log(`Successfully sent beta invitation to ${email}, Resend ID: ${resendData?.id}`);
    }

    // Return comprehensive results
    return new Response(
      JSON.stringify({
        message: "Beta invitation process completed",
        summary: {
          total: emails.length,
          successful: results.success.length,
          failed: results.failed.length,
          alreadyInvited: results.alreadyInvited.length,
        },
        results,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error in send-beta-invitation:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "An unexpected error occurred.",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

/**
 * Get all waitlist users (for admin dashboard)
 */
async function handleGetWaitlist(req: Request, corsHeaders: Record<string, string>) {
  console.log("Handling GET /send-beta-invitation/waitlist");

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Try to fetch with new columns first
    let { data, error } = await supabase
      .from("waitlist")
      .select("id, email, created_at, invited_to_beta, invited_at, converted_to_beta, converted_at")
      .order("created_at", { ascending: false });

    // If error due to missing columns, fall back to basic columns
    if (error && error.code === "42703") {
      console.log("New columns not found, falling back to basic columns");
      const fallbackResult = await supabase
        .from("waitlist")
        .select("id, email, created_at")
        .order("created_at", { ascending: false });

      if (fallbackResult.error) throw fallbackResult.error;

      // Add default values for missing columns
      data = fallbackResult.data?.map(item => ({
        ...item,
        invited_to_beta: false,
        invited_at: null,
        converted_to_beta: false,
        converted_at: null,
      })) || [];
    } else if (error) {
      throw error;
    }

    return new Response(
      JSON.stringify({ waitlist: data }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (err) {
    console.error("Error fetching waitlist:", err);
    return new Response(
      JSON.stringify({
        error: err.message || "Failed to fetch waitlist",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
}

// Main router
serve(async (req) => {
  // Get dynamic CORS headers based on request origin
  const origin = req.headers.get("origin") ?? undefined;
  const corsHeaders = getCorsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/send-beta-invitation/, "");

  try {
    // GET /waitlist - Get all waitlist users
    if (path === "/waitlist" && req.method === "GET") {
      return await withRBAC("admin:read_users", (r) =>
        handleGetWaitlist(r, corsHeaders)
      )(req);
    }

    // POST / - Send beta invitations
    if ((path === "" || path === "/") && req.method === "POST") {
      return await withRBAC("admin:read_users", (r) =>
        handleSendInvitation(r, corsHeaders)
      )(req);
    }

    return new Response(JSON.stringify({ error: "Not Found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Error in send-beta-invitation router:", e);
    return new Response(
      JSON.stringify({ error: "Internal Server Error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
