DROP POLICY IF EXISTS "Authenticated users can read plan limits" ON public.plan_limits;
CREATE POLICY "Users can read their own plan limits" ON public.plan_limits
FOR SELECT TO authenticated
USING (
  tier::text = COALESCE(
    (SELECT w.plan_tier::text FROM public.workspaces w WHERE w.id = public.get_user_workspace_id(auth.uid())),
    'free'
  )
);

DROP POLICY IF EXISTS "Signed-in users can read map positions" ON public.geocode_cache;

DROP POLICY IF EXISTS "Anyone can submit contact form" ON public.contact_submissions;