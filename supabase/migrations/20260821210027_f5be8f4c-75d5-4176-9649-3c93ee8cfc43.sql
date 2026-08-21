CREATE TABLE public.realtor_deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  client_email TEXT,
  client_phone TEXT,
  property_address TEXT,
  stage TEXT NOT NULL DEFAULT 'new',
  deal_type TEXT NOT NULL DEFAULT 'sale',
  deal_value NUMERIC DEFAULT 0,
  timeline_date DATE,
  closed_at DATE,
  follow_up_at DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.realtor_deals TO authenticated;
GRANT ALL ON public.realtor_deals TO service_role;

ALTER TABLE public.realtor_deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own realtor deals"
ON public.realtor_deals FOR ALL TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_realtor_deals_user_stage ON public.realtor_deals(user_id, stage);

CREATE TRIGGER update_realtor_deals_updated_at
BEFORE UPDATE ON public.realtor_deals
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();