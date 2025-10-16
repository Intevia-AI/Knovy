-- Fix RPC Function for Analytics Migration
-- Created: 2025-10-15
-- Purpose: Update get_session_profile_data to use new analytics tables

BEGIN;

-- Drop and recreate the get_session_profile_data function with updated table references
CREATE OR REPLACE FUNCTION get_session_profile_data(p_user_id UUID)
RETURNS jsonb AS $$
DECLARE
    v_role TEXT;
    v_app_settings JSONB;
    v_entitlements JSONB;
    v_quotas JSONB;
    v_usage JSONB;
    v_session_profile JSONB;
BEGIN
    -- Get user role
    SELECT role INTO v_role FROM public.profiles WHERE id = p_user_id;
    IF NOT FOUND THEN
        -- Profile not found, likely a race condition with a new user.
        -- Default to 'free' role instead of raising an exception.
        v_role := 'free';
    END IF;

    -- Aggregate app_settings
    SELECT jsonb_object_agg(key, value) INTO v_app_settings FROM public.app_settings;

    -- Get entitlements for the role
    SELECT config INTO v_entitlements FROM public.entitlements WHERE role = v_role;

    -- Get all quotas for the role
    SELECT jsonb_agg(jsonb_build_object('metric', metric, 'limit', "limit")) INTO v_quotas FROM public.quotas WHERE role = v_role;

    -- Calculate usage with NEW analytics tables
    WITH usage_calcs AS (
        SELECT
            q.metric,
            q.limit,
            COALESCE(
                CASE
                    -- AI action usage: query feature_usage table
                    WHEN q.metric LIKE 'daily_ai_action:%' THEN (
                        SELECT count(*)::int
                        FROM public.feature_usage fu
                        WHERE fu.user_id = p_user_id
                        -- Extract feature name from metric (e.g., "daily_ai_action:summarize_calls" -> "ai-summarize")
                        AND fu.feature_name = 'ai-' || REPLACE(REPLACE(REPLACE(q.metric, 'daily_ai_action:', ''), '_calls', ''), '_', '-')
                        AND fu.created_at >= date_trunc('day', now() at time zone 'utc')
                    )
                    -- Transcription usage: sum transcription_minutes from user_sessions table
                    WHEN q.metric = 'daily_transcription_minutes' THEN (
                        SELECT COALESCE(sum(us.transcription_minutes)::int, 0)
                        FROM public.user_sessions us
                        WHERE us.user_id = p_user_id
                        AND us.started_at >= date_trunc('day', now() at time zone 'utc')
                    )
                    ELSE 0
                END, 0
            ) as used
        FROM public.quotas q
        WHERE q.role = v_role
    )
    SELECT jsonb_object_agg(metric, jsonb_build_object('limit', "limit", 'used', used)) INTO v_usage FROM usage_calcs;

    -- Construct the final profile
    v_session_profile := jsonb_build_object(
        'user_id', p_user_id,
        'role', v_role,
        'app_settings', v_app_settings,
        'entitlements', v_entitlements,
        'quotas', v_usage
    );

    RETURN v_session_profile;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMIT;

-- ============================================================================
-- Migration Summary
-- ============================================================================
-- Updated get_session_profile_data RPC function to use:
--   - feature_usage table instead of action_logs
--   - user_sessions table instead of transcription_ledger
--
-- Now RBAC will work correctly with the new analytics schema
-- ============================================================================
