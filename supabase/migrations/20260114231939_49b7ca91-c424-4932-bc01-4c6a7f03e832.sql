-- Create a secure view for client_api_keys that excludes the api_key_hash column
-- This prevents clients from accessing the hash even if they bypass TypeScript interfaces

CREATE VIEW public.client_api_keys_safe AS 
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

-- Grant access to the view for authenticated users
GRANT SELECT ON public.client_api_keys_safe TO authenticated;

-- Drop the existing permissive SELECT policy that exposes all columns
DROP POLICY IF EXISTS "Clients can view their API keys" ON public.client_api_keys;

-- Create a more restrictive policy that only allows admins to SELECT from the base table
-- Clients should use the view instead
CREATE POLICY "Only admins can access base API keys table"
ON public.client_api_keys
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));