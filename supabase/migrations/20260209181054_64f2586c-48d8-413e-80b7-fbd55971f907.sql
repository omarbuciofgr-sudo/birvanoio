
-- Insert provider configurations for new enrichment providers
INSERT INTO public.enrichment_providers_config (provider, display_name, is_enabled, api_key_secret_name, config)
VALUES 
  ('snovio'::enrichment_provider, 'Snov.io', false, 'SNOVIO_API_KEY', '{"priority": 5, "capabilities": ["email_finder", "email_verification", "domain_search"]}'::jsonb),
  ('rocketreach'::enrichment_provider, 'RocketReach', false, 'ROCKETREACH_API_KEY', '{"priority": 6, "capabilities": ["email_finder", "phone_finder", "linkedin_lookup", "person_enrichment"]}'::jsonb),
  ('lusha'::enrichment_provider, 'Lusha', false, 'LUSHA_API_KEY', '{"priority": 7, "capabilities": ["direct_dial", "email_finder", "person_enrichment"]}'::jsonb),
  ('contactout'::enrichment_provider, 'ContactOut', false, 'CONTACTOUT_API_KEY', '{"priority": 8, "capabilities": ["linkedin_email", "linkedin_phone", "person_search"]}'::jsonb),
  ('google_search'::enrichment_provider, 'Google Search (Firecrawl)', true, 'FIRECRAWL_API_KEY', '{"priority": 9, "capabilities": ["contact_page_scrape", "fallback_search"]}'::jsonb)
ON CONFLICT (provider) DO UPDATE SET display_name = EXCLUDED.display_name, config = EXCLUDED.config, updated_at = now();
