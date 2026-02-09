
-- Create enrichment credit usage tracking table
CREATE TABLE public.enrichment_credit_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  credits_used INTEGER NOT NULL DEFAULT 0,
  one_time_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start)
);

-- Enable RLS
ALTER TABLE public.enrichment_credit_usage ENABLE ROW LEVEL SECURITY;

-- Users can read their own usage
CREATE POLICY "Users can view their own credit usage"
  ON public.enrichment_credit_usage FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own usage
CREATE POLICY "Users can insert their own credit usage"
  ON public.enrichment_credit_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own usage
CREATE POLICY "Users can update their own credit usage"
  ON public.enrichment_credit_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_enrichment_credit_usage_updated_at
  BEFORE UPDATE ON public.enrichment_credit_usage
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
