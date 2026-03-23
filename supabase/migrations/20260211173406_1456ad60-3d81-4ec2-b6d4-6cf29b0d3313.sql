
-- Plan-based job limits per subscription tier
CREATE TABLE public.plan_limits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tier TEXT NOT NULL UNIQUE,
  max_targets_per_job INTEGER NOT NULL DEFAULT 50,
  max_pages_per_domain INTEGER NOT NULL DEFAULT 10,
  max_concurrent_jobs INTEGER NOT NULL DEFAULT 2,
  max_provider_calls_per_lead INTEGER NOT NULL DEFAULT 5,
  confidence_stop_threshold NUMERIC(3,2) NOT NULL DEFAULT 0.85,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.plan_limits ENABLE ROW LEVEL SECURITY;

-- Only admins can manage plan limits
CREATE POLICY "Admins can manage plan limits"
  ON public.plan_limits FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Anyone authenticated can read (for frontend enforcement)
CREATE POLICY "Authenticated users can read plan limits"
  ON public.plan_limits FOR SELECT
  USING (auth.uid() IS NOT NULL);

-- Seed default limits per tier
INSERT INTO public.plan_limits (tier, max_targets_per_job, max_pages_per_domain, max_concurrent_jobs, max_provider_calls_per_lead, confidence_stop_threshold) VALUES
  ('free', 10, 3, 1, 2, 0.80),
  ('starter', 50, 10, 2, 4, 0.85),
  ('growth', 200, 20, 5, 6, 0.85),
  ('scale', 1000, 50, 10, 8, 0.90),
  ('enterprise', 10000, 100, 50, 20, 0.95);

-- Spend alerts table for abnormal spending patterns
CREATE TABLE public.spend_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  workspace_id UUID REFERENCES public.workspaces(id),
  alert_type TEXT NOT NULL, -- 'high_hourly_spend', 'budget_exceeded', 'unusual_pattern', 'concurrent_limit'
  severity TEXT NOT NULL DEFAULT 'warning', -- 'info', 'warning', 'critical'
  message TEXT NOT NULL,
  metadata JSONB,
  is_acknowledged BOOLEAN NOT NULL DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spend_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view all spend alerts"
  ON public.spend_alerts FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can view own spend alerts"
  ON public.spend_alerts FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can insert spend alerts"
  ON public.spend_alerts FOR INSERT
  WITH CHECK (false);

CREATE POLICY "Admins can update spend alerts"
  ON public.spend_alerts FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_spend_alerts_user ON public.spend_alerts (user_id, created_at DESC);
CREATE INDEX idx_spend_alerts_unacked ON public.spend_alerts (is_acknowledged) WHERE NOT is_acknowledged;

-- Add estimated_credits column to scrape_jobs for pre-run estimates
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS estimated_credits INTEGER;
