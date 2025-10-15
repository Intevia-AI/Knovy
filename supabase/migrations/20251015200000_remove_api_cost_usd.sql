-- Remove api_cost_usd Column from feature_usage
-- Created: 2025-10-15
-- Rationale: Simplify analytics by removing cost tracking complexity.
--            Focus on usage patterns rather than API costs.
--            Can always add back if needed for billing in the future.

BEGIN;

-- Drop the api_cost_usd column
ALTER TABLE public.feature_usage
  DROP COLUMN IF EXISTS api_cost_usd;

-- Add comment to document the change
COMMENT ON TABLE public.feature_usage IS 'Tracks individual feature usage events. Cost tracking removed to simplify analytics.';

COMMIT;

-- Migration Summary:
-- - Removed api_cost_usd column from feature_usage table
-- - Simplified analytics schema to focus on usage patterns
