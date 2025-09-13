import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { withRBAC } from '../_shared/rbac.ts';
import { corsHeaders } from '../_shared/cors.ts';

// --- Route Handlers ---

async function handleGetMyPermissions(req: Request) {
  console.log('Handling GET /me/permissions');
  // 1. Create a client with the user's auth context to securely get the user ID
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  );

  const { data: { user } } = await userClient.auth.getUser();
  if (!user) {
    return new Response(JSON.stringify({ error: 'Not authenticated' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  // 2. Create a service role client to bypass RLS for internal data fetching
  const serviceClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 3. Fetch the user's role using the service client
  const { data: profile, error: profileError } = await serviceClient.from('profiles').select('role').eq('id', user.id).single();
  if (profileError || !profile) {
    console.error('Error fetching profile for user:', user.id, profileError);
    throw new Error('Could not fetch user profile.');
  }

  // 4. Fetch all permissions for that role
  const { data: permissions, error: permissionsError } = await serviceClient.from('role_permissions').select('permission_name').eq('role_name', profile.role);
  if (permissionsError) {
    console.error('Error fetching permissions for role:', profile.role, permissionsError);
    throw new Error('Could not fetch permissions for role.');
  }

  const permissionList = permissions.map(p => p.permission_name);

  return new Response(JSON.stringify({ permissions: permissionList }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleGetUsers(req: Request) {
  console.log('Handling GET /users');
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase.rpc('get_users_with_roles');
  
  if (error) throw error;

  return new Response(JSON.stringify({ users: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleUpdateUserRole(req: Request, params: { id: string }) {
  console.log(`Handling POST /users/${params.id}/role`);
  const { role } = await req.json();
  if (!role) {
    return new Response(JSON.stringify({ error: 'Role is required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase.from('profiles').update({ role }).eq('id', params.id).select().single();
  
  if (error) throw error;

  return new Response(JSON.stringify({ success: true, user: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

async function handleGetUserUsage(req: Request, params: { id: string }) {
  console.log(`Handling GET /users/${params.id}/usage`);
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const { data, error } = await supabase.from('action_logs').select('*').eq('user_id', params.id).order('timestamp', { ascending: false });
  
  if (error) throw error;

  return new Response(JSON.stringify({ logs: data }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
}

// --- Main Router ---

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/admin-api/, '');

  try {
    // GET /me/permissions
    if (path === '/me/permissions' && req.method === 'GET') {
      return await handleGetMyPermissions(req);
    }

    // GET /users
    if (path === '/users' && req.method === 'GET') {
      return await withRBAC('admin:read_users', handleGetUsers)(req);
    }

    // POST /users/:id/role
    const roleMatch = path.match(/^\/users\/([0-9a-fA-F-]+)\/role$/);
    if (roleMatch && req.method === 'POST') {
      const [_, id] = roleMatch;
      return await withRBAC('admin:update_user_role', (r) => handleUpdateUserRole(r, { id }))(req);
    }

    // GET /users/:id/usage
    const usageMatch = path.match(/^\/users\/([0-9a-fA-F-]+)\/usage$/);
    if (usageMatch && req.method === 'GET') {
      const [_, id] = usageMatch;
      return await withRBAC('admin:read_users', (r) => handleGetUserUsage(r, { id }))(req);
    }

    return new Response(JSON.stringify({ error: 'Not Found' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('Error in admin-api router:', e);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
