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
export const supabase = createBrowserClient(url, anonKey, {
  auth: {
    flowType: 'pkce',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  cookies: {
    getAll() {
      // Only access document in browser environment
      if (typeof document === 'undefined') {
        return [];
      }
      return document.cookie.split(';').map(cookie => {
        const [name, ...rest] = cookie.split('=');
        return {
          name: (name || '').trim(),
          value: rest.join('=').trim()
        };
      });
    },
    setAll(cookiesToSet) {
      // Only access document in browser environment
      if (typeof document === 'undefined') {
        return;
      }
      cookiesToSet.forEach(({ name, value, options }) => {
        let cookie = `${name}=${value}`;

        if (options?.maxAge) {
          cookie += `; max-age=${options.maxAge}`;
        }
        if (options?.path) {
          cookie += `; path=${options.path}`;
        }
        if (options?.domain) {
          cookie += `; domain=${options.domain}`;
        }
        if (options?.sameSite) {
          cookie += `; samesite=${options.sameSite}`;
        }
        if (options?.secure) {
          cookie += '; secure';
        }

        document.cookie = cookie;
      });
    }
  }
});
