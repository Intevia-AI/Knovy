-- supabase/migrations/20251028130000_enhance_auto_beta_conversion.sql
-- Enhance user creation trigger to auto-convert waitlist users to beta

-- Replace the existing handle_new_user function with enhanced version
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  v_email TEXT;
  v_waitlist_record RECORD;
BEGIN
  -- Get user email from the new auth.users record
  v_email := NEW.email;

  -- Check if email exists in waitlist and has been invited to beta
  SELECT
    id,
    email,
    invited_to_beta,
    converted_to_beta
  INTO v_waitlist_record
  FROM public.waitlist
  WHERE email = v_email
    AND invited_to_beta = true
    AND converted_to_beta = false;

  -- If user is on invited waitlist and not yet converted
  IF FOUND THEN
    -- Create profile with beta role
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'beta');

    -- Mark as converted in waitlist table
    UPDATE public.waitlist
    SET
      converted_to_beta = true,
      converted_at = NOW()
    WHERE email = v_email;

    -- Log the conversion for audit trail
    RAISE NOTICE 'Auto-converted user % to beta role from waitlist', v_email;
  ELSE
    -- Regular user or already converted, create with default free role
    INSERT INTO public.profiles (id, role)
    VALUES (NEW.id, 'free');
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Ensure trigger is properly attached (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- Add comment for documentation
COMMENT ON FUNCTION public.handle_new_user() IS 'Auto-creates user profile with beta role if email is in invited waitlist, otherwise creates with free role';
