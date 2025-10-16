-- Fix RLS Policies for Analytics Tables
-- Created: 2025-10-15
-- Purpose: Add INSERT and UPDATE policies for authenticated users

BEGIN;

-- ============================================================================
-- user_sessions: Allow users to insert and update their own sessions
-- ============================================================================

-- Users can insert their own sessions
CREATE POLICY "Users can insert own sessions"
  ON public.user_sessions
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own sessions (for heartbeat and metrics)
CREATE POLICY "Users can update own sessions"
  ON public.user_sessions
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- feature_usage: Allow users to insert their own feature usage
-- ============================================================================

-- Users can insert their own feature usage
CREATE POLICY "Users can insert own feature usage"
  ON public.feature_usage
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feature usage (for completion tracking)
CREATE POLICY "Users can update own feature usage"
  ON public.feature_usage
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ============================================================================
-- subscription_events: Allow users to view their subscription events
-- (INSERT will be done by backend/webhooks using service role)
-- ============================================================================
-- No INSERT policy needed for subscription_events - service role only

COMMIT;

-- ============================================================================
-- Migration Summary
-- ============================================================================
-- Added RLS policies:
--   - user_sessions: INSERT and UPDATE for authenticated users
--   - feature_usage: INSERT and UPDATE for authenticated users
--
-- Now users can:
--   - Create and update their own analytics sessions
--   - Log their own feature usage
--   - Read their own analytics data
-- ============================================================================
