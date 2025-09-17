-- supabase/migrations/20250917160000_deprecate_old_rbac.sql

-- This migration removes the old, granular permission system which has been
-- replaced by the JSONB config in the `entitlements` table.

-- 1. Drop the old RPC function that checked for granular permissions.
DROP FUNCTION IF EXISTS public.check_permission(p_user_id UUID, p_permission_name TEXT);

-- 2. Drop the join table that mapped roles to permissions.
-- The CASCADE keyword will automatically remove any foreign key constraints that depend on this table.
DROP TABLE IF EXISTS public.role_permissions CASCADE;

-- 3. Drop the table that held the granular permission definitions.
DROP TABLE IF EXISTS public.permissions CASCADE;

-- Note: The `roles` table is still in use by the new `entitlements` table
-- and the `profiles` table, so it is NOT dropped.
