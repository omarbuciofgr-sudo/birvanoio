/** Platforms that use Flask + Scrapy + Zyte (not Firecrawl "All Platforms"). */
export const BACKEND_RE_PLATFORMS = [
  'hotpads',
  'trulia',
  'zillow',
  'zillow_frbo',
  'fsbo',
  'apartments',
] as const;

export type BackendREPlatform = (typeof BACKEND_RE_PLATFORMS)[number];

export function isBackendRealEstatePlatform(platform: string): platform is BackendREPlatform {
  return (BACKEND_RE_PLATFORMS as readonly string[]).includes(platform);
}

export type ReCityFetchStats = {
  n: number;
  cityFilterActive: boolean;
  rowsBeforeCity?: number;
  locationFilter?: string;
  totalStored?: number;
};

/**
 * True when Supabase has no rows for the searched metro — caller should run Find Listings (live scrape).
 * When rows exist but PM filter hid them (rowsBeforeCity > 0, n = 0), returns false.
 */
export function cityNeedsLiveScrape(stats: ReCityFetchStats | null, location: string): boolean {
  const loc = location.trim();
  if (!loc) return false;
  if (!stats) return true;
  if (stats.n > 0) return false;
  if (!stats.cityFilterActive) return true;
  const before = stats.rowsBeforeCity;
  if (typeof before === 'number') return before === 0;
  return true;
}
