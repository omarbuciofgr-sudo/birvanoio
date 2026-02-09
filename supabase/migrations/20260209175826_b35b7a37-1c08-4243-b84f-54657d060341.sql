
-- Create unified credit_usage table for the new credit model
CREATE TABLE public.credit_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  action TEXT NOT NULL, -- 'scrape', 'enrich', 'search', 'lead_score', 'sentiment', 'skip_trace'
  credits_spent INTEGER NOT NULL DEFAULT 1,
  reference_id TEXT, -- optional reference to the item (lead_id, job_id, etc.)
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_credit_usage_user_period ON public.credit_usage (user_id, created_at);
CREATE INDEX idx_credit_usage_action ON public.credit_usage (action);

-- Enable RLS
ALTER TABLE public.credit_usage ENABLE ROW LEVEL SECURITY;

-- Users can only see their own usage
CREATE POLICY "Users can view own credit usage"
  ON public.credit_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit usage"
  ON public.credit_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add one_time_credits column to a credit_balance table for top-ups
CREATE TABLE public.credit_balances (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  bonus_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_balances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credit balance"
  ON public.credit_balances FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credit balance"
  ON public.credit_balances FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own credit balance"
  ON public.credit_balances FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_credit_balances_updated_at
  BEFORE UPDATE ON public.credit_balances
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
