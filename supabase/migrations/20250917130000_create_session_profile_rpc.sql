-- supabase/migrations/20250917130000_create_session_profile_rpc.sql

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

    -- Calculate usage (this is a simplified version of the logic in the edge function)
    -- In a real-world scenario, this might become more complex.
    WITH usage_calcs AS (
        SELECT 
            q.metric,
            q.limit,
            COALESCE(
                CASE
                    WHEN q.metric LIKE 'daily_ai_action:%' THEN (
                        SELECT count(*)::int
                        FROM public.action_logs al
                        WHERE al.user_id = p_user_id
                        AND al.action = REPLACE(REPLACE(q.metric, 'daily_', ''), '_calls', '')
                        AND al.timestamp >= date_trunc('day', now() at time zone 'utc')
                    )
                    WHEN q.metric = 'daily_transcription_minutes' THEN (
                        SELECT sum(tl.duration_seconds)::int / 60
                        FROM public.transcription_ledger tl
                        WHERE tl.user_id = p_user_id
                        AND tl.created_at >= date_trunc('day', now() at time zone 'utc')
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
