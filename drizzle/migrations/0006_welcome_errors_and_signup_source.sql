ALTER TABLE public.signup_welcome_emails ADD COLUMN IF NOT EXISTS error_message text, ADD COLUMN IF NOT EXISTS http_status integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS signup_source jsonb;
CREATE OR REPLACE FUNCTION public.protect_signup_source() RETURNS trigger LANGUAGE plpgsql SET search_path=public AS $$
BEGIN
  IF OLD.signup_source IS NOT NULL AND NEW.signup_source IS DISTINCT FROM OLD.signup_source THEN
    NEW.signup_source := OLD.signup_source;
  END IF;
  RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS protect_signup_source ON public.profiles;
CREATE TRIGGER protect_signup_source BEFORE UPDATE OF signup_source ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.protect_signup_source();