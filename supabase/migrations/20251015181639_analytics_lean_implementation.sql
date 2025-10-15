-- Analytics Lean Implementation Migration
-- Created: 2025-10-15
-- Philosophy: Start Simple, Measure, Learn, Iterate
--
-- This migration implements a lean analytics system with:
-- 1. user_sessions table (replaces transcription_ledger)
-- 2. feature_usage table (replaces action_logs)
-- 3. subscription_events table (reserved for future)
-- 4. Extended user_profiles with analytics fields
--
-- Breaking Changes:
-- - Drops action_logs table
-- - Drops transcription_ledger table

BEGIN;

-- ============================================================================
-- STEP 1: Drop Old Tables
-- ============================================================================

-- Drop old analytics tables
DROP TABLE IF EXISTS public.action_logs CASCADE;
DROP TABLE IF EXISTS public.transcription_ledger CASCADE;

-- ============================================================================
-- STEP 2: Extend profiles Table
-- ============================================================================

-- Add analytics fields to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS job_title TEXT,
  ADD COLUMN IF NOT EXISTS industry TEXT,
  ADD COLUMN IF NOT EXISTS company_size TEXT,
  ADD COLUMN IF NOT EXISTS use_case TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_source TEXT,
  ADD COLUMN IF NOT EXISTS acquisition_campaign TEXT,
  ADD COLUMN IF NOT EXISTS first_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS total_sessions INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_minutes INTEGER DEFAULT 0;

-- Add index for common analytics queries
CREATE INDEX IF NOT EXISTS idx_profiles_activity
  ON public.profiles(last_active_at DESC, first_seen_at);

-- Backfill first_seen_at for existing users
UPDATE public.profiles
SET first_seen_at = created_at
WHERE first_seen_at IS NULL AND created_at IS NOT NULL;

-- ============================================================================
-- STEP 3: Create user_sessions Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.user_sessions (
  session_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Session timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  last_heartbeat_at TIMESTAMPTZ DEFAULT NOW(),

  -- Session context
  platform TEXT NOT NULL,
  app_version TEXT,
  os_name TEXT,
  os_version TEXT,

  -- Session metrics (incremented throughout session)
  transcription_count INTEGER DEFAULT 0,
  transcription_minutes NUMERIC(10,2) DEFAULT 0,
  ai_actions_count INTEGER DEFAULT 0,
  errors_count INTEGER DEFAULT 0,

  -- Session quality
  is_active BOOLEAN DEFAULT TRUE,
  exit_reason TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics queries
CREATE INDEX idx_sessions_user_time ON public.user_sessions(user_id, started_at DESC);
CREATE INDEX idx_sessions_active ON public.user_sessions(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_sessions_platform ON public.user_sessions(platform, started_at);

-- Add comment
COMMENT ON TABLE public.user_sessions IS 'Tracks user engagement sessions with metrics. Replaces transcription_ledger.';

-- ============================================================================
-- STEP 4: Create feature_usage Table
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.feature_usage (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id UUID REFERENCES public.user_sessions(session_id) ON DELETE SET NULL,

  -- Feature identification
  feature_name TEXT NOT NULL,
  feature_category TEXT NOT NULL,

  -- Usage timing
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  duration_ms INTEGER,

  -- Outcome
  success BOOLEAN DEFAULT TRUE,
  error_type TEXT,
  error_message TEXT,

  -- Feature-specific metadata (flexible JSONB)
  metadata JSONB DEFAULT '{}',

  -- Cost tracking (for AI features)
  api_cost_usd NUMERIC(10,6),

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for analytics
CREATE INDEX idx_feature_usage_user ON public.feature_usage(user_id, created_at DESC);
CREATE INDEX idx_feature_usage_feature ON public.feature_usage(feature_name, created_at DESC);
CREATE INDEX idx_feature_usage_session ON public.feature_usage(session_id, created_at);
CREATE INDEX idx_feature_usage_success ON public.feature_usage(success, error_type);
CREATE INDEX idx_feature_usage_category ON public.feature_usage(feature_category, created_at DESC);

-- GIN index for metadata queries
CREATE INDEX idx_feature_usage_metadata ON public.feature_usage USING GIN (metadata);

-- Add comment
COMMENT ON TABLE public.feature_usage IS 'Tracks individual feature usage events. Replaces action_logs.';

-- ============================================================================
-- STEP 5: Create subscription_events Table (Reserved for Future)
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.subscription_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Event details
  event_type TEXT NOT NULL,
  from_plan TEXT,
  to_plan TEXT NOT NULL,

  -- Financial
  plan_price NUMERIC(10,2),
  plan_interval TEXT,
  currency TEXT DEFAULT 'USD',

  -- Tracking
  subscription_id TEXT,
  payment_provider TEXT,

  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_subscription_events_user ON public.subscription_events(user_id, created_at DESC);
CREATE INDEX idx_subscription_events_type ON public.subscription_events(event_type, created_at DESC);

-- Add comment
COMMENT ON TABLE public.subscription_events IS 'Tracks subscription lifecycle events. Reserved for future use.';

-- ============================================================================
-- STEP 6: Create Trigger to Update user_profiles.last_active_at
-- ============================================================================

-- Function to update user's last_active_at timestamp
CREATE OR REPLACE FUNCTION public.update_user_last_active()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.profiles
  SET last_active_at = NEW.last_heartbeat_at
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on user_sessions heartbeat updates
CREATE TRIGGER trigger_update_last_active
  AFTER UPDATE OF last_heartbeat_at ON public.user_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_user_last_active();

-- ============================================================================
-- STEP 7: Create Helper Functions for Data Retention
-- ============================================================================

-- Function to cleanup old analytics data
CREATE OR REPLACE FUNCTION public.cleanup_old_analytics()
RETURNS void AS $$
BEGIN
  -- Keep user_sessions for 1 year
  DELETE FROM public.user_sessions
  WHERE started_at < NOW() - INTERVAL '1 year';

  -- Keep feature_usage for 1 year
  DELETE FROM public.feature_usage
  WHERE created_at < NOW() - INTERVAL '1 year';

  RAISE NOTICE 'Analytics cleanup completed';
END;
$$ LANGUAGE plpgsql;

-- Add comment
COMMENT ON FUNCTION public.cleanup_old_analytics IS 'Cleans up analytics data older than 1 year. Run monthly via cron.';

-- ============================================================================
-- STEP 8: Enable Row Level Security (RLS)
-- ============================================================================

-- Enable RLS on new tables
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscription_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_sessions
-- Users can read their own sessions
CREATE POLICY "Users can view own sessions"
  ON public.user_sessions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend functions)
CREATE POLICY "Service role has full access to sessions"
  ON public.user_sessions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for feature_usage
-- Users can read their own feature usage
CREATE POLICY "Users can view own feature usage"
  ON public.feature_usage
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend functions)
CREATE POLICY "Service role has full access to feature usage"
  ON public.feature_usage
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for subscription_events
-- Users can read their own subscription events
CREATE POLICY "Users can view own subscription events"
  ON public.subscription_events
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role can do everything (for backend functions)
CREATE POLICY "Service role has full access to subscription events"
  ON public.subscription_events
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ============================================================================
-- STEP 9: Grant Permissions
-- ============================================================================

-- Grant permissions to authenticated users (read-only for their own data)
GRANT SELECT ON public.user_sessions TO authenticated;
GRANT SELECT ON public.feature_usage TO authenticated;
GRANT SELECT ON public.subscription_events TO authenticated;

-- Grant full permissions to service role
GRANT ALL ON public.user_sessions TO service_role;
GRANT ALL ON public.feature_usage TO service_role;
GRANT ALL ON public.subscription_events TO service_role;

-- Grant sequence usage for BIGSERIAL columns
GRANT USAGE, SELECT ON SEQUENCE public.feature_usage_id_seq TO service_role;
GRANT USAGE, SELECT ON SEQUENCE public.subscription_events_id_seq TO service_role;

COMMIT;

-- ============================================================================
-- Migration Summary
-- ============================================================================
-- Tables Created:
--   - user_sessions (replaces transcription_ledger)
--   - feature_usage (replaces action_logs)
--   - subscription_events (reserved for future)
--
-- Tables Modified:
--   - user_profiles (added analytics fields)
--
-- Tables Dropped:
--   - action_logs
--   - transcription_ledger
--
-- Functions Created:
--   - update_user_last_active() - Auto-updates user last_active_at
--   - cleanup_old_analytics() - Data retention cleanup
--
-- Indexes Created:
--   - 10+ indexes optimized for Grafana queries
--
-- RLS Policies:
--   - Users can view their own analytics data
--   - Service role has full access for backend operations
-- ============================================================================
