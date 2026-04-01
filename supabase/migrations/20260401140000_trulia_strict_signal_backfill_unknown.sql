-- Legacy rows (CSV / old scraper) left trulia_strict_signal NULL — Scout badges and filters treat NULL as empty.
UPDATE public.trulia_listings
SET trulia_strict_signal = 'unknown'
WHERE trulia_strict_signal IS NULL;
