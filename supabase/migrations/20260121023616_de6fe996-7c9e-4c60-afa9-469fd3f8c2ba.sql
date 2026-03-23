-- Add RLS policies to client_api_keys_safe view
-- Views inherit RLS from underlying tables, but we should add explicit policies

-- Enable RLS on the views (they may be views, so we'll create policies on the underlying tables if needed)

-- For client_api_keys_safe: This is a view that should show keys to org members
-- The underlying table client_api_keys already has RLS, but let's ensure the view respects it

-- Create a security definer function to safely get org keys
CREATE OR REPLACE FUNCTION public.get_organization_api_keys(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  key_name text,
  api_key_prefix text,
  organization_id uuid,
  is_active boolean,
  expires_at timestamptz,
  created_at timestamptz,
  created_by uuid,
  last_used_at timestamptz,
  rate_limit_per_minute integer,
  permissions jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is a member of this organization or an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.client_users cu 
    WHERE cu.user_id = auth.uid() 
    AND cu.organization_id = p_organization_id
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY 
  SELECT 
    ak.id,
    ak.key_name,
    ak.api_key_prefix,
    ak.organization_id,
    ak.is_active,
    ak.expires_at,
    ak.created_at,
    ak.created_by,
    ak.last_used_at,
    ak.rate_limit_per_minute,
    ak.permissions
  FROM public.client_api_keys ak
  WHERE ak.organization_id = p_organization_id;
END;
$$;

-- Create a security definer function to safely get org webhooks (without secret_hash)
CREATE OR REPLACE FUNCTION public.get_organization_webhooks(p_organization_id uuid)
RETURNS TABLE (
  id uuid,
  name text,
  webhook_url text,
  organization_id uuid,
  is_active boolean,
  events jsonb,
  created_at timestamptz,
  created_by uuid,
  last_triggered_at timestamptz,
  failure_count integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify the caller is a member of this organization or an admin
  IF NOT EXISTS (
    SELECT 1 FROM public.client_users cu 
    WHERE cu.user_id = auth.uid() 
    AND cu.organization_id = p_organization_id
  ) AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Access denied';
  END IF;
  
  RETURN QUERY 
  SELECT 
    wh.id,
    wh.name,
    wh.webhook_url,
    wh.organization_id,
    wh.is_active,
    wh.events,
    wh.created_at,
    wh.created_by,
    wh.last_triggered_at,
    wh.failure_count
  FROM public.client_webhooks wh
  WHERE wh.organization_id = p_organization_id;
END;
$$;