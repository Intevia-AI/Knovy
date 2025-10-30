-- Update beta user transcription quota from unlimited to 120 minutes per day
-- This aligns with the new policy to limit beta users to 120 minutes of transcription daily

UPDATE public.quotas
SET "limit" = 120
WHERE role = 'beta' AND metric = 'daily_transcription_minutes';
