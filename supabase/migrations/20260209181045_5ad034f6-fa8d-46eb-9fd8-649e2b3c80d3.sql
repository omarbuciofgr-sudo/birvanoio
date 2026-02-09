
-- Add new enrichment provider enum values
ALTER TYPE public.enrichment_provider ADD VALUE IF NOT EXISTS 'snovio';
ALTER TYPE public.enrichment_provider ADD VALUE IF NOT EXISTS 'rocketreach';
ALTER TYPE public.enrichment_provider ADD VALUE IF NOT EXISTS 'lusha';
ALTER TYPE public.enrichment_provider ADD VALUE IF NOT EXISTS 'contactout';
ALTER TYPE public.enrichment_provider ADD VALUE IF NOT EXISTS 'google_search';
