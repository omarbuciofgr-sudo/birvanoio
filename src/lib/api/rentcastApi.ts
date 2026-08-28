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
  owner_phone?: string | null;
  owner_email?: string | null;
  skip_trace_confidence?: number | null;
  fsbo_confidence?: number | null;
  classification?: string | null;
  confidence_score?: number | null;
  confidence_band?: string | null;
  reason_codes?: string[] | string | null;
  owner_normalized_name?: string | null;
  owner_portfolio_count?: number | null;
  enriched_at?: string | null;
  listing_text_signals?: {
    text_mentions_owner_listed?: boolean;
    matched_keywords?: string[];
    snippet?: string | null;
  } | null;
  imported_lead_id?: string | null;
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
  high_confidence?: number;
  likely_band?: number;
};

export type RentCastEnrichSummary = {
  requested?: number;
  enriched?: number;
  partial?: number;
  no_contact?: number;
  failed?: number;
};

export type RentCastEnrichResult = {
  rentcast_id?: string;
  address?: string;
  status?: string;
  owner_name?: string | null;
  owner_phone?: string | null;
  owner_email?: string | null;
  fsbo_confidence?: number | null;
  listing?: RentCastListing;
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
    min_confidence?: number;
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
      pipeline?: Record<string, unknown>;
      min_confidence?: number;
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

  async enrich(body: {
    location?: string;
    limit?: number;
    rentcast_ids?: string[];
    likely_only?: boolean;
  }) {
    const base = scraperBackendApi.getBaseUrl();
    const res = await fetch(`${base}/api/rentcast/enrich`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{
      success?: boolean;
      error?: string | null;
      results?: RentCastEnrichResult[];
      listings?: RentCastListing[];
      summary?: RentCastEnrichSummary;
      total?: number;
    }>;
  },
};
