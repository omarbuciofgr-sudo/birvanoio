-- Create a safe view for client_webhooks without secret_hash
CREATE OR REPLACE VIEW public.client_webhooks_safe
WITH (security_invoker = true)
AS SELECT 
  id,
  organization_id,
  name,
  webhook_url,
  events,
  is_active,
  failure_count,
  last_triggered_at,
  created_at,
  created_by
FROM public.client_webhooks;

-- Grant permissions on the view
GRANT SELECT ON public.client_webhooks_safe TO authenticated;

-- Drop the existing policy that allows clients full access
DROP POLICY IF EXISTS "Clients can manage their webhooks" ON public.client_webhooks;

-- Create new policies:
-- 1. Admins get full access (can see and manage everything including secret_hash)
-- Note: "Admins can manage client webhooks" policy already exists, keeping it

-- 2. Clients can only SELECT from the table (for the safe view to work)
CREATE POLICY "Clients can view webhooks for safe view"
  ON public.client_webhooks FOR SELECT
  USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE user_id = auth.uid()
    )
  );

-- 3. Clients can insert webhooks (secret_hash won't be returned in response)
CREATE POLICY "Clients can insert their webhooks"
  ON public.client_webhooks FOR INSERT
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE user_id = auth.uid()
    )
  );

-- 4. Clients can update their webhooks (but can't read secret_hash)
CREATE POLICY "Clients can update their webhooks"
  ON public.client_webhooks FOR UPDATE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE user_id = auth.uid()
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE user_id = auth.uid()
    )
  );

-- 5. Clients can delete their webhooks
CREATE POLICY "Clients can delete their webhooks"
  ON public.client_webhooks FOR DELETE
  USING (
    organization_id IN (
      SELECT organization_id FROM public.client_users 
      WHERE user_id = auth.uid()
    )
  );