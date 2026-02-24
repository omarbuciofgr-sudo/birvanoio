-- Backfill zillow_fsbo_listings.address from detail_url for rows where address is empty.
-- Zillow URLs: .../homedetails/623-Russell-Ave-N-Minneapolis-MN-55411/1887741_zpid/
-- We set address = "623 Russell Ave N Minneapolis MN 55411" (slug with hyphens replaced by spaces).

UPDATE public.zillow_fsbo_listings
SET
  address = replace((regexp_match(detail_url, '/homedetails/([^/]+)/'))[1], '-', ' '),
  updated_at = now()
WHERE detail_url ~ '/homedetails/[^/]+/'
  AND (
    address IS NULL
    OR trim(address) = ''
    OR address = 'EMPTY'
  );
