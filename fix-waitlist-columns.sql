-- Manual fix for waitlist table columns
-- Run this directly in Supabase SQL Editor if migrations didn't work

-- Add columns if they don't exist
DO $$
BEGIN
    -- Add invited_to_beta column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'waitlist'
        AND column_name = 'invited_to_beta'
    ) THEN
        ALTER TABLE public.waitlist ADD COLUMN invited_to_beta BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add invited_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'waitlist'
        AND column_name = 'invited_at'
    ) THEN
        ALTER TABLE public.waitlist ADD COLUMN invited_at TIMESTAMPTZ;
    END IF;

    -- Add converted_to_beta column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'waitlist'
        AND column_name = 'converted_to_beta'
    ) THEN
        ALTER TABLE public.waitlist ADD COLUMN converted_to_beta BOOLEAN DEFAULT FALSE;
    END IF;

    -- Add converted_at column
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'waitlist'
        AND column_name = 'converted_at'
    ) THEN
        ALTER TABLE public.waitlist ADD COLUMN converted_at TIMESTAMPTZ;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_waitlist_email_invited
ON public.waitlist(email, invited_to_beta);

CREATE INDEX IF NOT EXISTS idx_waitlist_invited_to_beta
ON public.waitlist(invited_to_beta)
WHERE invited_to_beta = true;

-- Add comments
COMMENT ON COLUMN public.waitlist.invited_to_beta IS 'Indicates if beta invitation email has been sent';
COMMENT ON COLUMN public.waitlist.invited_at IS 'Timestamp when beta invitation was sent';
COMMENT ON COLUMN public.waitlist.converted_to_beta IS 'Indicates if user has logged in and been converted to beta role';
COMMENT ON COLUMN public.waitlist.converted_at IS 'Timestamp when user was converted to beta role';

-- Update RLS policies for admin access
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

-- Verify the columns were added
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'waitlist'
ORDER BY ordinal_position;
