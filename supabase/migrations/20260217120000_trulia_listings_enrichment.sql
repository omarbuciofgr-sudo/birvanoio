-- Add address_hash and enrichment_status to trulia_listings for BatchData enrichment.
-- BatchData worker uses address_hash to validate listing and sync back owner_name, emails, phones, mailing_address.

ALTER TABLE public.trulia_listings
  ADD COLUMN IF NOT EXISTS address_hash TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT DEFAULT 'never_checked';

CREATE INDEX IF NOT EXISTS idx_trulia_listings_address_hash ON public.trulia_listings (address_hash);

COMMENT ON COLUMN public.trulia_listings.address_hash IS 'Hash of normalized address; used by BatchData worker to link to property_owner_enrichment_state and sync owner data.';
COMMENT ON COLUMN public.trulia_listings.enrichment_status IS 'never_checked | enriched | no_owner_data | failed; set by BatchData worker.';
