-- Add transcription enhancement entitlement to all roles
-- Enhancement is controlled by session time limits rather than separate quotas
-- All users (free, pro, beta, admin) can use enhancement during active sessions

-- Add entitlement to all roles
UPDATE public.entitlements
SET config = config || '{"allow_ai_action:transcription_enhance": true}'
WHERE role IN ('pro', 'beta', 'admin', 'free');