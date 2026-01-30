-- Create table to track user search credits
CREATE TABLE public.search_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  free_searches_used INTEGER NOT NULL DEFAULT 0,
  purchased_credits INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_user_credits UNIQUE (user_id)
);

-- Enable RLS
ALTER TABLE public.search_credits ENABLE ROW LEVEL SECURITY;

-- Users can only view/update their own credits
CREATE POLICY "Users can view their own credits"
ON public.search_credits
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own credits"
ON public.search_credits
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own credits"
ON public.search_credits
FOR UPDATE
USING (auth.uid() = user_id);

-- Create table to track credit purchase history
CREATE TABLE public.credit_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  stripe_session_id TEXT,
  credits_purchased INTEGER NOT NULL,
  amount_paid_cents INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.credit_purchases ENABLE ROW LEVEL SECURITY;

-- Users can only view their own purchases
CREATE POLICY "Users can view their own purchases"
ON public.credit_purchases
FOR SELECT
USING (auth.uid() = user_id);

-- Create trigger to update updated_at
CREATE TRIGGER update_search_credits_updated_at
BEFORE UPDATE ON public.search_credits
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();