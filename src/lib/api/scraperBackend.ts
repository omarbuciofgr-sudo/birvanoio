/**
 * Scraper backend API (your Flask server).
 * Used for Hotpads (and future scrapers) instead of Supabase Edge Functions.
 */

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
  const commaMatch = loc.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (commaMatch) {
    city = commaMatch[1].trim();
    stateAbbrev = commaMatch[2].trim().toLowerCase();
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

/** Build Trulia FSBO URL (same cities as Hotpads). Used when scraping Trulia from Brivano Scout. */
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
  const commaMatch = loc.match(/^(.+?),\s*([A-Za-z]{2})\s*$/);
  if (commaMatch) {
    city = commaMatch[1].trim();
    stateAbbrev = commaMatch[2].trim().toLowerCase();
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

const PRODUCTION_BACKEND = "https://resplendent-empathy-production.up.railway.app";
const FRONTEND_ORIGINS = ["https://www.brivano.io", "https://brivano.io"];

const getBaseUrl = (): string => {
  const url = import.meta.env.VITE_SCRAPER_BACKEND_URL;
  if (typeof url === "string" && url.trim()) return url.trim().replace(/\/$/, "");
  if (typeof window !== "undefined" && FRONTEND_ORIGINS.includes(window.location.origin))
    return PRODUCTION_BACKEND;
  return "http://localhost:8080";
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
};

export type BackendHotpadsLastResultResponse = {
  listings: Array<{
    address?: string;
    bedrooms?: number;
    bathrooms?: number;
    price?: string;
    owner_name?: string;
    owner_phone?: string;
    listing_url?: string;
    square_feet?: number;
    source_platform?: string;
    listing_type?: string;
  }>;
  total?: number;
  error?: string;
  message?: string;
};

/** Returns true if the backend is reachable (e.g. GET /api/health). Use before HotPads flow to avoid multiple connection-refused errors. */
export async function isScraperBackendReachable(): Promise<boolean> {
  try {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/health`, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
}

export const scraperBackendApi = {
  getBaseUrl,
  isScraperBackendReachable,

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

  async triggerFromUrl(url: string, options?: { force?: boolean }): Promise<BackendTriggerFromUrlResponse> {
    const base = getBaseUrl();
    // Send URL in query string too so backend gets it even if JSON body is not parsed
    const qs = `?url=${encodeURIComponent(url)}${options?.force ? "&force=1" : ""}`;
    const res = await fetch(`${base}/api/trigger-from-url${qs}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, force: options?.force === true }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async getHotpadsStatus(): Promise<BackendHotpadsStatusResponse> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-hotpads`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "idle", error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  /** Clear backend "running" state so a new scrape can start (use when you get "already running" 400). */
  async resetHotpadsStatus(): Promise<{ message?: string; error?: string }> {
    const base = getBaseUrl();
    // Use GET status-hotpads?reset=1 (always present); POST /api/hotpads/reset may 404 on some backends
    const res = await fetch(`${base}/api/status-hotpads?reset=1`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Request failed: ${res.status}` };
    return data;
  },

  async getHotpadsLastResult(options?: { retries?: number }): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${base}/api/hotpads/last-result`);
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
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-trulia`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "idle", error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async resetTruliaStatus(): Promise<{ message?: string; error?: string }> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-trulia?reset=1`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Request failed: ${res.status}` };
    return data;
  },

  async getTruliaLastResult(options?: { retries?: number }): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${base}/api/trulia/last-result`);
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
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-redfin`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "idle", error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async resetRedfinStatus(): Promise<{ message?: string; error?: string }> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-redfin?reset=1`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Request failed: ${res.status}` };
    return data;
  },

  async getRedfinLastResult(options?: { retries?: number }): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${base}/api/redfin/last-result`);
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
