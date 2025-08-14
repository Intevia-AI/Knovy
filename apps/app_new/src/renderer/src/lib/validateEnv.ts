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
      name: 'VITE_GEMINI_WS_URL',
      description: 'WebSocket URL for Gemini proxy connection',
      hint: 'Should point to your running proxy server (e.g., ws://localhost:4567)'
    },
    {
      name: 'VITE_AI_API_URL',
      description: 'API endpoint for AI interactions',
      hint: 'Should point to your API endpoint (e.g., http://localhost:3000/api/ai)'
    },
    {
      name: 'VITE_SUPABASE_URL',
      description: 'Supabase project URL',
      hint: 'Obtain from your Supabase project settings'
    },
    {
      name: 'VITE_SUPABASE_ANON_KEY',
      description: 'Supabase anonymous key',
      hint: 'Obtain from your Supabase project API settings'
    }
  ]

  const missingVars = requiredVars.filter((variable) => !import.meta.env[variable.name])

  if (missingVars.length > 0) {
    console.error('\n❌ Environment Validation Error ❌')
    console.error('The following required environment variables are missing:')

    missingVars.forEach((variable) => {
      console.error(`\n  → ${variable.name}`)
      console.error(`    Description: ${variable.description}`)
      console.error(`    Hint: ${variable.hint}`)
    })

    console.error('\nPlease check your .env file and ensure all required variables are set.')
    console.error('You can copy the .env.example file to .env to get started:\n')
    console.error('  cp .env.example .env\n')

    // In development, we'll show the error but allow the app to continue
    // In production, we'll throw an error to prevent startup with missing variables
    if (import.meta.env.NODE_ENV === 'production') {
      throw new Error('Missing required environment variables')
    }

    return false
  }

  return true
}
