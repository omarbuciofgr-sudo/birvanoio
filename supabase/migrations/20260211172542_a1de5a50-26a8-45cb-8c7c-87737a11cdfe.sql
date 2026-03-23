
-- Add billing_status to workspaces
CREATE TYPE public.billing_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete');

ALTER TABLE public.workspaces 
  ADD COLUMN billing_status public.billing_status NOT NULL DEFAULT 'active';

-- Credits ledger for tracking all credit events (allocations, spend, adjustments)
CREATE TABLE public.credits_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL, -- 'monthly_allocation', 'spend', 'topup', 'adjustment', 'proration'
  credits INTEGER NOT NULL, -- positive = grant, negative = spend
  balance_after INTEGER, -- running balance snapshot (optional)
  description TEXT,
  reference_id TEXT, -- e.g. invoice ID, action ID
  period_start DATE,
  period_end DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credits_ledger ENABLE ROW LEVEL SECURITY;

-- Users can read their own ledger entries
CREATE POLICY "Users can view own credit ledger"
  ON public.credits_ledger FOR SELECT
  USING (auth.uid() = user_id);

-- Workspace owners/admins can view all workspace entries
CREATE POLICY "Workspace admins can view workspace ledger"
  ON public.credits_ledger FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspace_memberships wm
      WHERE wm.workspace_id = credits_ledger.workspace_id
        AND wm.user_id = auth.uid()
        AND wm.role IN ('owner', 'admin')
    )
  );

-- Only service role inserts (from edge functions)
CREATE POLICY "Service role insert credits_ledger"
  ON public.credits_ledger FOR INSERT
  WITH CHECK (false); -- blocked for anon/authenticated, service_role bypasses RLS

-- Index for efficient lookups
CREATE INDEX idx_credits_ledger_user_workspace ON public.credits_ledger (user_id, workspace_id, created_at DESC);
CREATE INDEX idx_credits_ledger_event_type ON public.credits_ledger (event_type, workspace_id);
CREATE INDEX idx_workspaces_billing_status ON public.workspaces (billing_status);
