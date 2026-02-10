-- Restrict schema templates to only admin users instead of all authenticated users
DROP POLICY IF EXISTS "Clients can view schema templates" ON public.schema_templates;

CREATE POLICY "Only admins can view schema templates"
ON public.schema_templates
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
