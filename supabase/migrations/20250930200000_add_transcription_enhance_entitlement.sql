-- Add transcription enhancement entitlement and quota to all roles
-- This migration adds the new allow_ai_action:transcription_enhance entitlement
-- and daily_ai_action:transcription_enhance_calls quota

-- Add entitlement to all roles
UPDATE public.entitlements
SET config = config || '{"allow_ai_action:transcription_enhance": true}'
WHERE role IN ('pro', 'beta', 'admin');

-- Keep free tier without transcription enhancement
UPDATE public.entitlements
SET config = config || '{"allow_ai_action:transcription_enhance": false}'
WHERE role = 'free';

-- Add quota for transcription enhancement calls (unlimited for beta/admin, limited for pro)
INSERT INTO public.quotas (role, metric, "limit") VALUES
('pro', 'daily_ai_action:transcription_enhance_calls', 200),
('beta', 'daily_ai_action:transcription_enhance_calls', -1),
('admin', 'daily_ai_action:transcription_enhance_calls', -1);