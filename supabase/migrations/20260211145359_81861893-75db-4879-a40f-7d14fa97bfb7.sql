-- Fix: ensure the client_api_keys_safe view does NOT bypass RLS on client_api_keys
-- Recreate it with security_invoker so underlying table RLS policies are enforced.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_views
    WHERE schemaname = 'public'
      AND viewname = 'client_api_keys_safe'
  ) THEN
    EXECUTE 'CREATE OR REPLACE VIEW public.client_api_keys_safe WITH (security_invoker = true) AS
      SELECT
        id,
        organization_id,
        key_name,
        api_key_prefix,
        is_active,
        rate_limit_per_minute,
        permissions,
        expires_at,
        created_at,
        last_used_at,
        created_by
      FROM public.client_api_keys;';
  END IF;
END $$;

-- Ensure anonymous clients cannot read the view even if grants exist
REVOKE ALL ON public.client_api_keys_safe FROM anon;
REVOKE ALL ON public.client_api_keys_safe FROM public;

-- Keep authenticated access explicit (RLS on underlying table will still block non-admins)
GRANT SELECT ON public.client_api_keys_safe TO authenticated;