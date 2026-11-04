REVOKE ALL ON public.owner_contact_lookups FROM anon, authenticated;
GRANT SELECT ON public.owner_contact_lookups TO authenticated;
GRANT ALL ON public.owner_contact_lookups TO service_role;
REVOKE ALL ON public.signup_welcome_emails FROM anon, authenticated;
GRANT ALL ON public.signup_welcome_emails TO service_role;