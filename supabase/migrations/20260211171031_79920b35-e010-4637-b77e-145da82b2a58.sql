
-- Workspace role enum
CREATE TYPE public.workspace_role AS ENUM ('owner', 'admin', 'member', 'viewer');

-- Plan tier enum
CREATE TYPE public.plan_tier AS ENUM ('free', 'starter', 'growth', 'scale', 'enterprise');

-- Workspaces (the paying entity)
CREATE TABLE public.workspaces (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan_tier public.plan_tier NOT NULL DEFAULT 'free',
  seats_purchased INTEGER NOT NULL DEFAULT 1,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,
  billing_email TEXT,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Workspace memberships
CREATE TABLE public.workspace_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'member',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);

-- Workspace settings (admin-configurable guardrails)
CREATE TABLE public.workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  viewer_consumes_seat BOOLEAN NOT NULL DEFAULT false,
  daily_credit_cap_per_user INTEGER, -- null = no cap
  max_targets_per_job INTEGER DEFAULT 500,
  max_pages_per_domain INTEGER DEFAULT 50,
  max_provider_calls_per_lead INTEGER DEFAULT 6,
  cache_ttl_days INTEGER NOT NULL DEFAULT 30,
  enable_team_credit_pool BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-user monthly credit balance (resets each billing cycle)
CREATE TABLE public.user_monthly_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  monthly_allowance INTEGER NOT NULL DEFAULT 0,
  credits_used INTEGER NOT NULL DEFAULT 0,
  topup_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, workspace_id, period_start)
);

-- Optional: workspace-wide shared credit pool (for future use)
CREATE TABLE public.workspace_credit_pool (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES public.workspaces(id) ON DELETE CASCADE,
  pool_credits INTEGER NOT NULL DEFAULT 0,
  pool_used INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.workspaces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_memberships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_monthly_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_credit_pool ENABLE ROW LEVEL SECURITY;

-- Helper: check workspace membership
CREATE OR REPLACE FUNCTION public.get_user_workspace_role(_user_id UUID, _workspace_id UUID)
RETURNS public.workspace_role
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.workspace_memberships
  WHERE user_id = _user_id AND workspace_id = _workspace_id
  LIMIT 1
$$;

-- Helper: get user's workspace id
CREATE OR REPLACE FUNCTION public.get_user_workspace_id(_user_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT workspace_id FROM public.workspace_memberships
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- Helper: count seats used
CREATE OR REPLACE FUNCTION public.get_workspace_seats_used(_workspace_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COUNT(*)::INTEGER FROM public.workspace_memberships wm
  WHERE wm.workspace_id = _workspace_id
    AND (
      wm.role != 'viewer'
      OR EXISTS (
        SELECT 1 FROM public.workspace_settings ws
        WHERE ws.workspace_id = _workspace_id AND ws.viewer_consumes_seat = true
      )
    )
$$;

-- RLS: workspaces
CREATE POLICY "Platform admins see all workspaces"
  ON public.workspaces FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins manage all workspaces"
  ON public.workspaces FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view their workspace"
  ON public.workspaces FOR SELECT
  USING (id IN (SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Workspace owners can update their workspace"
  ON public.workspaces FOR UPDATE
  USING (id IN (
    SELECT workspace_id FROM public.workspace_memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

CREATE POLICY "Authenticated users can create workspaces"
  ON public.workspaces FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- RLS: workspace_memberships
CREATE POLICY "Platform admins see all memberships"
  ON public.workspace_memberships FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Platform admins manage all memberships"
  ON public.workspace_memberships FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view workspace members"
  ON public.workspace_memberships FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Workspace owner/admin can manage members"
  ON public.workspace_memberships FOR ALL
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- RLS: workspace_settings
CREATE POLICY "Platform admins manage all settings"
  ON public.workspace_settings FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view their workspace settings"
  ON public.workspace_settings FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Workspace owner/admin can update settings"
  ON public.workspace_settings FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- RLS: user_monthly_credits
CREATE POLICY "Platform admins see all credits"
  ON public.user_monthly_credits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view their own credits"
  ON public.user_monthly_credits FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Workspace owner/admin can view workspace credits"
  ON public.user_monthly_credits FOR SELECT
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- RLS: workspace_credit_pool
CREATE POLICY "Platform admins manage all pools"
  ON public.workspace_credit_pool FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members can view their workspace pool"
  ON public.workspace_credit_pool FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM public.workspace_memberships WHERE user_id = auth.uid()));

CREATE POLICY "Workspace owner/admin can manage pool"
  ON public.workspace_credit_pool FOR UPDATE
  USING (workspace_id IN (
    SELECT workspace_id FROM public.workspace_memberships
    WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
  ));

-- Auto-create workspace_settings when workspace is created
CREATE OR REPLACE FUNCTION public.auto_create_workspace_settings()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_settings (workspace_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_create_workspace_settings
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_create_workspace_settings();

-- Auto-add creator as owner when workspace is created
CREATE OR REPLACE FUNCTION public.auto_add_workspace_owner()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.workspace_memberships (workspace_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'owner');
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_auto_add_workspace_owner
  AFTER INSERT ON public.workspaces
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_add_workspace_owner();
