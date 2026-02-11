
-- Create provider pricing configuration table
CREATE TABLE IF NOT EXISTS public.provider_pricing_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  provider_name TEXT NOT NULL,
  api_name TEXT NOT NULL,
  unit_cost_cents INTEGER NOT NULL DEFAULT 0,
  unit_type TEXT NOT NULL DEFAULT 'per_call',
  is_active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT unique_provider_name UNIQUE (provider_name)
);

-- Create credit event configuration table
CREATE TABLE IF NOT EXISTS public.credit_event_config (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  event_name TEXT NOT NULL,
  base_credits INTEGER NOT NULL DEFAULT 1,
  description TEXT,
  providers_involved TEXT[] DEFAULT '{}',
  avg_calls_per_lead NUMERIC NOT NULL DEFAULT 1.0,
  confidence_threshold NUMERIC NOT NULL DEFAULT 70.0,
  success_rate NUMERIC NOT NULL DEFAULT 100.0,
  max_provider_calls INTEGER NOT NULL DEFAULT 3,
  cache_ttl_hours INTEGER NOT NULL DEFAULT 720,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID,
  updated_by UUID,
  CONSTRAINT unique_event_type UNIQUE (event_type)
);

-- Create credit cost analysis table (materialized view source)
CREATE TABLE IF NOT EXISTS public.credit_cost_analysis (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL,
  calculated_cost_cents NUMERIC NOT NULL,
  cogs_cost_cents NUMERIC NOT NULL,
  sell_price_cents NUMERIC NOT NULL,
  margin_percent NUMERIC NOT NULL,
  scenario TEXT NOT NULL DEFAULT 'expected',
  calculated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT unique_event_scenario UNIQUE (event_type, scenario)
);

-- Enable RLS
ALTER TABLE public.provider_pricing_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_event_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_cost_analysis ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for admin-only access
CREATE POLICY "Admins can manage provider pricing" 
  ON public.provider_pricing_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can manage credit event config" 
  ON public.credit_event_config
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can view cost analysis" 
  ON public.credit_cost_analysis
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Insert default provider pricing data
INSERT INTO public.provider_pricing_config (provider_name, api_name, unit_cost_cents, unit_type, notes) 
VALUES
  ('Firecrawl', 'firecrawl', 0, 'per_page', 'Web scraping - $0.002-$0.004 per page'),
  ('BatchData', 'batchdata', 15, 'per_record', 'Skip trace - $0.10-$0.15 per record'),
  ('Apollo', 'apollo', 5, 'per_call', 'Person enrichment - $0.03-$0.08'),
  ('People Data Labs', 'pdl', 8, 'per_call', 'Person enrichment - $0.05-$0.10'),
  ('Lusha', 'lusha', 4, 'per_call', 'Person enrichment - $0.04-$0.06'),
  ('RocketReach', 'rocketreach', 6, 'per_call', 'Person enrichment - $0.05-$0.08'),
  ('Hunter.io', 'hunter', 3, 'per_call', 'Email discovery - $0.02-$0.05'),
  ('ZeroBounce', 'zerobounce', 1, 'per_call', 'Email verification - $0.01-$0.02'),
  ('Twilio Lookup', 'twilio', 2, 'per_call', 'Phone lookup - $0.01-$0.03'),
  ('Clay', 'clay', 0, 'per_call', 'Orchestration - included in provider calls')
ON CONFLICT (provider_name) DO NOTHING;

-- Insert default credit event configurations
INSERT INTO public.credit_event_config 
  (event_type, event_name, base_credits, description, providers_involved, avg_calls_per_lead, success_rate, max_provider_calls, is_active)
VALUES
  ('website_scrape', 'Website Crawl/Scrape', 1, 'Per page or domain scrape via Firecrawl', ARRAY['Firecrawl'], 1.0, 85.0, 1, true),
  ('person_enrichment', 'Person Enrichment', 2, 'Waterfall: Apollo → PDL → Lusha → RocketReach → Hunter', ARRAY['Apollo', 'PDL', 'Lusha', 'RocketReach', 'Hunter'], 2.5, 95.0, 4, true),
  ('company_enrichment', 'Company/Domain Enrichment', 2, 'Company data lookup', ARRAY['Clay', 'Apollo'], 1.5, 90.0, 2, true),
  ('email_discovery', 'Email Discovery', 1, 'Find email address', ARRAY['Hunter'], 1.0, 75.0, 1, true),
  ('email_verification', 'Email Verification', 1, 'Verify email deliverability', ARRAY['ZeroBounce'], 1.0, 95.0, 1, true),
  ('phone_lookup', 'Phone Lookup', 1, 'Phone number validation and type detection', ARRAY['Twilio'], 1.0, 90.0, 1, true),
  ('skip_trace', 'Skip Trace', 5, 'Full address validation and appending', ARRAY['BatchData'], 1.0, 80.0, 1, true),
  ('ai_scoring', 'AI Lead Scoring', 1, 'AI-based lead quality scoring', ARRAY[]::TEXT[], 1.0, 100.0, 1, true),
  ('sentiment_analysis', 'Sentiment Analysis', 1, 'AI sentiment detection from conversation', ARRAY[]::TEXT[], 1.0, 100.0, 1, true)
ON CONFLICT (event_type) DO NOTHING;
