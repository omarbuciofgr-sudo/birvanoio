/**
 * Real estate search UX: normalized locations, DB-first flow, user-friendly messages.
 */

import { addressMatchesSearch } from '@/components/scraper/ListingsMap';

export const RE_USER_MESSAGES = {
  invalid_location: 'Please enter a valid city and state.',
  cached_found: 'We found previously saved listings for this area.',
  needs_scrape: 'Searching listings for your area...',
  scrape_still_running: 'Searching listings for your area...',
  no_listings_found: 'No listings found for this city on this platform.',
  no_saved_rows_other_cities:
    'Nothing saved for this city yet. Click Find Listings to search this area (other cities are already in the database).',
  platform_no_coverage: 'This platform currently has no listings available for this area.',
  by_owner_filtered_all:
    'Listings exist for this area but your By-owner filter removed them. Try Include PM / realtor.',
  temporary_issue: "We couldn't fetch listings right now. Please try again.",
  listings_found: 'Listings found successfully.',
  enter_location: 'Enter a city and state (e.g. Nashville, TN) to search.',
  choose_platform: 'Choose a listing platform (Hotpads, Apartments.com, Zillow, etc.).',
  backend_unreachable:
    'Something went wrong while searching. Please try again in a few minutes.',
  scrape_in_progress: 'A search is already running. Please wait for it to finish.',
  scrape_fetch_unavailable: "We couldn't fetch listings right now. Please try again.",
} as const;

export type NormalizedLocation = {
  search_city?: string | null;
  search_state?: string | null;
  search_location?: string | null;
  city_slug?: string | null;
  city_state_slug?: string | null;
  valid?: boolean;
};

/** Strip technical API / network errors from user-visible copy. */
export function friendlyApiError(raw: string | undefined | null): string {
  const t = (raw || '').trim();
  if (!t) return RE_USER_MESSAGES.temporary_issue;
  const low = t.toLowerCase();
  if (
    low.includes('failed to fetch') ||
    low.includes('network') ||
    low.includes('aborted') ||
    low.includes('timeout') ||
    low.includes('connection reset') ||
    low.includes('econnrefused') ||
    low.includes('econnreset') ||
    low.includes('cors')
  ) {
    return RE_USER_MESSAGES.backend_unreachable;
  }
  if (
    /\b(500|502|503|504)\b/.test(low) ||
    low.includes('internal server') ||
    low.includes('supabase') ||
    low.includes('zyte') ||
    low.includes('scrapy') ||
    low.includes('exception') ||
    low.includes('traceback') ||
    low.includes('column') ||
    low.includes('schema') ||
    low.includes('already running')
  ) {
    if (low.includes('already running')) return RE_USER_MESSAGES.scrape_in_progress;
    return RE_USER_MESSAGES.temporary_issue;
  }
  if (low.includes('exited with code') || low.includes('scraper process exited')) {
    return t.length < 200 ? t : t.slice(0, 200);
  }
    return RE_USER_MESSAGES.invalid_location;
  }
  if (low.includes('unsupported platform') || low.includes('empty dataset') || low.includes('spider')) {
    return RE_USER_MESSAGES.platform_no_coverage;
  }
  if (low.includes('0 records') || low.includes('no rows') || low.includes('no listings')) {
    return RE_USER_MESSAGES.no_listings_found;
  }
  return RE_USER_MESSAGES.temporary_issue;
}

export function emptyReasonUserMessage(
  reason: string | undefined,
  userMessage?: string | null,
): string | null {
  if (userMessage && userMessage in RE_USER_MESSAGES) {
    return RE_USER_MESSAGES[userMessage as keyof typeof RE_USER_MESSAGES];
  }
  if (userMessage && !userMessage.includes('error') && userMessage.length < 120) {
    return userMessage;
  }
  switch (reason) {
    case 'no_saved_rows_for_city':
      return RE_USER_MESSAGES.no_listings_found;
    case 'no_saved_rows_for_city_other_cities_in_db':
      return RE_USER_MESSAGES.no_saved_rows_other_cities;
    case 'by_owner_filtered_all':
      return RE_USER_MESSAGES.by_owner_filtered_all;
    case 'scrape_still_running':
      return RE_USER_MESSAGES.scrape_still_running;
    case 'no_listings_after_filters':
      return RE_USER_MESSAGES.no_listings_found;
    default:
      return null;
  }
}

const STATE_NAME_TO_ABBREV: Record<string, string> = {
  alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO',
  connecticut: 'CT', delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID',
  illinois: 'IL', indiana: 'IN', iowa: 'IA', kansas: 'KS', kentucky: 'KY', louisiana: 'LA',
  maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI', minnesota: 'MN',
  mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV',
  'new hampshire': 'NH', 'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY',
  'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH', oklahoma: 'OK', oregon: 'OR',
  pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
  tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA',
  'west virginia': 'WV', wisconsin: 'WI', wyoming: 'WY', 'district of columbia': 'DC',
};

const CITY_TO_STATE: Record<string, string> = {
  nashville: 'TN', chicago: 'IL', atlanta: 'GA', houston: 'TX', dallas: 'TX', austin: 'TX',
  'los angeles': 'CA', 'san francisco': 'CA', miami: 'FL', seattle: 'WA', denver: 'CO',
  boston: 'MA', 'new york': 'NY', minneapolis: 'MN', phoenix: 'AZ', philadelphia: 'PA',
};

function titleCity(city: string): string {
  return city
    .trim()
    .split(/\s+/)
    .map((p) => (p ? p[0].toUpperCase() + p.slice(1).toLowerCase() : ''))
    .join(' ');
}

/** Client-side normalize when backend route is missing or offline. */
export function normalizeLocationClient(location: string): {
  success: boolean;
  valid?: boolean;
  search_city?: string;
  search_state?: string;
  search_location?: string;
  city_slug?: string;
  city_state_slug?: string;
} {
  const t = location.trim().replace(/\s+/g, ' ');
  if (!t) return { success: false, valid: false };
  let city = '';
  let state: string | null = null;
  const comma = t.match(/^(.+?),\s*(.+)$/);
  if (comma) {
    city = comma[1].trim();
    const stPart = comma[2].trim();
    state =
      stPart.length === 2
        ? stPart.toUpperCase()
        : STATE_NAME_TO_ABBREV[stPart.toLowerCase()] ?? null;
  } else {
    const sp = t.match(/^(.+)\s+([A-Za-z]{2})$/);
    if (sp) {
      city = sp[1].trim();
      state = sp[2].toUpperCase();
    } else {
      city = t;
      state = CITY_TO_STATE[t.toLowerCase()] ?? null;
    }
  }
  const search_city = titleCity(city);
  if (!state) return { success: false, valid: false };
  const search_state = state;
  const search_location = `${search_city}, ${search_state}`;
  const city_slug = search_city.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const city_state_slug = `${city_slug}-${search_state.toLowerCase()}`;
  return {
    success: true,
    valid: true,
    search_city,
    search_state,
    search_location,
    city_slug,
    city_state_slug,
  };
}

/** Prefer stored search_city/state; fall back to address/URL match for legacy rows. */
export function listingMatchesSearchSession(
  listing: {
    search_city?: string | null;
    search_state?: string | null;
    address?: string;
    listing_url?: string;
    source_url?: string;
  },
  location: string,
): boolean {
  const loc = location.trim();
  if (!loc) return true;
  const sc = (listing.search_city || '').trim();
  const ss = (listing.search_state || '').trim().toUpperCase();
  if (sc && ss) {
    const target = normalizeLocationClient(loc);
    if (!target.valid || !target.search_state) return true;
    const cityOk =
      sc.toLowerCase() === (target.search_city || '').toLowerCase() ||
      sc.toLowerCase().replace(/\s+/g, ' ') === (target.search_city || '').toLowerCase().replace(/\s+/g, ' ');
    return cityOk && ss === target.search_state;
  }
  return addressMatchesSearch(
    listing.address || '',
    loc,
    (listing.listing_url || listing.source_url || '') as string,
  );
}
