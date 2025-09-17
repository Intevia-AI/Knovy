-- supabase/migrations/20250913120000_create_initial_schema.sql

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
CREATE POLICY "Allow service_role to insert transcription logs" ON public.transcription_ledger FOR INSERT WITH CHECK (true);

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
