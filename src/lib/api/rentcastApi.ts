/**
 * RentCast API client — uses the same scraper backend base URL.
 * Does not change scrape trigger endpoints.
 */
import { scraperBackendApi } from "@/lib/api/scraperBackend";

export type RentCastListing = {
  rentcast_id?: string;
  listing_kind?: string;
  qualification?: string;
  qualification_reason?: string;
  is_likely_owner_listed?: boolean;
  address?: string | null;
  address_line1?: string | null;
  city?: string | null;
  state?: string | null;
  zip_code?: string | null;
  price?: number | null;
  bedrooms?: number | null;
  bathrooms?: number | null;
  square_footage?: number | null;
  property_type?: string | null;
  status?: string | null;
  listed_date?: string | null;
  days_on_market?: number | null;
  listing_url?: string | null;
  mls_number?: string | null;
  mls_name?: string | null;
  listing_agent_name?: string | null;
  listing_office_name?: string | null;
  owner_name?: string | null;
  owner_mailing_address?: string | null;
  search_location?: string | null;
};

export type RentCastStats = {
  total?: number;
  sale?: number;
  rental?: number;
  likely_fsbo?: number;
  likely_frbo?: number;
  agent_listed?: number;
  likely_owner_listed?: number;
};

async function parseJson(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

export const rentcastApi = {
  getBaseUrl: () => scraperBackendApi.getBaseUrl(),

  async health() {
    const base = scraperBackendApi.getBaseUrl();
    const res = await fetch(`${base}/api/rentcast/health`, { cache: "no-store" });
    return parseJson(res);
  },

  async search(body: {
    location: string;
    type?: "sale" | "rental" | "both";
    limit?: number;
    save?: boolean;
    likely_only?: boolean;
    fetch_owners_for_likely?: boolean;
  }) {
    const base = scraperBackendApi.getBaseUrl();
    const res = await fetch(`${base}/api/rentcast/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{
      success?: boolean;
      error?: string | null;
      listings?: RentCastListing[];
      stats?: RentCastStats;
      saved?: number;
      search_location?: string;
    }>;
  },

  async leads(params?: { location?: string; qualification?: string; limit?: number }) {
    const base = scraperBackendApi.getBaseUrl();
    const q = new URLSearchParams();
    if (params?.location) q.set("location", params.location);
    if (params?.qualification) q.set("qualification", params.qualification);
    if (params?.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    const res = await fetch(`${base}/api/rentcast/leads${qs ? `?${qs}` : ""}`, { cache: "no-store" });
    return parseJson(res) as Promise<{
      success?: boolean;
      error?: string | null;
      listings?: RentCastListing[];
      stats?: RentCastStats;
      total?: number;
    }>;
  },

  async pilotStats(location?: string) {
    const base = scraperBackendApi.getBaseUrl();
    const qs = location ? `?location=${encodeURIComponent(location)}` : "";
    const res = await fetch(`${base}/api/rentcast/pilot-stats${qs}`, { cache: "no-store" });
    return parseJson(res) as Promise<{
      success?: boolean;
      error?: string | null;
      stats?: RentCastStats;
      total?: number;
    }>;
  },

  async enrich(body: { location?: string; limit?: number }) {
    const base = scraperBackendApi.getBaseUrl();
    const res = await fetch(`${base}/api/rentcast/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{
      success?: boolean;
      error?: string | null;
      results?: unknown[];
      total?: number;
    }>;
  },
};
