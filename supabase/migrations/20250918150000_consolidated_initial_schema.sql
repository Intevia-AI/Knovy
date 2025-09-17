-- supabase/migrations/20250918150000_consolidated_initial_schema.sql

-- FROM: 20250913120000_create_initial_schema.sql
-- 1. Roles Table
CREATE TABLE public.roles (
    name TEXT PRIMARY KEY,
    description TEXT
);
COMMENT ON TABLE public.roles IS 'Defines user roles like free, pro, admin.';

-- Seed Roles
INSERT INTO public.roles (name, description) VALUES
('free', 'Standard user with basic access.'),
('pro', 'User with paid subscription and extended access.'),
('beta', 'User with early access to new features.'),
('admin', 'System administrator with full access.');

-- 2. Profiles Table
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'free' REFERENCES public.roles(name),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.profiles IS 'Stores user-specific data and their role.';

-- 3. Action Logs Table
CREATE TABLE public.action_logs (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    metadata JSONB
);
COMMENT ON TABLE public.action_logs IS 'Logs user actions for auditing and quota enforcement.';
CREATE INDEX idx_action_logs_user_id_timestamp ON public.action_logs(user_id, timestamp);

-- 4. App Settings Table
CREATE TABLE public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);
COMMENT ON TABLE public.app_settings IS 'Controls global, dynamic application experiences.';

-- Seed App Settings
INSERT INTO public.app_settings (key, value) VALUES
('free_tier_experience', '{ "mode": "non-access" }');

-- 5. Entitlements Table
CREATE TABLE public.entitlements (
    role TEXT PRIMARY KEY REFERENCES public.roles(name) ON DELETE CASCADE,
    config JSONB NOT NULL
);
COMMENT ON TABLE public.entitlements IS 'Defines feature access and configuration for each role.';

-- Seed Entitlements
INSERT INTO public.entitlements (role, config) VALUES
('free', '{ "allow_transcription": true, "allow_ai_action:summarize": false, "allow_ai_action:keyword-search": false, "allow_ai_action:chat": false, "allow_ai_action:recommend-response": false, "allow_ai_action:screenshot-analysis": false, "beta_features_enabled": false }'),
('pro', '{ "allow_transcription": true, "allow_ai_action:summarize": true, "allow_ai_action:keyword-search": true, "allow_ai_action:chat": true, "allow_ai_action:recommend-response": true, "allow_ai_action:screenshot-analysis": true, "beta_features_enabled": true }'),
('beta', '{ "allow_transcription": true, "allow_ai_action:summarize": true, "allow_ai_action:keyword-search": true, "allow_ai_action:chat": true, "allow_ai_action:recommend-response": true, "allow_ai_action:screenshot-analysis": true, "beta_features_enabled": true }'),
('admin', '{ "allow_transcription": true, "allow_ai_action:summarize": true, "allow_ai_action:keyword-search": true, "allow_ai_action:chat": true, "allow_ai_action:recommend-response": true, "allow_ai_action:screenshot-analysis": true, "beta_features_enabled": true }');

-- 6. Quotas Table
CREATE TABLE public.quotas (
    role TEXT NOT NULL,
    metric TEXT NOT NULL,
    "limit" NUMERIC NOT NULL,
    PRIMARY KEY(role, metric)
);
COMMENT ON TABLE public.quotas IS 'Defines all numeric, consumable limits for each role.';

-- Seed Quotas
INSERT INTO public.quotas (role, metric, "limit") VALUES
('free', 'daily_transcription_minutes', 30),
('free', 'daily_session_count', 3),
('pro', 'daily_transcription_minutes', 120),
('pro', 'daily_session_count', -1),
('pro', 'daily_ai_action:summarize_calls', 100),
('pro', 'daily_ai_action:keyword-search_calls', 100),
('pro', 'daily_ai_action:chat_calls', 100),
('pro', 'daily_ai_action:recommend-response_calls', 100),
('pro', 'daily_ai_action:screenshot-analysis_calls', 100),
('beta', 'daily_transcription_minutes', -1),
('beta', 'daily_session_count', -1),
('beta', 'daily_ai_action:summarize_calls', -1),
('beta', 'daily_ai_action:keyword-search_calls', -1),
('beta', 'daily_ai_action:chat_calls', -1),
('beta', 'daily_ai_action:recommend-response_calls', -1),
('beta', 'daily_ai_action:screenshot-analysis_calls', -1),
('admin', 'daily_transcription_minutes', -1),
('admin', 'daily_session_count', -1),
('admin', 'daily_ai_action:summarize_calls', -1),
('admin', 'daily_ai_action:keyword-search_calls', -1),
('admin', 'daily_ai_action:chat_calls', -1),
('admin', 'daily_ai_action:recommend-response_calls', -1),
('admin', 'daily_ai_action:screenshot-analysis_calls', -1);

-- 7. Transcription Ledger Table
CREATE TABLE public.transcription_ledger (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    session_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.transcription_ledger IS 'Tracks transcription usage for quota enforcement.';
CREATE INDEX idx_transcription_ledger_user_id_created_at ON public.transcription_ledger(user_id, created_at);

-- 8. Auto-create profile on new user sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, role)
  VALUES (new.id, 'free');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 9. Row Level Security (RLS)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.action_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can view their own action logs" ON public.action_logs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert their own action logs" ON public.action_logs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public read access to entitlements" ON public.entitlements FOR SELECT USING (true);
CREATE POLICY "Allow public read access to quotas" ON public.quotas FOR SELECT USING (true);
CREATE POLICY "Users can view their own transcription logs" ON public.transcription_ledger FOR SELECT USING (auth.uid() = user_id);

-- 10. RPC to get all users with their roles
CREATE OR REPLACE FUNCTION public.get_users_with_roles()
RETURNS TABLE(id UUID, role TEXT, email TEXT) AS $FUNCTION_BODY$
BEGIN
  RETURN QUERY
  SELECT
    u.id,
    p.role,
    u.email::TEXT
  FROM
    auth.users u
  JOIN
    public.profiles p ON u.id = p.id;
END;
$FUNCTION_BODY$ LANGUAGE plpgsql SECURITY DEFINER;

-- FROM: 20250918120000_add_unique_constraint_to_session.sql
ALTER TABLE public.transcription_ledger
ADD CONSTRAINT transcription_ledger_session_id_key UNIQUE (session_id);

-- FROM: 20250918140000_add_update_policy_for_ledger.sql
-- Remove the old service_role only insert policy
DROP POLICY IF EXISTS "Allow service_role to insert transcription logs" ON public.transcription_ledger;

-- Allow users to insert their own transcription logs
CREATE POLICY "Users can insert their own transcription logs"
ON public.transcription_ledger
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own transcription logs
CREATE POLICY "Users can update their own transcription logs"
ON public.transcription_ledger
FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- FROM: 20250917130000_create_session_profile_rpc.sql
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

-- FROM: 20250917150000_fix_rls_recursion.sql
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
