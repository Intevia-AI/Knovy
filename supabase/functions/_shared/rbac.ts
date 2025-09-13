
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { corsHeaders } from './cors.ts';

// Define a type for the Edge Function handler to ensure consistency
type EdgeFunction = (req: Request) => Promise<Response>;

/**
 * A higher-order function that wraps an Edge Function with RBAC checks.
 *
 * @param requiredPermission - The permission string required to access the function (e.g., 'ai_action:summarize').
 * @param handler - The original Edge Function handler to be executed if authorization succeeds.
 * @returns A new Edge Function handler that includes the RBAC logic.
 */
export function withRBAC(requiredPermission: string, handler: EdgeFunction): EdgeFunction {
  return async (req: Request) => {
    // Handle CORS preflight requests
    if (req.method === 'OPTIONS') {
      return new Response('ok', { headers: corsHeaders });
    }

    try {
      // 1. Create a Supabase client with the user's auth token
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
      );

      // 2. Get the user from the JWT
      const { data: { user }, error: userError } = await supabaseClient.auth.getUser();

      if (userError || !user) {
        console.error('RBAC Error: User not found or auth error.', userError);
        return new Response(JSON.stringify({ error: 'Authentication failed' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // 3. Check if the user's role has the required permission
      const { data, error: rpcError } = await supabaseClient.rpc('check_permission', {
        p_user_id: user.id,
        p_permission_name: requiredPermission
      });

      if (rpcError) {
        console.error(`RBAC Error: RPC failed for user ${user.id} and permission ${requiredPermission}`, rpcError);
        return new Response(JSON.stringify({ error: 'Permission check failed.' }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      const hasPermission = data;

      if (!hasPermission) {
        console.warn(`RBAC Warning: User ${user.id} denied access to permission '${requiredPermission}'.`);
        return new Response(JSON.stringify({ error: 'Forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // TODO: Implement usage quota checks.
      // - Query the `action_logs` table to count recent actions.
      // - Compare against limits defined for the user's role.
      // - Return 429 Too Many Requests if quota is exceeded.

      // 4. If all checks pass, execute the original handler
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

