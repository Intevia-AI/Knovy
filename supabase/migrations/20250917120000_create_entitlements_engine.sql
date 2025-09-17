-- supabase/migrations/20250917120000_create_entitlements_engine.sql

-- Phase 1: The Unified Backend Schema

-- 1. App Settings Table
CREATE TABLE public.app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL
);
COMMENT ON TABLE public.app_settings IS 'Controls global, dynamic application experiences.';

-- Seed initial app settings
INSERT INTO public.app_settings (key, value) VALUES
('free_tier_experience', '{ "mode": "non-access" }');

-- 2. Entitlements Table
CREATE TABLE public.entitlements (
    role TEXT PRIMARY KEY REFERENCES public.roles(name) ON DELETE CASCADE,
    config JSONB NOT NULL
);
COMMENT ON TABLE public.entitlements IS 'Defines feature access and configuration for each role.';

-- Seed initial entitlements
-- Note: This replaces the need for many entries in `role_permissions` for simple feature flags.
INSERT INTO public.entitlements (role, config) VALUES
('free', '{ "allow_transcription": true, "allow_ai_action:summarize": false, "allow_ai_action:keyword-search": false, "allow_ai_action:chat": false, "allow_ai_action:recommend-response": false, "allow_ai_action:screenshot-analysis": false, "beta_features_enabled": false }'),
('pro', '{ "allow_transcription": true, "allow_ai_action:summarize": true, "allow_ai_action:keyword-search": true, "allow_ai_action:chat": true, "allow_ai_action:recommend-response": true, "allow_ai_action:screenshot-analysis": true, "beta_features_enabled": true }'),
('beta', '{ "allow_transcription": true, "allow_ai_action:summarize": true, "allow_ai_action:keyword-search": true, "allow_ai_action:chat": true, "allow_ai_action:recommend-response": true, "allow_ai_action:screenshot-analysis": true, "beta_features_enabled": true }'),
('admin', '{ "allow_transcription": true, "allow_ai_action:summarize": true, "allow_ai_action:keyword-search": true, "allow_ai_action:chat": true, "allow_ai_action:recommend-response": true, "allow_ai_action:screenshot-analysis": true, "beta_features_enabled": true }');

-- 3. Quotas Table
CREATE TABLE public.quotas (
    role TEXT NOT NULL,
    metric TEXT NOT NULL,
    "limit" NUMERIC NOT NULL,
    PRIMARY KEY(role, metric)
);
COMMENT ON TABLE public.quotas IS 'Defines all numeric, consumable limits for each role.';

-- Seed initial quotas
INSERT INTO public.quotas (role, metric, "limit") VALUES
('free', 'daily_transcription_minutes', 30),
('free', 'daily_session_count', 3),
('pro', 'daily_transcription_minutes', 120),
('pro', 'daily_session_count', -1), -- -1 for unlimited
('pro', 'daily_ai_action:summarize_calls', 100),
('pro', 'daily_ai_action:keyword-search_calls', 100),
('pro', 'daily_ai_action:chat_calls', 100),
('pro', 'daily_ai_action:recommend-response_calls', 100),
('pro', 'daily_ai_action:screenshot-analysis_calls', 100);

-- 4. Transcription Ledger Table
CREATE TABLE public.transcription_ledger (
    id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    session_id UUID NOT NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    duration_seconds INTEGER NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
COMMENT ON TABLE public.transcription_ledger IS 'Tracks transcription usage for quota enforcement.';
CREATE INDEX idx_transcription_ledger_user_id_created_at ON public.transcription_ledger(user_id, created_at);

-- 5. RLS for new tables
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quotas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transcription_ledger ENABLE ROW LEVEL SECURITY;

-- Allow public read access to configuration tables
CREATE POLICY "Allow public read access to app_settings" ON public.app_settings FOR SELECT USING (true);
CREATE POLICY "Allow public read access to entitlements" ON public.entitlements FOR SELECT USING (true);
CREATE POLICY "Allow public read access to quotas" ON public.quotas FOR SELECT USING (true);

-- Secure transcription_ledger
CREATE POLICY "Users can view their own transcription logs" ON public.transcription_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all transcription logs" ON public.transcription_ledger FOR SELECT USING (EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'));
CREATE POLICY "Allow service_role to insert transcription logs" ON public.transcription_ledger FOR INSERT WITH CHECK (true);
