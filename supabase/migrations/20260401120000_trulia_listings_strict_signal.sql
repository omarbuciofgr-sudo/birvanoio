-- Persist Trulia SERP/HDP owner vs managed signal for /last-result and Scout by-owner vs Include PM.
ALTER TABLE public.trulia_listings
  ADD COLUMN IF NOT EXISTS trulia_strict_signal TEXT;

COMMENT ON COLUMN public.trulia_listings.trulia_strict_signal IS 'owner | managed | unknown — from Trulia JSON flags; drives PM filtering when include_pm=0.';
