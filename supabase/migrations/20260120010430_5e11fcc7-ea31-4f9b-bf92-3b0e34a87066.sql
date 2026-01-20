-- Add RLS policy to allow client users to view their own organization
CREATE POLICY "Clients can view their own organization"
ON public.client_organizations
FOR SELECT
USING (
  id IN (
    SELECT organization_id 
    FROM client_users 
    WHERE user_id = auth.uid()
  )
  OR has_role(auth.uid(), 'admin'::app_role)
);