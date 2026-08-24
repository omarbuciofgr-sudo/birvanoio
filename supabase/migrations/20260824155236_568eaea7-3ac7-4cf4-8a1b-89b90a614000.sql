REVOKE ALL ON TABLE public.client_webhooks FROM anon;
REVOKE SELECT (secret_hash), INSERT (secret_hash), UPDATE (secret_hash), REFERENCES (secret_hash) ON public.client_webhooks FROM authenticated;
GRANT ALL ON public.client_webhooks TO service_role;