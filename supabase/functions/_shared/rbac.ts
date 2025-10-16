
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

// Define a type for the Edge Function handler to ensure consistency
// It now receives the session profile as an argument.
type EdgeFunction = (req: Request, profile: Record<string, any>) => Promise<Response>;

/**
 * A higher-order function that wraps an Edge Function with entitlement and quota checks.
 *
 * @param requiredEntitlement - The entitlement key required to access the function (e.g., 'allow_ai_action:summarize').
 * @param quotaMetric - The metric key for quota checking (e.g., 'daily_ai_action:summarize_calls').
 * @param handler - The original Edge Function handler to be executed if authorization succeeds.
 * @returns A new Edge Function handler that includes the RBAC and quota logic.
 */
export function withEntitlements(requiredEntitlement: string, quotaMetric: string, handler: EdgeFunction): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      );

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Instead of multiple DB calls, we could invoke the 'get-session-profile' function.
      // For now, we re-implement the logic for performance and to avoid function-call overhead.
      const { data: profileData, error: profileError } = await supabaseClient.rpc('get_session_profile_data', { p_user_id: user.id });

      if (profileError || !profileData) {
        console.error('RBAC Error: Could not fetch session profile.', profileError);
        return new Response(JSON.stringify({ error: 'Failed to retrieve session profile.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      
      const sessionProfile = profileData;

      // 1. Check Entitlement
      if (!sessionProfile.entitlements[requiredEntitlement]) {
        console.warn(`RBAC Warning: User ${user.id} denied access to entitlement '${requiredEntitlement}'.`);
        return new Response(JSON.stringify({ error: 'Forbidden: You do not have access to this feature.' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 2. Check Quota
      const quota = sessionProfile.quotas[quotaMetric];
      if (quota && quota.limit !== -1 && quota.used >= quota.limit) {
        console.warn(`RBAC Warning: User ${user.id} exceeded quota for '${quotaMetric}'.`);
        return new Response(JSON.stringify({ error: 'Too Many Requests: You have exceeded your daily limit for this action.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. If all checks pass, execute the original handler with the profile
      return handler(req, sessionProfile);

    } catch (err) {
      console.error('RBAC Error: An unexpected error occurred in the middleware.', err);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  };
}

/**
 * A higher-order function that wraps an Edge Function with permission-based RBAC.
 * Used primarily for admin functions that need to check user permissions.
 *
 * This implementation works with the entitlements-based RBAC system.
 * For admin permissions (prefixed with 'admin:'), it checks if the user has the 'admin' role.
 *
 * @param requiredPermission - The permission required to access the function (e.g., 'admin:read_users').
 * @param handler - The original Edge Function handler to be executed if authorization succeeds.
 * @returns A new Edge Function handler that includes the RBAC logic.
 */
export function withRBAC(requiredPermission: string, handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  return async (req: Request) => {
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      // Create authenticated client to get user
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      );

      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Create service role client to bypass RLS for role checks
      const serviceClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Fetch the user's role
      const { data: profile, error: profileError } = await serviceClient
        .from('profiles')
        .select('role')
        .eq('id', user.id)
        .single();

      if (profileError || !profile) {
        console.error('RBAC Error: Could not fetch user profile.', profileError);
        return new Response(JSON.stringify({ error: 'Failed to retrieve user profile.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // For admin permissions, check if user has admin role
      if (requiredPermission.startsWith('admin:')) {
        if (profile.role !== 'admin') {
          console.warn(`RBAC Warning: User ${user.id} denied access to admin permission '${requiredPermission}'.`);
          return new Response(JSON.stringify({ error: 'Forbidden: Admin privileges required.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      } else {
        // For non-admin permissions, check entitlements
        const { data: entitlements, error: entitlementsError } = await serviceClient
          .from('entitlements')
          .select('config')
          .eq('role', profile.role)
          .single();

        if (entitlementsError || !entitlements) {
          console.error('RBAC Error: Could not fetch entitlements.', entitlementsError);
          return new Response(JSON.stringify({ error: 'Failed to retrieve entitlements.' }), {
            status: 500,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Check if the permission exists in entitlements
        if (!entitlements.config[requiredPermission]) {
          console.warn(`RBAC Warning: User ${user.id} denied access to permission '${requiredPermission}'.`);
          return new Response(JSON.stringify({ error: 'Forbidden: You do not have permission to access this resource.' }), {
            status: 403,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
      }

      // If authorization passes, execute the original handler
      return handler(req);

    } catch (err) {
      console.error('RBAC Error: An unexpected error occurred in the middleware.', err);
      return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
  };
}

// We need a new RPC function in the DB to get the session profile data efficiently.
// This is a placeholder for the SQL that should be in a new migration.
/*
CREATE OR REPLACE FUNCTION get_session_profile_data(p_user_id UUID)
RETURNS jsonb AS $
DECLARE
    -- function body here...
END;
$ LANGUAGE plpgsql;
*/

