-- Drop the existing view first to recreate with correct columns
DROP VIEW IF EXISTS public.client_api_keys_safe;

-- Create the safe view that excludes api_key_hash
CREATE VIEW public.client_api_keys_safe
WITH (security_invoker = true)
AS SELECT 
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
FROM public.client_api_keys;

-- Grant SELECT on the safe view to authenticated users
GRANT SELECT ON public.client_api_keys_safe TO authenticated;