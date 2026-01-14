-- Insert PDL provider configuration
INSERT INTO public.enrichment_providers_config (provider, display_name, is_enabled, api_key_secret_name, config)
VALUES ('pdl'::enrichment_provider, 'People Data Labs', true, 'PDL_API_KEY', '{"priority": 2, "capabilities": ["person_enrichment", "company_enrichment", "contact_discovery"]}'::jsonb)
ON CONFLICT (provider) DO UPDATE SET is_enabled = true, updated_at = now();