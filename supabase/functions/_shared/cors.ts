/**
 * @fileoverview CORS Headers
 * @module supabase/functions/_shared/cors
 * @description Shared CORS headers for Supabase Edge Functions to allow cross-origin requests.
 */

const isDevelopment = Deno.env.get("ENVIRONMENT") === "dev";

// Allowed production origins
const ALLOWED_ORIGINS = [
  "https://knovy.app",
  "https://knovy-admin-dashboard.vercel.app",
  "http://localhost:3000", // For local admin dashboard development
  "http://localhost:5173", // For local web app development
];

// For local development, allow all origins via wildcard
// For production, dynamically set the origin based on the request
const allowedOrigin = isDevelopment ? "*" : (Deno.env.get("PRODUCTION_APP_ORIGIN") ?? "https://knovy.app");

// Helper function to get CORS headers based on request origin
export function getCorsHeaders(requestOrigin?: string): Record<string, string> {
  let origin = allowedOrigin;

  // In production, check if the request origin is in our allowed list
  if (!isDevelopment && requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    origin = requestOrigin;
  }

  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Credentials": "true",
  };
}

// Backward compatibility: export static headers for simple cases
export const corsHeaders = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Credentials": "true",
};