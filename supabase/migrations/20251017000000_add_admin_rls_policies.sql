-- Add Admin RLS Policies for Analytics Tables
-- Created: 2025-10-17
-- Purpose: Allow admin users to read all analytics data
--
-- Problem: Admin dashboard couldn't display any data because RLS policies
-- only allowed users to see their own data. Admins are authenticated users
-- but need access to ALL users' data for the admin dashboard.
--
-- Solution: Add RLS policies that check if the authenticated user has
-- the "admin" role using the existing is_admin() function, and if so,
-- grant read access to all rows in the new analytics tables.

BEGIN;

-- Note: is_admin() function already exists from consolidated_initial_schema.sql
-- Note: "Admins can view all profiles" policy already exists

-- ============================================================================
-- user_sessions: Add admin read policy
-- ============================================================================

-- Admins can read all sessions
CREATE POLICY "Admins can view all sessions"
  ON public.user_sessions
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- feature_usage: Add admin read policy
-- ============================================================================

-- Admins can read all feature usage
CREATE POLICY "Admins can view all feature usage"
  ON public.feature_usage
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

-- ============================================================================
-- subscription_events: Add admin read policy
-- ============================================================================

-- Admins can read all subscription events
CREATE POLICY "Admins can view all subscription events"
  ON public.subscription_events
  FOR SELECT
  TO authenticated
  USING (public.is_admin());

COMMIT;

-- ============================================================================
-- Migration Summary
-- ============================================================================
-- Added RLS policies for admins to read:
--   - all user_sessions
--   - all feature_usage
--   - all subscription_events
--
-- Now admin users can:
--   - View all analytics data in the admin dashboard
--   - Monitor all feature usage and errors across all users
--   - Access user session data for analytics displays
--
-- Security:
--   - Policies only apply to SELECT operations (read-only)
--   - Admin status is checked via existing is_admin() function
--   - Regular users still restricted to their own data
--   - Profiles table already has "Admins can view all profiles" policy
-- ============================================================================
