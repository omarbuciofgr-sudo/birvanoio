CREATE TABLE public.contact_suppression (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  value_type text NOT NULL CHECK (value_type IN ('phone','email')),
  value_normalized text NOT NULL,
  reason text,
  source text NOT NULL DEFAULT 'manual',
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, value_type, value_normalized)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contact_suppression TO authenticated;
GRANT ALL ON public.contact_suppression TO service_role;
ALTER TABLE public.contact_suppression ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace suppression list"
ON public.contact_suppression FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.workspace_id = contact_suppression.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Members can add suppression entries"
ON public.contact_suppression FOR INSERT TO authenticated
WITH CHECK (added_by = auth.uid() AND EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.workspace_id = contact_suppression.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Owners and admins can remove suppression entries"
ON public.contact_suppression FOR DELETE TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.workspace_id = contact_suppression.workspace_id AND wm.user_id = auth.uid() AND wm.role IN ('owner','admin')));

CREATE TABLE public.contact_touches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  value_type text NOT NULL CHECK (value_type IN ('phone','email')),
  value_normalized text NOT NULL,
  channel text NOT NULL DEFAULT 'call',
  contact_name text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_contact_touches_lookup ON public.contact_touches (workspace_id, value_type, value_normalized, created_at DESC);

GRANT SELECT, INSERT ON public.contact_touches TO authenticated;
GRANT ALL ON public.contact_touches TO service_role;
ALTER TABLE public.contact_touches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view workspace touches"
ON public.contact_touches FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.workspace_id = contact_touches.workspace_id AND wm.user_id = auth.uid()));

CREATE POLICY "Members can log their own touches"
ON public.contact_touches FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid() AND EXISTS (SELECT 1 FROM public.workspace_memberships wm WHERE wm.workspace_id = contact_touches.workspace_id AND wm.user_id = auth.uid()));