CREATE TABLE public.signup_welcome_emails (
 user_id uuid PRIMARY KEY,
 status text NOT NULL DEFAULT 'pending',
 provider_id text,
 created_at timestamptz NOT NULL DEFAULT now(),
 sent_at timestamptz
);
GRANT ALL ON public.signup_welcome_emails TO service_role;
ALTER TABLE public.signup_welcome_emails ENABLE ROW LEVEL SECURITY;
CREATE OR REPLACE FUNCTION public.queue_contact_welcome() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public,private AS $$
DECLARE v_token text;
BEGIN
 SELECT token INTO v_token FROM private.job_tokens WHERE name='owner_alerts';
 IF v_token IS NOT NULL THEN
  PERFORM net.http_post(
   url := 'https://eotfijnsfwroukhjwsbe.supabase.co/functions/v1/send-email',
   headers := jsonb_build_object('Content-Type','application/json'),
   body := jsonb_build_object('mode','signup_welcome','user_id',NEW.id,'job_token',v_token)
  );
 END IF;
 RETURN NEW;
EXCEPTION WHEN OTHERS THEN
 RAISE LOG 'Contact welcome could not be queued';
 RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.queue_contact_welcome() FROM PUBLIC,anon,authenticated;
CREATE TRIGGER on_signup_contact_welcome AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.queue_contact_welcome();