/**
 * @fileoverview CORS Headers
 * @module supabase/functions/_shared/cors
 * @description Shared CORS headers for Supabase Edge Functions to allow cross-origin requests.
 */

const isDevelopment = Deno.env.get("ENVIRONMENT") === "dev";

// For local development, allowing multiple origins can be complex.
// A simple and common approach is to allow all origins via wildcard (*).
// For production, we strictly enforce a single, specific origin for security.
const allowedOrigin = isDevelopment
  ? "*"
  : (Deno.env.get("PRODUCTION_APP_ORIGIN") ?? "https://knovy.app"); // Your production domain

export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
};