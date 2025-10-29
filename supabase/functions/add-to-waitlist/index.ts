import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend";
import { renderToString } from "https://esm.sh/react-dom/server";
import WaitlistWelcomeEmail from "./emails/waitlist-welcome.tsx";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Define CORS headers for reuse
// Allow localhost in development, production domain in production
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://intevia.app",
  "https://www.intevia.app"
];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*", // Will be set dynamically per request
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Get the origin from the request and validate it
  const origin = req.headers.get("origin") || "";
  const responseCorsHeaders = {
    ...corsHeaders,
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
  };

  // Handle preflight requests
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: responseCorsHeaders, status: 200 });
  }

  try {
    const body = await req.json();
    const { email, locale } = body;

    // Basic email validation
    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Invalid email address provided." }), {
        headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        status: 400,
      });
    }

    // Create a Supabase client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
    );

    // Insert the email into the waitlist table
    const { data, error } = await supabase.from("waitlist").insert({ email }).select();

    if (error) {
      // Handle cases where the email already exists
      if (error.code === "23505") {
        // Postgres unique_violation code
        return new Response(
          JSON.stringify({
            error: "This email is already on the waitlist.",
          }),
          {
            headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
            status: 409, // HTTP 409 Conflict
          },
        );
      }
      // For other errors, re-throw to be caught by the catch block
      throw error;
    }

    // Send the welcome email
    const emailSubjects = {
      en: "Welcome to Knovy!",
      "zh-TW": "歡迎來到 Knovy！",
    };

    const emailHtml = renderToString(
      WaitlistWelcomeEmail({
        username: email.split("@")[0],
        locale: locale || "en",
      }),
    );

    const { data: resendData, error: resendError } = await resend.emails.send({
      from: "info@intevia.app",
      to: email,
      replyTo: "info@intevia.app",
      subject: emailSubjects[locale as keyof typeof emailSubjects] || emailSubjects["en"],
      html: emailHtml,
    });

    // Log the full Resend response for debugging
    console.log("Resend API response:", { resendData, resendError });

    if (resendError) {
      console.error("Error sending email:", resendError);
      return new Response(
        JSON.stringify({
          error: "Failed to send welcome email.",
          details: resendError,
        }),
        {
          headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
          status: 500,
        },
      );
    }

    // Return a success response
    return new Response(
      JSON.stringify({
        message: "Successfully added to waitlist",
        data,
        emailStatus: resendData,
      }),
      {
        headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (err) {
    // Catch any unexpected errors
    return new Response(JSON.stringify({ error: err.message || "An unexpected error occurred." }), {
      headers: { ...responseCorsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
