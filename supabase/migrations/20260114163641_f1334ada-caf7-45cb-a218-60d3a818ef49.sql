-- Create scraper monitoring stats table
CREATE TABLE IF NOT EXISTS public.scraper_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  recorded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  jobs_completed INTEGER DEFAULT 0,
  jobs_failed INTEGER DEFAULT 0,
  targets_processed INTEGER DEFAULT 0,
  targets_success INTEGER DEFAULT 0,
  targets_failed INTEGER DEFAULT 0,
  avg_processing_time_ms INTEGER DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Create domain cache table for storing recently scraped domains
CREATE TABLE IF NOT EXISTS public.domain_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  last_scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  cache_expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  scraped_pages_count INTEGER DEFAULT 0,
  lead_id UUID REFERENCES public.scraped_leads(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create blocked domains table for tracking blocked/rate-limited domains
CREATE TABLE IF NOT EXISTS public.blocked_domains (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  domain TEXT NOT NULL UNIQUE,
  blocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  block_reason TEXT,
  http_status INTEGER,
  retry_after TIMESTAMP WITH TIME ZONE,
  block_count INTEGER DEFAULT 1,
  last_attempt_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create scraper concurrency control table
CREATE TABLE IF NOT EXISTS public.scraper_locks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lock_type TEXT NOT NULL, -- 'global' or 'domain'
  lock_key TEXT NOT NULL UNIQUE, -- 'global' or domain name
  locked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  locked_by TEXT, -- job_id or worker_id
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_domain_cache_domain ON public.domain_cache(domain);
CREATE INDEX IF NOT EXISTS idx_domain_cache_expires ON public.domain_cache(cache_expires_at);
CREATE INDEX IF NOT EXISTS idx_blocked_domains_domain ON public.blocked_domains(domain);
CREATE INDEX IF NOT EXISTS idx_blocked_domains_retry ON public.blocked_domains(retry_after);
CREATE INDEX IF NOT EXISTS idx_scraper_locks_key ON public.scraper_locks(lock_key);
CREATE INDEX IF NOT EXISTS idx_scraper_locks_expires ON public.scraper_locks(expires_at);
CREATE INDEX IF NOT EXISTS idx_scraper_stats_period ON public.scraper_stats(period_start, period_end);

-- Add checkpoint column to scrape_jobs for resumable processing
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS checkpoint_index INTEGER DEFAULT 0;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS last_checkpoint_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE public.scrape_jobs ADD COLUMN IF NOT EXISTS batch_size INTEGER DEFAULT 100;

-- Enable RLS
ALTER TABLE public.scraper_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.domain_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_domains ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scraper_locks ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for monitoring tables
CREATE POLICY "Admins can manage scraper_stats" ON public.scraper_stats
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage domain_cache" ON public.domain_cache
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage blocked_domains" ON public.blocked_domains
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage scraper_locks" ON public.scraper_locks
  FOR ALL USING (public.has_role(auth.uid(), 'admin'));

-- Service role bypass for edge functions
CREATE POLICY "Service role bypass scraper_stats" ON public.scraper_stats
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role bypass domain_cache" ON public.domain_cache
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role bypass blocked_domains" ON public.blocked_domains
  FOR ALL USING (auth.role() = 'service_role');

CREATE POLICY "Service role bypass scraper_locks" ON public.scraper_locks
  FOR ALL USING (auth.role() = 'service_role');