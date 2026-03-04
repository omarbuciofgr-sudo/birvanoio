/**
 * Scraper backend API (your Flask server).
 * Used for Hotpads (and future scrapers) instead of Supabase Edge Functions.
 */

/** Full state name → 2-letter abbreviation (for "Chicago, Illinois" etc.). */
const stateNameToAbbrev: Record<string, string> = {
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

const getBaseUrl = (): string => {
  // When app is opened from localhost, always use local backend so both deployment and local work
  if (typeof window !== "undefined") {
    const host = window.location.hostname.toLowerCase();
    if (host === "localhost" || host === "127.0.0.1") return "http://localhost:8080";
  }
  const url = import.meta.env.VITE_SCRAPER_BACKEND_URL;
  if (typeof url === "string" && url.trim()) return url.trim().replace(/\/$/, "");
  if (isProductionHost()) return PRODUCTION_BACKEND;
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
    owner_email?: string;
    listing_url?: string;
    square_feet?: number;
    source_platform?: string;
    listing_type?: string;
  }>;
  total?: number;
  error?: string;
  message?: string;
};

const HEALTH_CHECK_TIMEOUT_MS = 20000; // 20s for Railway cold start
const HEALTH_CHECK_RETRY_DELAY_MS = 2000; // wait 2s before retry

async function pingHealthOnce(base: string, signal: AbortSignal): Promise<boolean> {
  const res = await fetch(`${base}/api/health`, {
    method: "GET",
    mode: "cors",
    credentials: "omit",
    signal,
  });
  return res.ok;
}

/** Returns true if the backend is reachable (e.g. GET /api/health). Retries once after delay for Railway cold start. */
export async function isScraperBackendReachable(): Promise<boolean> {
  const base = getBaseUrl();
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), HEALTH_CHECK_TIMEOUT_MS);
      const ok = await pingHealthOnce(base, controller.signal);
      clearTimeout(timeoutId);
      if (ok) return true;
    } catch {
      // timeout or network error
    }
    if (attempt === 0) {
      await new Promise((r) => setTimeout(r, HEALTH_CHECK_RETRY_DELAY_MS));
    }
  }
  return false;
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

  async getZillowFrboStatus(): Promise<BackendHotpadsStatusResponse> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-zillow-frbo`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "idle", error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async resetZillowFrboStatus(): Promise<{ message?: string; error?: string }> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-zillow-frbo?reset=1`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Request failed: ${res.status}` };
    return data;
  },

  async getZillowFrboLastResult(options?: { retries?: number }): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${base}/api/zillow-frbo/last-result`);
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
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-zillow-fsbo`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "idle", error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async resetZillowFsboStatus(): Promise<{ message?: string; error?: string }> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-zillow-fsbo?reset=1`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Request failed: ${res.status}` };
    return data;
  },

  async getZillowFsboLastResult(options?: { retries?: number }): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${base}/api/zillow-fsbo/last-result`);
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
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-fsbo`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "idle", error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async resetFsboStatus(): Promise<{ message?: string; error?: string }> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-fsbo?reset=1`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Request failed: ${res.status}` };
    return data;
  },

  async getFsboLastResult(options?: { retries?: number }): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${base}/api/fsbo/last-result`);
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
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-apartments`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { status: "idle", error: data.error || `Request failed: ${res.status}` };
    }
    return data;
  },

  async resetApartmentsStatus(): Promise<{ message?: string; error?: string }> {
    const base = getBaseUrl();
    const res = await fetch(`${base}/api/status-apartments?reset=1`);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || `Request failed: ${res.status}` };
    return data;
  },

  async getApartmentsLastResult(options?: { retries?: number }): Promise<BackendHotpadsLastResultResponse> {
    const base = getBaseUrl();
    const maxAttempts = options?.retries != null ? options.retries + 1 : 3;
    let lastError: string | undefined;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        const res = await fetch(`${base}/api/apartments/last-result`);
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
