import { createClient } from '@supabase/supabase-js';

// Note: This is a client-side-only client
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);