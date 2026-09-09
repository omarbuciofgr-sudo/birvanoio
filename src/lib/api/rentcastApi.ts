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
  last_seen_active?: string | null;
  removed_date?: string | null;
  /** Phase C: on_market | off_market */
  market_status?: string | null;
  /** Phase C: fresh | aging | stale_risk (Active only) */
  freshness?: string | null;
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
  frbo_score?: number | null;
  fsbo_score?: number | null;
  owner_match_status?: string | null;
  contact_status?: string | null;
  needs_ownership_fallback?: boolean | null;
  external_verification_status?: string | null;
  external_verification_detail?: Record<string, unknown> | null;
  external_verified_at?: string | null;
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
  fsbo_candidate?: number;
  frbo_candidate?: number;
  agent_listed?: number;
  likely_owner_listed?: number;
  candidate_owner_listed?: number;
  qualified_60_plus?: number;
  high_confidence?: number;
  likely_band?: number;
  candidate_band?: number;
};

export type RentCastScorePart = { code?: string; points?: number };

export type RentCastDiagnostic = {
  total_rentcast_retrieved?: number;
  total_active?: number;
  total_scored?: number;
  total_hard_excluded?: number;
  apartments_excluded?: number;
  apartments_seen?: number;
  apartments_scored?: number;
  apartments_excluded_as_complex?: number;
  rentcast_total_count?: number;
  pages_fetched?: number;
  max_scan?: number;
  scan_exhausted?: boolean;
  /** Phase A: sale | rental | both */
  query_type?: string;
  /** Phase A: RentCast paths actually called */
  endpoints_called?: string[];
  listing_kinds_in_results?: string[];
  verification?: {
    confirmed_frbo?: number;
    confirmed_fsbo?: number;
    match_owner_unknown?: number;
    agent_listed?: number;
    no_match?: number;
    not_checked?: number;
  };
  building_concentration_buckets?: {
    "1"?: number;
    "2_3"?: number;
    "4_5"?: number;
    "6_9"?: number;
    "10_plus"?: number;
  };
  property_types?: Record<string, number>;
  no_mls_number?: number;
  no_mls_name?: number;
  no_meaningful_agent?: number;
  no_meaningful_office?: number;
  owner_lookup?: {
    attempted?: number;
    success?: number;
    failed?: number;
    skipped_excluded?: number;
    capped?: boolean;
  };
  rows_with_owner_name?: number;
  individual_owners?: number;
  organization_owners?: number;
  owner_occupied_false?: number;
  pm_institutional_keyword_hits?: number;
  capped_no_owner_signal?: number;
  owner_match_missing?: number;
  owner_match_verified?: number;
  score_20_plus?: number;
  score_40_plus?: number;
  score_50_plus?: number;
  score_60_plus?: number;
  score_70_plus?: number;
  highest_score?: number;
  average_score?: number;
  top_properties?: Array<{
    address?: string | null;
    listing_kind?: string | null;
    property_type?: string | null;
    score?: number;
    qualification?: string | null;
    classification?: string | null;
    owner_name?: string | null;
    owner_match_status?: string | null;
    contact_status?: string | null;
    frbo_score?: number | null;
    fsbo_score?: number | null;
    reason_codes?: string[] | string | null;
    score_breakdown?: RentCastScorePart[];
  }>;
};

/** Phase F: owner-lookup budget usage for a search */
export type RentCastOwnerLookupStats = {
  attempted?: number;
  success?: number;
  failed?: number;
  skipped_excluded?: number;
  capped?: boolean;
  by_property_id?: number;
  by_address?: number;
  max_lookups?: number | null;
};

export type RentCastEnrichSummary = {
  requested?: number;
  eligible?: number;
  skipped_below_60?: number;
  /** Phase F */
  max_enrich?: number;
  skipped_budget_cap?: number;
  enriched?: number;
  partial?: number;
  no_contact?: number;
  failed?: number;
  needs_ownership_fallback?: number;
};

export type RentCastVerifySummary = {
  requested?: number;
  eligible?: number;
  skipped_below_60?: number;
  configured?: boolean;
  batch_cap?: number;
  confirmed_frbo?: number;
  confirmed_fsbo?: number;
  match_owner_unknown?: number;
  agent_listed?: number;
  conflicting?: number;
  no_match?: number;
  not_checked?: number;
  market_status_conflict?: number;
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
    return parseJson(res) as Promise<{
      success?: boolean;
      rentcast_configured?: boolean;
      /** Phase E: true when FIRECRAWL_API_KEY is set (boolean only, never the key) */
      marketplace_verify_configured?: boolean;
      verify_url?: string;
      search_url?: string;
      leads_url?: string;
      enrich_url?: string;
    }>;
  },

  async search(body: {
    location: string;
    type?: "sale" | "rental" | "both";
    limit?: number;
    save?: boolean;
    likely_only?: boolean;
    min_confidence?: number;
    fetch_owners_for_likely?: boolean;
    diagnostic?: boolean;
    debug_pipeline?: boolean;
    /** Phase 3: 500 | 1000 | 1500 | 2000 */
    max_scan?: number;
    /** Phase C: active | inactive | all */
    market_status?: "active" | "inactive" | "all";
    /** Phase F: override the owner-lookup budget for this search */
    max_owner_lookups?: number;
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
      pool_stats?: RentCastStats;
      saved?: number;
      search_location?: string;
      pipeline?: Record<string, unknown>;
      diagnostic?: RentCastDiagnostic | null;
      max_fetch?: number;
      max_scan?: number;
      rentcast_total_count?: number | null;
      pages_fetched?: number;
      scan_exhausted?: boolean;
      min_confidence?: number;
      query_type?: string;
      endpoints_called?: string[];
      listing_kinds_in_results?: string[];
      owner_lookup?: RentCastOwnerLookupStats | null;
      max_owner_lookups?: number;
    }>;
  },

  async leads(params?: {
    location?: string;
    qualification?: string;
    limit?: number;
    /** Phase A: sale | rental | both — filters saved rows by listing_kind */
    type?: "sale" | "rental" | "both";
  }) {
    const base = scraperBackendApi.getBaseUrl();
    const q = new URLSearchParams();
    if (params?.location) q.set("location", params.location);
    if (params?.qualification) q.set("qualification", params.qualification);
    if (params?.limit != null) q.set("limit", String(params.limit));
    if (params?.type) q.set("type", params.type);
    const qs = q.toString();
    const res = await fetch(`${base}/api/rentcast/leads${qs ? `?${qs}` : ""}`, { cache: "no-store" });
    return parseJson(res) as Promise<{
      success?: boolean;
      error?: string | null;
      listings?: RentCastListing[];
      stats?: RentCastStats;
      total?: number;
      query_type?: string;
      endpoints_called?: string[];
      listing_kinds_in_results?: string[];
      source?: string;
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
    /** Phase F: cap how many rows are skip-traced in this batch */
    max_enrich?: number;
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

  async verify(body: {
    location?: string;
    limit?: number;
    rentcast_ids?: string[];
    likely_only?: boolean;
    min_score?: number;
  }) {
    const base = scraperBackendApi.getBaseUrl();
    const res = await fetch(`${base}/api/rentcast/verify`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return parseJson(res) as Promise<{
      success?: boolean;
      error?: string | null;
      results?: Array<{
        rentcast_id?: string;
        address?: string;
        external_verification_status?: string;
        score_unchanged?: boolean;
        confidence_score?: number;
        listing?: RentCastListing;
      }>;
      listings?: RentCastListing[];
      summary?: RentCastVerifySummary;
      total?: number;
    }>;
  },
};
