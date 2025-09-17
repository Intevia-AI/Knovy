-- supabase/migrations/20250917150000_fix_rls_recursion.sql

-- 1. Create a helper function to check for admin role
-- This function runs with the permissions of the definer, bypassing the RLS check on `profiles`.
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
DECLARE
  is_admin_role BOOLEAN;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
  ) INTO is_admin_role;
  RETURN is_admin_role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Drop and recreate the policy on the `profiles` table
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
USING (is_admin());

-- 3. Drop and recreate the policy on the `action_logs` table
DROP POLICY IF EXISTS "Admins can view all action logs" ON public.action_logs;
CREATE POLICY "Admins can view all action logs"
ON public.action_logs FOR SELECT
USING (is_admin());

-- 4. Drop and recreate the policy on the `transcription_ledger` table
DROP POLICY IF EXISTS "Admins can view all transcription logs" ON public.transcription_ledger;
CREATE POLICY "Admins can view all transcription logs"
ON public.transcription_ledger FOR SELECT
USING (is_admin());
