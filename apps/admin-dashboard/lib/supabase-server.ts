import { createServerClient as createServerSupabaseClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

// Validate environment variables at runtime
function validateEnvironmentVariables() {
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

  return { url, anonKey };
}

// Server-side Supabase client for server components
export async function createServerClient() {
  const { url, anonKey } = validateEnvironmentVariables();
  const cookieStore = await cookies();

  return createServerSupabaseClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}