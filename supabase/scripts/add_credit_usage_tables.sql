-- Paste into Supabase Dashboard → SQL → New query (Brivano.io project)
-- Creates credit_usage + credit_balances (fixes 404 + "Failed to charge credits" on Enrich)

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TABLE IF NOT EXISTS public.credit_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL,
  credits_spent INTEGER NOT NULL DEFAULT 1,
  reference_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_credit_usage_user_period ON public.credit_usage (user_id, created_at);
CREATE INDEX IF NOT EXISTS idx_credit_usage_action ON public.credit_usage (action);

ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit usage" ON public.credit_usage;
CREATE POLICY "Users can view own credit usage"
  ON public.credit_usage FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own credit usage" ON public.credit_usage;
CREATE POLICY "Users can insert own credit usage"
  ON public.credit_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.credit_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own credit balance" ON public.credit_balances;
CREATE POLICY "Users can view own credit balance"
  ON public.credit_balances FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own credit balance" ON public.credit_balances;
CREATE POLICY "Users can insert own credit balance"
  ON public.credit_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own credit balance" ON public.credit_balances;
CREATE POLICY "Users can update own credit balance"
  ON public.credit_balances FOR UPDATE
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_credit_balances_updated_at ON public.credit_balances;
CREATE TRIGGER update_credit_balances_updated_at
  BEFORE UPDATE ON public.credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
