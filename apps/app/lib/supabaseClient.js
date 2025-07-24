/**
 * @fileoverview Supabase client configuration and initialization
 * @module supabaseClient
 * @description Creates and exports a configured Supabase client instance for database and authentication operations
 */

import { createClient } from '@supabase/supabase-js'

/**
 * Supabase project URL from environment variables with fallback
 * @type {string}
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'YOUR_SUPABASE_URL_HERE'

/**
 * Supabase anonymous key from environment variables with fallback
 * @type {string}
 */
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY_HERE'

// Warn if using placeholder values instead of actual environment variables
if (supabaseUrl === 'YOUR_SUPABASE_URL_HERE' || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY_HERE') {
  console.warn(
    'Supabase URL or Anon Key is not set. Please create a .env.local file with NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY'
  )
}

/**
 * Configured Supabase client instance
 * @type {import('@supabase/supabase-js').SupabaseClient}
 * 
 * @example
 * // Import the client in your components
 * import { supabase } from '../lib/supabaseClient'
 * 
 * // Use for authentication
 * const { data, error } = await supabase.auth.signInWithPassword({
 *   email: 'user@example.com',
 *   password: 'password123'
 * })
 * 
 * // Use for database operations
 * const { data, error } = await supabase
 *   .from('table_name')
 *   .select('*')
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
  },
}) 