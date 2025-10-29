-- supabase/migrations/20251028120000_add_beta_invitation_tracking.sql
-- Add beta invitation tracking fields to waitlist table

-- 1. Add new columns to track invitation and conversion status
ALTER TABLE public.waitlist
ADD COLUMN IF NOT EXISTS invited_to_beta BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_to_beta BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ;

-- 2. Create index for faster lookups on email and invitation status
CREATE INDEX IF NOT EXISTS idx_waitlist_email_invited
ON public.waitlist(email, invited_to_beta);

CREATE INDEX IF NOT EXISTS idx_waitlist_invited_to_beta
ON public.waitlist(invited_to_beta)
WHERE invited_to_beta = true;

-- 3. Add comment for documentation
COMMENT ON COLUMN public.waitlist.invited_to_beta IS 'Indicates if beta invitation email has been sent';
COMMENT ON COLUMN public.waitlist.invited_at IS 'Timestamp when beta invitation was sent';
COMMENT ON COLUMN public.waitlist.converted_to_beta IS 'Indicates if user has logged in and been converted to beta role';
COMMENT ON COLUMN public.waitlist.converted_at IS 'Timestamp when user was converted to beta role';

-- 4. Update RLS policies for admin access
DROP POLICY IF EXISTS "Admins can view all waitlist entries" ON public.waitlist;
DROP POLICY IF EXISTS "Admins can update waitlist entries" ON public.waitlist;

CREATE POLICY "Admins can view all waitlist entries"
ON public.waitlist FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

CREATE POLICY "Admins can update waitlist entries"
ON public.waitlist FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);
