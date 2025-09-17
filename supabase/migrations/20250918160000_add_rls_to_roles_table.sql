-- 1. Enable Row Level Security on the 'roles' table
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;

-- 2. Create a policy to allow authenticated users to read the roles.
-- This is a secure default, allowing logged-in users to see what roles are available.
CREATE POLICY "Allow authenticated read access to roles"
ON public.roles
FOR SELECT
TO authenticated
USING (true);

-- 3. Create a policy that allows users with the 'admin' role to manage the roles table.
-- This uses the is_admin() function we created in a previous migration.
CREATE POLICY "Allow admins to manage roles"
ON public.roles
FOR ALL
USING (is_admin())
WITH CHECK (is_admin());
