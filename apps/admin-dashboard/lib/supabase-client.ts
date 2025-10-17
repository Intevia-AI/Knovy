import { createBrowserClient } from '@supabase/ssr';

// Validate environment variables at runtime
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  const missingVars = [];
  if (!url) missingVars.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!anonKey) missingVars.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');

  throw new Error(
    `Missing required environment variables: ${missingVars.join(', ')}. ` +
    `Please check your .env file.`
  );
}

// Browser client that properly handles cookies for SSR with PKCE flow
// Note: createBrowserClient automatically handles cookies in the browser,
// so we don't need custom cookie handlers
export const supabase = createBrowserClient(url, anonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
});
