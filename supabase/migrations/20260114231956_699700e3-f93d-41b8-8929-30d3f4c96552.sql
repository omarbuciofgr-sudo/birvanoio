-- Fix the security definer view issue by setting SECURITY INVOKER
-- This ensures the view respects the permissions of the querying user

DROP VIEW IF EXISTS public.client_api_keys_safe;

CREATE VIEW public.client_api_keys_safe
WITH (security_invoker = true)
AS 
SELECT 
  id,
  organization_id,
  key_name,
  api_key_prefix,
  permissions,
  rate_limit_per_minute,
  is_active,
  last_used_at,
  created_at,
  expires_at,
  created_by
FROM public.client_api_keys;

-- Re-grant access to the view for authenticated users
GRANT SELECT ON public.client_api_keys_safe TO authenticated;

-- Add RLS policy on the view that allows clients to see their org's API keys
-- The view already enforces column-level security by excluding api_key_hash
CREATE POLICY "Clients can view their org API keys via safe view"
ON public.client_api_keys
FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id FROM public.client_users WHERE user_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin')
);

-- Drop the admin-only policy since we now have a combined policy
DROP POLICY IF EXISTS "Only admins can access base API keys table" ON public.client_api_keys;