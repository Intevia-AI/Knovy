/**
 * @fileoverview CORS Headers
 * @module supabase/functions/_shared/cors
 * @description Shared CORS headers for Supabase Edge Functions to allow cross-origin requests.
 */
// Set CORS headers based on environment
const allowedOrigin =
  Deno.env.get("ENVIRONMENT") === "dev"
    ? "http://localhost:5173"
    : (Deno.env.get("PRODUCTION_APP_ORIGIN") ?? "https://intevia.app");

export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
