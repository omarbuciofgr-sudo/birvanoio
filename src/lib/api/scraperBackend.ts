/**
 * Scraper backend API (your Flask server).
 * Used for Hotpads (and future scrapers) instead of Supabase Edge Functions.
 */
import { normalizeLocationClient } from '@/lib/realEstateSearch';

/** Full state name → 2-letter abbreviation (for "Chicago, Illinois" etc.). */
export const stateNameToAbbrev: Record<string, string> = {
  alabama: "al", alaska: "ak", arizona: "az", arkansas: "ar", california: "ca", colorado: "co",
  connecticut: "ct", delaware: "de", florida: "fl", georgia: "ga", hawaii: "hi", idaho: "id",
  illinois: "il", indiana: "in", iowa: "ia", kansas: "ks", kentucky: "ky", louisiana: "la",
  maine: "me", maryland: "md", massachusetts: "ma", michigan: "mi", minnesota: "mn",
  mississippi: "ms", missouri: "mo", montana: "mt", nebraska: "ne", nevada: "nv",
  "new hampshire": "nh", "new jersey": "nj", "new mexico": "nm", "new york": "ny",
  "north carolina": "nc", "north dakota": "nd", ohio: "oh", oklahoma: "ok", oregon: "or",
  pennsylvania: "pa", "rhode island": "ri", "south carolina": "sc", "south dakota": "sd",
  tennessee: "tn", texas: "tx", utah: "ut", vermont: "vt", virginia: "va", washington: "wa",
  "west virginia": "wv", wisconsin: "wi", wyoming: "wy", "district of columbia": "dc", "d.c.": "dc",
};

/** Normalize "NY", "New York", "Illinois" → uppercase 2-letter abbrev for city/state filters. */
export function normalizeStateToAbbrev(statePart: string): string | null {
  const t = (statePart || "").trim();
  if (!t) return null;
  if (/^[A-Za-z]{2}$/.test(t)) return t.toUpperCase();
  const full = stateNameToAbbrev[t.toLowerCase()];
  return full ? full.toUpperCase() : null;
}

/** Build Hotpads URL on the frontend so we don't depend on backend search-location (avoids 500/encoding issues). */
export function buildHotpadsUrl(location: string, propertyType: string = "apartments"): string | null {
  const loc = (location || "").trim();
  if (!loc) return null;
  const cityToState: Record<string, string> = {
    minneapolis: "mn", "new york": "ny", "los angeles": "ca", chicago: "il",
    houston: "tx", phoenix: "az", philadelphia: "pa", "san antonio": "tx",
    "san diego": "ca", dallas: "tx", austin: "tx", seattle: "wa", denver: "co",
    boston: "ma", miami: "fl", atlanta: "ga", detroit: "mi", portland: "or",
    washington: "dc", "san francisco": "ca", "san fracisco": "ca", "los angles": "ca",
  };
  const slugOverrides: Record<string, string> = {
    "san fracisco": "san-francisco", "los angles": "los-angeles",
  };
  const low = loc.toLowerCase();
  let stateAbbrev: string | null = cityToState[low] ?? null;
  let city = loc;
  // "City, ST" (2-letter state)
  const commaMatch2 = loc.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (commaMatch2) {
    city = commaMatch2[1].trim();
    stateAbbrev = commaMatch2[2].trim().toLowerCase();
  }
  // "City, Full State Name" (e.g. Chicago, Illinois)
  if (!stateAbbrev) {
    const commaMatchFull = loc.match(/^(.+?),\s*(.+)$/);
    if (commaMatchFull) {
      city = commaMatchFull[1].trim();
      const statePart = commaMatchFull[2].trim().toLowerCase();
      stateAbbrev = stateNameToAbbrev[statePart] ?? (statePart.length === 2 ? statePart : null);
    }
  }
  if (!stateAbbrev) {
    const spaceMatch = loc.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);
    if (spaceMatch) {
      city = spaceMatch[1].trim();
      stateAbbrev = spaceMatch[2].trim().toLowerCase();
    }
  }
  if (!stateAbbrev || !city) return null;
  let slug = city
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
  slug = slugOverrides[low] ?? slugOverrides[city.toLowerCase()] ?? slug;
  if (!slug) return null;
  const cityStateSlug = `${slug}-${stateAbbrev}`;
  // FRBO: Hotpads "for rent by owner" filter (excludes apartment complexes / property management)
  const pt = (propertyType || "apartments").toLowerCase().trim();
  if (pt === "for-rent-by-owner" || pt === "frbo") {
    return `https://hotpads.com/${cityStateSlug}/for-rent-by-owner?isListedByOwner=true&listingTypes=rental`;
  }
  let pathSegment = pt;
  if (["for-rent", "rent", "rentals", ""].includes(pathSegment)) pathSegment = "apartments";
  if (!pathSegment.endsWith("s") && ["apartment", "house", "condo", "townhome"].includes(pathSegment)) pathSegment += "s";
  return `https://hotpads.com/${cityStateSlug}/${pathSegment}-for-rent`;
}

/**
 * Plain Zillow city rentals URL (no searchQueryState). SSR includes listResults; the FRBO spider
 * drops /apartments/ and /b/ SERP cards and pulls /homedetails/ from HTML. Building this on the
 * frontend avoids stale backends that still append FRBO filter query (empty SSR + empty UI).
 */
export function buildZillowFrboRentalsUrl(location: string): string | null {
  const loc = (location || "").trim();
  if (!loc) return null;
  const cityToState: Record<string, string> = {
    minneapolis: "mn", "new york": "ny", "los angeles": "ca", chicago: "il",
    houston: "tx", phoenix: "az", philadelphia: "pa", "san antonio": "tx",
    "san diego": "ca", dallas: "tx", austin: "tx", seattle: "wa", denver: "co",
    boston: "ma", miami: "fl", atlanta: "ga", detroit: "mi", portland: "or",
    washington: "dc", "san francisco": "ca", "san fracisco": "ca", "los angles": "ca",
  };
  const slugOverrides: Record<string, string> = {
    "san fracisco": "san-francisco", "los angles": "los-angeles",
  };
  const low = loc.toLowerCase();
  let stateAbbrev: string | null = cityToState[low] ?? null;
  let city = loc;
  const commaMatch2 = loc.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (commaMatch2) {
    city = commaMatch2[1].trim();
    stateAbbrev = commaMatch2[2].trim().toLowerCase();
  }
  if (!stateAbbrev) {
    const commaMatchFull = loc.match(/^(.+?),\s*(.+)$/);
    if (commaMatchFull) {
      city = commaMatchFull[1].trim();
      const statePart = commaMatchFull[2].trim().toLowerCase();
      stateAbbrev = stateNameToAbbrev[statePart] ?? (statePart.length === 2 ? statePart : null);
    }
  }
  if (!stateAbbrev) {
    const spaceMatch = loc.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);
    if (spaceMatch) {
      city = spaceMatch[1].trim();
      stateAbbrev = spaceMatch[2].trim().toLowerCase();
    }
  }
  if (!stateAbbrev || !city) return null;
  let slug = city
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
  slug = slugOverrides[low] ?? slugOverrides[city.toLowerCase()] ?? slug;
  if (!slug) return null;
  const cityStateSlug = `${slug}-${stateAbbrev}`;
  return `https://www.zillow.com/${cityStateSlug}/rentals/`;
}

/** True when location should run Zillow FRBO US-wide (many metro seeds), not a single city. */
export function isZillowFrboUsCountryLocation(location: string): boolean {
  const raw = (location || "").trim();
  if (!raw) return false;
  const t = raw.toLowerCase();
  if (t === "us" || t === "usa" || t === "u.s." || t === "u.s.a.") return true;
  return /\b(united states|us nationwide|usa nationwide|all us listings|countrywide|country.?wide)\b/i.test(raw);
}

/** Build Trulia FSBO URL (same cities as Hotpads). Used when scraping Trulia from Brivano Scout. */
/** Zillow FSBO SERP (e.g. Atlanta, GA → …/atlanta-ga/fsbo/). */
export function buildZillowFsboUrl(location: string): string | null {
  const loc = (location || "").trim();
  if (!loc) return null;
  const cityToState: Record<string, string> = {
    minneapolis: "mn", "new york": "ny", "los angeles": "ca", chicago: "il",
    houston: "tx", phoenix: "az", philadelphia: "pa", "san antonio": "tx",
    "san diego": "ca", dallas: "tx", austin: "tx", seattle: "wa", denver: "co",
    boston: "ma", miami: "fl", atlanta: "ga", detroit: "mi", portland: "or",
    washington: "dc", "san francisco": "ca", orlando: "fl", tampa: "fl",
  };
  const low = loc.toLowerCase();
  let stateAbbrev: string | null = cityToState[low] ?? null;
  let city = loc;
  const commaMatch2 = loc.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (commaMatch2) {
    city = commaMatch2[1].trim();
    stateAbbrev = commaMatch2[2].trim().toLowerCase();
  }
  if (!stateAbbrev) {
    const commaMatchFull = loc.match(/^(.+?),\s*(.+)$/);
    if (commaMatchFull) {
      city = commaMatchFull[1].trim();
      const statePart = commaMatchFull[2].trim().toLowerCase();
      stateAbbrev = stateNameToAbbrev[statePart] ?? (statePart.length === 2 ? statePart : null);
    }
  }
  if (!stateAbbrev) {
    const spaceMatch = loc.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);
    if (spaceMatch) {
      city = spaceMatch[1].trim();
      stateAbbrev = spaceMatch[2].trim().toLowerCase();
    }
  }
  if (!stateAbbrev || !city) return null;
  const slug = city
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return null;
  return `https://www.zillow.com/${slug}-${stateAbbrev}/fsbo/`;
}

/** FSBO.com city search list URL. */
export function buildFsboSearchUrl(location: string): string | null {
  const loc = (location || "").trim();
  if (!loc) return null;
  const city = loc.split(",")[0]?.trim();
  if (!city) return null;
  const citySlug = city
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
  if (!citySlug) return null;
  return `https://www.forsalebyowner.com/search/list/${citySlug}`;
}

/** Apartments.com FRBO SERP for a metro (e.g. Atlanta, GA → …/atlanta-ga/for-rent-by-owner/). */
export function buildApartmentsFrboUrl(location: string): string | null {
  const loc = (location || "").trim();
  if (!loc) return null;
  const cityToState: Record<string, string> = {
    minneapolis: "mn", "new york": "ny", "los angeles": "ca", chicago: "il",
    houston: "tx", phoenix: "az", philadelphia: "pa", "san antonio": "tx",
    "san diego": "ca", dallas: "tx", austin: "tx", seattle: "wa", denver: "co",
    boston: "ma", miami: "fl", atlanta: "ga", detroit: "mi", portland: "or",
    washington: "dc", "san francisco": "ca", orlando: "fl", tampa: "fl",
  };
  const low = loc.toLowerCase();
  let stateAbbrev: string | null = cityToState[low] ?? null;
  let city = loc;
  const commaMatch2 = loc.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (commaMatch2) {
    city = commaMatch2[1].trim();
    stateAbbrev = commaMatch2[2].trim().toLowerCase();
  }
  if (!stateAbbrev) {
    const commaMatchFull = loc.match(/^(.+?),\s*(.+)$/);
    if (commaMatchFull) {
      city = commaMatchFull[1].trim();
      const statePart = commaMatchFull[2].trim().toLowerCase();
      stateAbbrev = stateNameToAbbrev[statePart] ?? (statePart.length === 2 ? statePart : null);
    }
  }
  if (!stateAbbrev) {
    const spaceMatch = loc.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);
    if (spaceMatch) {
      city = spaceMatch[1].trim();
      stateAbbrev = spaceMatch[2].trim().toLowerCase();
    }
  }
  if (!stateAbbrev || !city) return null;
  const slug = city
    .toLowerCase()
    .replace(/[^\w\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/^-|-$/g, "");
  if (!slug) return null;
  return `https://www.apartments.com/${slug}-${stateAbbrev}/for-rent-by-owner/`;
}

export function buildTruliaUrl(location: string): string | null {
  const loc = (location || "").trim();
  if (!loc) return null;
  const cityToState: Record<string, string> = {
    minneapolis: "mn", "new york": "ny", "los angeles": "ca", chicago: "il",
    washington: "dc", "san francisco": "ca", "san fracisco": "ca", "los angles": "ca",
    houston: "tx", phoenix: "az", philadelphia: "pa", "san antonio": "tx",
    "san diego": "ca", dallas: "tx", austin: "tx", seattle: "wa", denver: "co",
    boston: "ma", miami: "fl", atlanta: "ga", detroit: "mi", portland: "or",
  };
  const low = loc.toLowerCase();
  let stateAbbrev: string | null = cityToState[low] ?? null;
  let city = loc;
  const commaMatch2 = loc.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (commaMatch2) {
    city = commaMatch2[1].trim();
    stateAbbrev = commaMatch2[2].trim().toLowerCase();
  }
  if (!stateAbbrev) {
    const commaMatchFull = loc.match(/^(.+?),\s*(.+)$/);
    if (commaMatchFull) {
      city = commaMatchFull[1].trim();
      const statePart = commaMatchFull[2].trim().toLowerCase();
      stateAbbrev = stateNameToAbbrev[statePart] ?? (statePart.length === 2 ? statePart : null);
    }
  }
  if (!stateAbbrev) {
    const spaceMatch = loc.match(/^(.+?)\s+([A-Za-z]{2})\s*$/);
    if (spaceMatch) {
      city = spaceMatch[1].trim();
      stateAbbrev = spaceMatch[2].trim().toLowerCase();
    }
  }
  if (!stateAbbrev || !city) return null;
  // Trulia expects "City,ST" with no space after comma (e.g. Minneapolis,MN); space causes INVALID_LOCATION
  const locationStr = `${city},${stateAbbrev.toUpperCase()}`;
  const encoded = encodeURIComponent(locationStr).replace(/%2C/g, ",");
  return `https://www.trulia.com/for_sale/${encoded}/fsbo_lt/1_als/`;
}

/** Backend URL when frontend is at brivano.io, Lovable preview, or any non-local host */
const PRODUCTION_BACKEND = "https://resplendent-empathy-production.up.railway.app";

function isProductionHost(): boolean {
  if (typeof window === "undefined") return import.meta.env.PROD;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return false;
  // brivano.io, Lovable preview, or any other deployment → use Railway backend
  return true;
}

function envScraperUrlIgnoresMisconfiguredSelfReference(envUrl: string): string | null {
  if (!envUrl || typeof window === "undefined") return envUrl || null;
  try {
    const envOrigin = new URL(envUrl).origin;
    if (envOrigin === window.location.origin) {
      // Common mistake: VITE_SCRAPER_BACKEND_URL set to the SPA host (Vercel/Lovable preview).
      // That makes POST /api/waterfall-enrich 404 on the static frontend. Fall back to defaults below.
      return null;
    }
  } catch {
    return envUrl;
  }
  return envUrl;
}

/** From env / defaults only — no auto-discovered port (see `resolvedScraperBaseUrl`). */
function getConfiguredScraperBaseUrl(): string {
  const rawEnv =
    typeof import.meta.env.VITE_SCRAPER_BACKEND_URL === "string"
      ? import.meta.env.VITE_SCRAPER_BACKEND_URL.trim().replace(/\/$/, "")
      : "";
  const envUrl = rawEnv ? envScraperUrlIgnoresMisconfiguredSelfReference(rawEnv) : null;
  if (envUrl) return envUrl;
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:8080";
  }
  if (isProductionHost()) return PRODUCTION_BACKEND;
  return "http://localhost:8080";
}

/** First localhost:port that passed /api/health (fixes VITE on 8081 while Flask runs on 8080). */
let resolvedScraperBaseUrl: string | null = null;

function isLocalhostScraperUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "localhost" || u.hostname === "127.0.0.1";
  } catch {
    return false;
  }
}

/** Prefer configured URL, then common Flask ports so wrong VITE port still finds api_server.py */
function buildLocalHealthCandidates(preferred: string): string[] {
  const extras = [
    preferred,
    "http://127.0.0.1:8080",
    "http://localhost:8080",
    "http://127.0.0.1:8081",
    "http://localhost:8081",
  ];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const b of extras) {
    if (!b || seen.has(b)) continue;
    seen.add(b);
    out.push(b);
  }
  return out;
}

const getBaseUrl = (): string => {
  return resolvedScraperBaseUrl ?? getConfiguredScraperBaseUrl();
};

export type BackendSearchLocationResponse = {
  url?: string;
  platform?: string;
  location?: string;
  success?: boolean;
  error?: string;
};

export type BackendTriggerFromUrlResponse = {
  message?: string;
  platform?: string;
  url?: string;
  location?: string;
  error?: string;
};

export type BackendHotpadsStatusResponse = {
  status: "running" | "idle";
  last_run?: string;
  error?: string;
  /** ISO timestamp when the current scrape started (from trigger-from-url). */
  started_at?: string;
  /** Search box city stored on the scrape session. */
  location?: string;
};

export type BackendHotpadsLastResultResponse = {
  listings: Array<{
    address?: string;
    bedrooms?: number;
    bathrooms?: number;
    price?: string;
    owner_name?: string;
    owner_phone?: string;
    owner_email?: string;
    listing_url?: string;
    square_feet?: number;
    source_platform?: string;
    listing_type?: string;
  }>;
  total?: number;
  error?: string;
  message?: string;
  /** API stripped PM/realtor rows (default true when filter is active) */
  by_owner_only?: boolean;
  include_pm?: boolean;
  /** Rows in Supabase for this platform table (always returned for /last-result) */
  total_stored?: number;
  /** Omitted rows when include_pm=0 (PM/managed/corporate heuristics) */
  pm_rows_hidden?: number;
  /** Set when ?location= was applied on last-result */
  location_filter?: string;
  total_before_location_filter?: number;
  /** Why the UI received 0 rows (when set) */
  empty_reason?: string;
  location_match_mode?: string;
  rows_fetch_mode?: string;
  /** Non-technical copy for the UI */
  user_message?: string;
  normalized_location?: {
    search_city?: string | null;
    search_state?: string | null;
    search_location?: string | null;
    city_slug?: string | null;
    city_state_slug?: string | null;
    valid?: boolean;
  };
};

export type RealEstateSearchResponse = BackendHotpadsLastResultResponse & {
  success?: boolean;
  action?: 'cached' | 'needs_scrape' | 'scraping' | 'cached_filtered' | 'invalid_location' | 'error';
  normalized?: BackendHotpadsLastResultResponse['normalized_location'];
  scrape_url?: string | null;
};

export type LastResultFetchOptions = {
  retries?: number;
  /** When true, requests ?include_pm=1 so backend returns PM/realtor rows too */
  includePm?: boolean;
  /** Backend returns only listings matching this city (e.g. "Austin, TX") */
  location?: string;
  /** Omit location filter — load every city from the platform table */
  allCities?: boolean;
  /** ISO timestamp — only rows saved at/after this time (current Find Listings run) */
  since?: string;
};

function lastResultQuery(options?: LastResultFetchOptions): string {
  const params = new URLSearchParams();
  params.set("include_pm", options?.includePm === true ? "1" : "0");
  const loc = (options?.location || "").trim();
  if (loc) params.set("location", loc);
  const since = (options?.since || "").trim();
  if (since) params.set("since", since);
  return `?${params.toString()}`;
}

/** Flask /api/{segment}/live-results — in-memory scrape buffer (display before DB save). */
const LIVE_RESULTS_SEGMENT: Record<string, string> = {
  hotpads: "hotpads",
  trulia: "trulia",
  zillow: "zillow-fsbo",
  zillow_frbo: "zillow-frbo",
  fsbo: "fsbo",
  apartments: "apartments",
};

async function fetchLiveResults(
  platformKey: string,
  options?: LastResultFetchOptions,
): Promise<BackendHotpadsLastResultResponse> {
  const segment = LIVE_RESULTS_SEGMENT[platformKey];
  if (!segment) return { listings: [], error: "Unknown platform" };
  const base = getBaseUrl();
  const q = lastResultQuery(options);
  try {
    const res = await fetchWithTimeout(`${base}/api/${segment}/live-results${q}`, {}, 45000);
    const data = await res.json().catch(() => ({ listings: [] }));
    if (!res.ok) {
      return { listings: [], error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  } catch (e: unknown) {
    return { listings: [], error: e instanceof Error ? e.message : "Network error" };
  }
}

/** Avoid browser HTTP cache returning the wrong payload when toggling include_pm on the same path. */
const lastResultFetchInit: RequestInit = { cache: "no-store" };

const HEALTH_CHECK_TIMEOUT_MS = 12000;
const HEALTH_CHECK_RETRY_DELAY_MS = 2000;
const API_FETCH_TIMEOUT_MS = 45000;
/** Status must respond quickly; 20s caused canceled polls while backend was busy. */
const STATUS_FETCH_TIMEOUT_MS = 45000;
const STATUS_RESET_TIMEOUT_MS = 30000;
const TRIGGER_FETCH_TIMEOUT_MS = 60000;

async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs = API_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...lastResultFetchInit, ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** Lightweight status/reset calls — keep retries low so polls don't stack 3× timeouts. */
async function fetchStatusPath(
  path: string,
  timeoutMs = STATUS_FETCH_TIMEOUT_MS,
  retries = 0,
): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> {
  const base = getBaseUrl();
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(`${base}${path}`, {}, timeoutMs);
      const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
      return { ok: res.ok, data, status: res.status };
    } catch (e) {
      lastError = e;
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1200));
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Network error");
}

function parseStatusResponse(
  result: { ok: boolean; data: Record<string, unknown>; status: number },
): BackendHotpadsStatusResponse {
  if (!result.ok) {
    const err = typeof result.data.error === "string" ? result.data.error : `Request failed: ${result.status}`;
    return { status: "idle", error: err };
  }
  const status = result.data.status === "running" ? "running" : "idle";
  return {
    status,
    last_run: typeof result.data.last_run === "string" ? result.data.last_run : undefined,
    error: typeof result.data.error === "string" ? result.data.error : undefined,
    started_at: typeof result.data.started_at === "string" ? result.data.started_at : undefined,
    location: typeof result.data.location === "string" ? result.data.location : undefined,
  };
}

/**
 * Use inside poll loops: transient Railway/network failures should not end the scrape early.
 */
export async function pollScraperStatus(
  getter: () => Promise<BackendHotpadsStatusResponse>,
): Promise<BackendHotpadsStatusResponse> {
  try {
    const s = await getter();
    if (s.status === "idle" && s.error && /network|reset|abort|timeout|fetch|failed/i.test(s.error)) {
      return { status: "running", error: s.error };
    }
    return s;
  } catch {
    return { status: "running", error: "transient_network" };
  }
}

async function pingHealthOnce(base: string, signal: AbortSignal): Promise<boolean> {
  const res = await fetch(`${base}/api/health`, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    signal,
  });
  if (!res.ok) return false;
  const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
  // Reject other apps that return 200 on /api/health (e.g. wrong VITE_SCRAPER_BACKEND_URL port).
  if (data && data.service === "brivano_scraper_api") return true;
  if (data && data.message === "Backend running" && typeof data.waterfall_enrich_url === "string") return true;
  return false;
}

/** Returns true if the backend is reachable (e.g. GET /api/health). Retries once after delay for Railway cold start. */
export async function isScraperBackendReachable(): Promise<boolean> {
  const preferred = getConfiguredScraperBaseUrl();
  const candidates = isLocalhostScraperUrl(preferred)
    ? buildLocalHealthCandidates(preferred)
    : [preferred];

  for (const base of candidates) {
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
        const ok = await pingHealthOnce(base, controller.signal);
        clearTimeout(timeoutId);
        if (ok) {
          if (base !== preferred && isLocalhostScraperUrl(preferred)) {
            console.warn(
              `[Brivano Scout] Flask scraper is on ${base} but VITE_SCRAPER_BACKEND_URL is ${preferred}. Using ${base} for this session — set env to match or run: set PORT=8081 (Windows) if you want Flask on 8081.`,
            );
          }
          resolvedScraperBaseUrl = base;
          return true;
        }
      } catch {
        // timeout or network error
      }
      if (attempt === 0) {
        await new Promise((r) => setTimeout(r, HEALTH_CHECK_RETRY_DELAY_MS));
      }
    }
  }
  resolvedScraperBaseUrl = null;
  return false;
}

export const scraperBackendApi = {
  getBaseUrl,
  isScraperBackendReachable,

  /** Listings from the active scrape buffer (shown before Supabase flush). */
  getLiveResults(platformKey: string, options?: LastResultFetchOptions) {
    return fetchLiveResults(platformKey, options);
  },

  async fetchLastResultForPlatform(
    platformKey: string,
    options?: LastResultFetchOptions,
  ): Promise<BackendHotpadsLastResultResponse> {
    switch (platformKey) {
      case "hotpads":
        return this.getHotpadsLastResult(options);
      case "trulia":
        return this.getTruliaLastResult(options);
      case "zillow":
        return this.getZillowFsboLastResult(options);
      case "zillow_frbo":
        return this.getZillowFrboLastResult(options);
      case "fsbo":
        return this.getFsboLastResult(options);
      case "apartments":
        return this.getApartmentsLastResult(options);
      default:
        return { listings: [], error: "Unknown platform" };
    }
  },

  /**
   * Live buffer during an active scrape. By default skips /last-result (slow on large tables).
   * Set allowDbFallback=true to load Supabase when the buffer is still empty.
   */
  async fetchSearchResultsDuringScrape(
    platformKey: string,
    options?: LastResultFetchOptions,
    opts?: { allowDbFallback?: boolean },
  ): Promise<BackendHotpadsLastResultResponse> {
    const live = await fetchLiveResults(platformKey, options);
    const liveCount = live.listings?.length ?? 0;
    if (liveCount > 0) return live;
    if (opts?.allowDbFallback !== true) {
      return live;
    }
    const db = await this.fetchLastResultForPlatform(platformKey, { ...options, retries: 0 });
    const dbCount = db.listings?.length ?? 0;
    if (dbCount > 0) return db;
    return live.listings ? live : db;
  },

  async normalizeLocation(location: string): Promise<{
    success: boolean;
    valid?: boolean;
    search_city?: string | null;
    search_state?: string | null;
    search_location?: string | null;
    city_slug?: string | null;
    city_state_slug?: string | null;
    user_message?: string;
  }> {
    const base = getBaseUrl();
    try {
      const res = await fetch(`${base}/api/real-estate/normalize-location`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ location: location.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.valid !== false && data.search_location) {
        return { success: true, ...data };
      }
    } catch {
      /* fall through to client normalize */
    }
    const client = normalizeLocationClient(location);
    if (client.success && client.search_location) {
      return { success: true, ...client };
    }
    return {
      success: false,
      valid: false,
      user_message: "We couldn't find that city. Please check the city and state and try again.",
    };
  },

  async realEstateSearch(
    platform: string,
    location: string,
    options?: { includePm?: boolean },
  ): Promise<RealEstateSearchResponse> {
    const base = getBaseUrl();
    const res = await fetchWithTimeout(`${base}/api/real-estate/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        platform,
        location: location.trim(),
        include_pm: options?.includePm === true,
      }),
    }, 60000);
    if (res.status === 404) {
      return { listings: [], success: true, action: 'needs_scrape' as const };
    }
    const data = await res.json().catch(() => ({ listings: [] }));
    if (!res.ok) {
      return {
        listings: [],
        success: false,
        action: 'error',
        user_message: data.user_message,
        error: data.error,
      };
    }
    return data;
  },

  async searchLocation(platform: string, location: string, propertyType: string = "apartments"): Promise<BackendSearchLocationResponse> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/search-location`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ platform, location, property_type: propertyType }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { success: false, error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async triggerFromUrl(
    url: string,
    options?: {
      force?: boolean;
      /** Save PM/managed contacts to Supabase (matches UI "Include PM / realtor") */
      savePm?: boolean;
      /** Search box city (e.g. Atlanta, GA) — stored on scrape session for last-result */
      location?: string;
    },
  ): Promise<BackendTriggerFromUrlResponse> {
    const base = getBaseUrl();
    const savePm = options?.savePm === true ? "&save_pm=1" : "";
    const loc = (options?.location || "").trim();
    const locQs = loc ? `&location=${encodeURIComponent(loc)}` : "";
    const qs = `?url=${encodeURIComponent(url)}${options?.force ? "&force=1" : ""}${savePm}${locQs}`;
    try {
      const res = await fetchWithTimeout(
        `${base}/api/trigger-from-url${qs}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url,
            force: options?.force === true,
            save_pm: options?.savePm === true,
            location: loc || undefined,
          }),
        },
        TRIGGER_FETCH_TIMEOUT_MS,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return { error: data.error || `Request failed: ${res.status}` };
      }
      return data;
    } catch (e: unknown) {
      return { error: e instanceof Error ? e.message : "Network error" };
    }
  },

  async triggerZillowFrboCountry(
    options?: { country?: string; savePm?: boolean },
  ): Promise<BackendTriggerFromUrlResponse> {
    const base = getBaseUrl();
    const country = (options?.country || "US").trim().toUpperCase() || "US";
    const savePm = options?.savePm === true ? "&save_pm=1" : "";
    const qs = `?country=${encodeURIComponent(country)}${savePm}`;
    const res = await fetch(`${base}/api/trigger-zillow-frbo-country${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ country, save_pm: options?.savePm === true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async getHotpadsStatus(): Promise<BackendHotpadsStatusResponse> {
    try {
      return parseStatusResponse(await fetchStatusPath("/api/status-hotpads"));
    } catch (e: unknown) {
      return { status: "idle", error: e instanceof Error ? e.message : "Network error" };
    }
  },

  /** Clear backend "running" state so a new scrape can start (use when you get "already running" 400). */
  async resetHotpadsStatus(): Promise<{ message?: string; error?: string }> {
    try {
      const result = await fetchStatusPath("/api/status-hotpads?reset=1", STATUS_RESET_TIMEOUT_MS, 1);
      if (!result.ok) {
        return { error: (result.data.error as string) || `Request failed: ${result.status}` };
      }
      return result.data as { message?: string };
    } catch {
      return {};
    }
  },

  async getHotpadsLastResult(options?: LastResultFetchOptions): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    const q = lastResultQuery(options);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(`${base}/api/hotpads/last-result${q}`);
        const data = await res.json().catch(() => ({ listings: [] }));
        if (!res.ok) {
          lastError = data.error || `Request failed: ${res.status}`;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return data;
      } catch (e: any) {
        lastError = e?.message || 'Network error';
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { listings: [], error: lastError || 'Failed after retries' };
  },

  async getTruliaStatus(): Promise<BackendHotpadsStatusResponse> {
    try {
      return parseStatusResponse(await fetchStatusPath("/api/status-trulia"));
    } catch (e: unknown) {
      return { status: "idle", error: e instanceof Error ? e.message : "Network error" };
    }
  },

  async resetTruliaStatus(): Promise<{ message?: string; error?: string }> {
    try {
      const result = await fetchStatusPath("/api/status-trulia?reset=1", STATUS_RESET_TIMEOUT_MS, 1);
      if (!result.ok) {
        return { error: (result.data.error as string) || `Request failed: ${result.status}` };
      }
      return result.data as { message?: string };
    } catch {
      return {};
    }
  },

  async getTruliaLastResult(options?: LastResultFetchOptions): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    const q = lastResultQuery(options);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(`${base}/api/trulia/last-result${q}`);
        const data = await res.json().catch(() => ({ listings: [] }));
        if (!res.ok) {
          lastError = data.error || `Request failed: ${res.status}`;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return data;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : "Network error";
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { listings: [], error: lastError || "Failed after retries" };
  },

  async getRedfinStatus(): Promise<BackendHotpadsStatusResponse> {
    try {
      return parseStatusResponse(await fetchStatusPath("/api/status-redfin"));
    } catch (e: unknown) {
      return { status: "idle", error: e instanceof Error ? e.message : "Network error" };
    }
  },

  async resetRedfinStatus(): Promise<{ message?: string; error?: string }> {
    try {
      const result = await fetchStatusPath("/api/status-redfin?reset=1", STATUS_RESET_TIMEOUT_MS, 1);
      if (!result.ok) {
        return { error: (result.data.error as string) || `Request failed: ${result.status}` };
      }
      return result.data as { message?: string };
    } catch {
      return {};
    }
  },

  async getRedfinLastResult(options?: LastResultFetchOptions): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    const q = lastResultQuery(options);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(`${base}/api/redfin/last-result${q}`);
        const data = await res.json().catch(() => ({ listings: [] }));
        if (!res.ok) {
          lastError = data.error || `Request failed: ${res.status}`;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return data;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : "Network error";
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { listings: [], error: lastError || "Failed after retries" };
  },

  async getZillowFrboStatus(): Promise<BackendHotpadsStatusResponse> {
    try {
      return parseStatusResponse(await fetchStatusPath("/api/status-zillow-frbo"));
    } catch (e: unknown) {
      return { status: "idle", error: e instanceof Error ? e.message : "Network error" };
    }
  },

  async resetZillowFrboStatus(): Promise<{ message?: string; error?: string }> {
    try {
      const result = await fetchStatusPath("/api/status-zillow-frbo?reset=1", STATUS_RESET_TIMEOUT_MS, 1);
      if (!result.ok) {
        return { error: (result.data.error as string) || `Request failed: ${result.status}` };
      }
      return result.data as { message?: string };
    } catch {
      return {};
    }
  },

  async getZillowFrboLastResult(options?: LastResultFetchOptions): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    const q = lastResultQuery(options);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(`${base}/api/zillow-frbo/last-result${q}`);
        const data = await res.json().catch(() => ({ listings: [] }));
        if (!res.ok) {
          lastError = data.error || `Request failed: ${res.status}`;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return data;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : "Network error";
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { listings: [], error: lastError || "Failed after retries" };
  },

  async getZillowFsboStatus(): Promise<BackendHotpadsStatusResponse> {
    try {
      return parseStatusResponse(await fetchStatusPath("/api/status-zillow-fsbo"));
    } catch (e: unknown) {
      return { status: "idle", error: e instanceof Error ? e.message : "Network error" };
    }
  },

  async resetZillowFsboStatus(): Promise<{ message?: string; error?: string }> {
    try {
      const result = await fetchStatusPath("/api/status-zillow-fsbo?reset=1", STATUS_RESET_TIMEOUT_MS, 1);
      if (!result.ok) {
        return { error: (result.data.error as string) || `Request failed: ${result.status}` };
      }
      return result.data as { message?: string };
    } catch {
      return {};
    }
  },

  async getZillowFsboLastResult(options?: LastResultFetchOptions): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    const q = lastResultQuery(options);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(`${base}/api/zillow-fsbo/last-result${q}`, {}, API_FETCH_TIMEOUT_MS);
        const data = await res.json().catch(() => ({ listings: [] }));
        if (!res.ok) {
          lastError = data.error || `Request failed: ${res.status}`;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return data;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : "Network error";
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { listings: [], error: lastError || "Failed after retries" };
  },

  async getFsboStatus(): Promise<BackendHotpadsStatusResponse> {
    try {
      return parseStatusResponse(await fetchStatusPath("/api/status-fsbo"));
    } catch (e: unknown) {
      return { status: "idle", error: e instanceof Error ? e.message : "Network error" };
    }
  },

  async resetFsboStatus(): Promise<{ message?: string; error?: string }> {
    try {
      const result = await fetchStatusPath("/api/status-fsbo?reset=1", STATUS_RESET_TIMEOUT_MS, 1);
      if (!result.ok) {
        return { error: (result.data.error as string) || `Request failed: ${result.status}` };
      }
      return result.data as { message?: string };
    } catch {
      return {};
    }
  },

  async getFsboLastResult(options?: LastResultFetchOptions): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    const q = lastResultQuery(options);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(`${base}/api/fsbo/last-result${q}`);
        const data = await res.json().catch(() => ({ listings: [] }));
        if (!res.ok) {
          lastError = data.error || `Request failed: ${res.status}`;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return data;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : "Network error";
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { listings: [], error: lastError || "Failed after retries" };
  },

  async getApartmentsStatus(): Promise<BackendHotpadsStatusResponse> {
    try {
      return parseStatusResponse(await fetchStatusPath("/api/status-apartments"));
    } catch (e: unknown) {
      return { status: "idle", error: e instanceof Error ? e.message : "Network error" };
    }
  },

  async resetApartmentsStatus(): Promise<{ message?: string; error?: string }> {
    try {
      const result = await fetchStatusPath("/api/status-apartments?reset=1", STATUS_RESET_TIMEOUT_MS, 1);
      if (!result.ok) {
        return { error: (result.data.error as string) || `Request failed: ${result.status}` };
      }
      return result.data as { message?: string };
    } catch {
      return {};
    }
  },

  async getApartmentsLastResult(options?: LastResultFetchOptions): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    const q = lastResultQuery(options);
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetchWithTimeout(`${base}/api/apartments/last-result${q}`);
        const data = await res.json().catch(() => ({ listings: [] }));
        if (!res.ok) {
          lastError = data.error || `Request failed: ${res.status}`;
          if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
          continue;
        }
        return data;
      } catch (e: unknown) {
        lastError = e instanceof Error ? e.message : "Network error";
        if (attempt < maxAttempts) await new Promise((r) => setTimeout(r, 1500));
      }
    }
    return { listings: [], error: lastError || "Failed after retries" };
  },
};
