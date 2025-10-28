-- Add deep-response action entitlements and quotas for all roles
-- This action is used for manual "Deep Response" triggers from the Actions Panel
-- Auto-triggered responses continue using recommend-response action

-- Add entitlement to all roles that have recommend-response access
-- Free tier: disabled (consistent with other AI actions)
-- Pro/Beta/Admin: enabled
UPDATE public.entitlements
SET config = config || '{"allow_ai_action:deep-response": false}'
WHERE role = 'free';

UPDATE public.entitlements
SET config = config || '{"allow_ai_action:deep-response": true}'
WHERE role IN ('pro', 'beta', 'admin');

-- Add quotas for roles that have the entitlement
-- Pro: 100 calls per day (same as recommend-response)
-- Beta/Admin: unlimited (-1)
INSERT INTO public.quotas (role, metric, "limit") VALUES
('pro', 'daily_ai_action:deep-response_calls', 100),
('beta', 'daily_ai_action:deep-response_calls', -1),
('admin', 'daily_ai_action:deep-response_calls', -1);
