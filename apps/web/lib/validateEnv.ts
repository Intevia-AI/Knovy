/**
 * Environment Variable Validation Utility
 *
 * This module validates required environment variables on application startup
 * and provides clear error messages if any required variables are missing.
 */

/**
 * Validates that all required environment variables are set
 * @returns {boolean} True if all required variables are set, throws error otherwise
 */
export function validateEnv(): boolean {
  const requiredVars = [
    {
      name: "GOOGLE_GENERATIVE_AI_API_KEY",
      description: "Google Generative AI API Key for Gemini integration",
      hint: "Obtain from Google AI Studio (https://aistudio.google.com/app/apikey)",
    },
    {
      name: "GMAIL_USER",
      description: "Gmail account for sending feedback and notification emails",
      hint: "Use a dedicated service account email",
    },
    {
      name: "GMAIL_PASS",
      description: "Gmail App Password (not your regular Gmail password)",
      hint: "Generate at: Google Account > Security > 2-Step Verification > App passwords",
    },
    {
      name: "NEXT_PUBLIC_PROXY_SERVER_URL",
      description: "WebSocket proxy server URL for Gemini AI connections",
      hint: "Default: ws://localhost:4567 (if running proxy locally)",
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_URL",
      description: "Supabase URL for waitlist feature",
      hint: "Obtain from Supabase project settings",
    },
    {
      name: "NEXT_PUBLIC_SUPABASE_ANON_KEY",
      description: "Supabase anonymous key for waitlist feature",
      hint: "Obtain from Supabase project settings",
    },
  ];

  const missingVars = requiredVars.filter((variable) => !process.env[variable.name]);

  if (missingVars.length > 0) {
    console.error("\n❌ Environment Validation Error ❌");
    console.error("The following required environment variables are missing:");

    missingVars.forEach((variable) => {
      console.error(`\n  → ${variable.name}`);
      console.error(`    Description: ${variable.description}`);
      console.error(`    Hint: ${variable.hint}`);
    });

    console.error("\nPlease check your .env file and ensure all required variables are set.");
    console.error("You can copy the .env.example file to .env to get started:\n");
    console.error("  cp .env.example .env\n");

    // In development, we'll show the error but allow the app to continue
    // In production, we'll throw an error to prevent startup with missing variables
    if (process.env.NODE_ENV === "production") {
      throw new Error("Missing required environment variables");
    }

    return false;
  }

  return true;
}
