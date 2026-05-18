import { supabase } from '@/integrations/supabase/client';
import { scraperBackendApi } from '@/lib/api/scraperBackend';
import { edgeFetch, resolveEdgeFunctionUrl } from '@/lib/api/supabaseEdgeFetch';
import {
  peopleSearchHasRestrictiveFilters,
  relaxPeopleSearchBody,
  type PeopleSearchRequestBody,
} from '@/lib/api/peopleSearchRequest';

export interface CompanySearchInput {
  industry?: string;
  industries_exclude?: string[];
  employee_ranges?: string[];
  employee_count_min?: number;
  employee_count_max?: number;
  location?: string;
  locations_exclude?: string[];
  keywords?: string;
  keywords_exclude?: string[];
  revenue_range?: string;
  funding_range?: string;
  funding_stage?: string;
  company_types?: string[];
  technologies?: string[];
  sic_codes?: string[];
  naics_codes?: string[];
  buying_intent?: string;
  market_segments?: string[];
  job_posting_filter?: string;
  job_categories?: string[];
  limit?: number;
  page?: number;
}

export interface CompanyResult {
  name: string;
  domain: string;
  /** People search: employer name when the row is a person (used to resolve domain for Enrich). */
  organization_name?: string | null;
  website: string | null;
  linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  annual_revenue: number | null;
  founded_year: number | null;
  description: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  technologies: string[];
  keywords: string[];
  social_profiles?: Record<string, string>;
  phone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  /** People enrichment / Apollo mobile line */
  mobile_phone?: string | null;
  /** Apollo person id from People Search — used for bulk_match / person match enrich */
  apollo_person_id?: string | null;
}

export interface PersonResult {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  headline: string | null;
  seniority: string | null;
  departments: string[];
  organization_name: string | null;
  organization_domain: string | null;
  organization_industry: string | null;
  organization_employee_count: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedin_url: string | null;
  email_status: string | null;
  photo_url: string | null;
  /** When people-search returns contact info, saved to scraped_leads */
  email?: string | null;
  phone?: string | null;
}

export interface JobResult {
  id: string;
  title: string;
  company_name: string;
  company_domain: string | null;
  company_industry: string | null;
  location: string | null;
  employment_type: string | null;
  seniority: string | null;
  description_snippet: string | null;
  posted_at: string | null;
  linkedin_url: string | null;
  apply_url: string | null;
}

export interface IndustrySearchResponse {
  success: boolean;
  companies?: CompanyResult[];
  total?: number;
  pagination?: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
  error?: string;
}

export interface PeopleSearchResponse {
  success: boolean;
  people?: PersonResult[];
  total?: number;
  error?: string;
  /** Hint when results are empty (e.g. after relaxed retry) */
  message?: string;
  providers?: string[];
}

const PRODUCTION_PEOPLE_SEARCH_PROJECT = 'xgcvdduwrvgquurhngzq';

function isLocalDevHost(): boolean {
  if (typeof window === 'undefined') return false;
  const host = window.location.hostname.toLowerCase();
  return host === 'localhost' || host === '127.0.0.1';
}

function useFlaskPeopleSearchEnv(): boolean {
  const raw = (import.meta.env.VITE_USE_FLASK_PEOPLE_SEARCH as string | undefined)?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

async function resolveFlaskPeopleSearchUrl(): Promise<string | null> {
  if (!useFlaskPeopleSearchEnv() && !isLocalDevHost()) return null;
  try {
    const reachable = await scraperBackendApi.isScraperBackendReachable();
    if (!reachable) return null;
    const base = scraperBackendApi.getBaseUrl().replace(/\/+$/, '');
    return `${base}/api/people-search`;
  } catch {
    return null;
  }
}

function resolveEdgePeopleSearchUrl(): string {
  const edgeOverride = (import.meta.env.VITE_PEOPLE_SEARCH_URL as string | undefined)?.trim();
  if (edgeOverride) return edgeOverride.replace(/\/+$/, '');
  return resolveEdgeFunctionUrl('people-search', 'VITE_PEOPLE_SEARCH_URL');
}

/** Edge first (deployed people-search); Flask only when VITE_USE_FLASK_PEOPLE_SEARCH=true. */
async function resolvePeopleSearchPostUrl(): Promise<string> {
  if (useFlaskPeopleSearchEnv()) {
    const flask = await resolveFlaskPeopleSearchUrl();
    if (flask) return flask;
  }

  const edgeUrl = resolveEdgePeopleSearchUrl();
  if (
    import.meta.env.DEV &&
    edgeUrl.includes('supabase.co') &&
    !edgeUrl.includes(PRODUCTION_PEOPLE_SEARCH_PROJECT)
  ) {
    console.warn(
      `[People Search] Edge URL uses a different Supabase project than ${PRODUCTION_PEOPLE_SEARCH_PROJECT}. ` +
        'Set VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY, and VITE_PEOPLE_SEARCH_URL in birvanoio/.env',
    );
  }
  return edgeUrl;
}

function isFlaskPeopleSearchUrl(url: string): boolean {
  return /\/api\/people-search\/?$/i.test(url.replace(/\/+$/, ''));
}

async function postPeopleSearch(
  input: PeopleSearchRequestBody,
  url: string,
): Promise<{ ok: boolean; status: number; raw: PeopleSearchResponse | null }> {
  const isEdge = /supabase\.co\/functions\/v1\//i.test(url);
  if (isEdge) {
    const { ok, status, data } = await edgeFetch<PeopleSearchResponse>('people-search', input, { url });
    return { ok, status, raw: data };
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    cache: 'no-store',
  });
  const raw = (await res.json().catch(() => null)) as PeopleSearchResponse | null;
  return { ok: res.ok, status: res.status, raw };
}

function normalizePeopleSearchResponse(
  raw: PeopleSearchResponse | null,
  ok: boolean,
  status: number,
): PeopleSearchResponse {
  const data = raw ?? { success: false, people: [] };
  if (!ok) {
    return {
      success: false,
      error: data.error || `People search failed (${status || 'network'})`,
      people: [],
    };
  }
  if (data.success === false && data.error) {
    return { success: false, error: data.error, people: [] };
  }
  return {
    ...data,
    success: data.success !== false,
    people: Array.isArray(data.people) ? data.people : [],
  };
}

export interface JobSearchResponse {
  success: boolean;
  jobs?: JobResult[];
  total?: number;
  error?: string;
}

// Common industries for the dropdown
export const INDUSTRIES = [
  { value: 'software', label: 'Software & Technology' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'construction', label: 'Construction' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'restaurants', label: 'Restaurants & Food Service' },
  { value: 'hospitality', label: 'Hospitality & Travel' },
  { value: 'education', label: 'Education' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'transportation', label: 'Transportation & Logistics' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'entertainment', label: 'Entertainment & Media' },
  { value: 'nonprofit', label: 'Non-Profit' },
];

// Employee count ranges
export const EMPLOYEE_RANGES = [
  { value: '1-10', label: '1-10 employees', min: 1, max: 10 },
  { value: '11-50', label: '11-50 employees', min: 11, max: 50 },
  { value: '51-200', label: '51-200 employees', min: 51, max: 200 },
  { value: '201-500', label: '201-500 employees', min: 201, max: 500 },
  { value: '501-1000', label: '501-1000 employees', min: 501, max: 1000 },
  { value: '1001-5000', label: '1001-5000 employees', min: 1001, max: 5000 },
  { value: '5001+', label: '5000+ employees', min: 5001, max: 999999 },
];

export const industrySearchApi = {
  /**
   * Company search: Apollo via Flask `POST /api/company-search` (alias: `/api/industry-search`).
   * Does not use Supabase Edge — if you see "Edge Function non-2xx", deploy this frontend or hard-refresh.
   */
  async searchCompanies(input: CompanySearchInput): Promise<IndustrySearchResponse> {
    const base = scraperBackendApi.getBaseUrl();
    const post = (path: string) =>
      fetch(`${base}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
        cache: 'no-store',
      });
    try {
      // Prefer /api/company-search; fall back to /api/industry-search (older Flask builds / no restart).
      let res = await post('/api/company-search');
      if (res.status === 404) {
        res = await post('/api/industry-search');
      }
      const raw = (await res.json().catch(() => ({}))) as IndustrySearchResponse;
      if (!res.ok) {
        return {
          success: false,
          error: raw.error || `Company search failed (${res.status})`,
          companies: [],
        };
      }
      if (raw?.success === false && raw.error) {
        return { success: false, error: raw.error, companies: [] };
      }
      return raw;
    } catch (e) {
      console.error('Industry search error:', e);
      return {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : 'Scraper backend unreachable — start api_server.py and set APOLLO_API_KEY in backend .env',
        companies: [],
      };
    }
  },

  /**
   * Search for people by title, seniority, company, location, etc.
   */
  async searchPeople(input: PeopleSearchRequestBody): Promise<PeopleSearchResponse> {
    try {
      const primaryUrl = await resolvePeopleSearchPostUrl();
      let url = primaryUrl;
      let { ok, status, raw } = await postPeopleSearch(input, url);
      let result = normalizePeopleSearchResponse(raw, ok, status);

      const restrictive = peopleSearchHasRestrictiveFilters(input);
      if (result.people && result.people.length === 0 && restrictive) {
        const relaxed = relaxPeopleSearchBody(input);
        const retry = await postPeopleSearch(relaxed, url);
        const relaxedResult = normalizePeopleSearchResponse(retry.raw, retry.ok, retry.status);
        if (relaxedResult.people && relaxedResult.people.length > 0) {
          return {
            ...relaxedResult,
            message:
              'Results found after omitting past company, past title, exclude, profile keywords, and technologies.',
          };
        }
        result = relaxedResult;
      }

      // Local Flask can return zero rows while deployed Edge (same Apollo key) still works.
      if (
        result.people &&
        result.people.length === 0 &&
        isFlaskPeopleSearchUrl(url) &&
        !useFlaskPeopleSearchEnv()
      ) {
        const edgeUrl = resolveEdgePeopleSearchUrl();
        if (edgeUrl !== url) {
          const edgeTry = await postPeopleSearch(input, edgeUrl);
          const edgeResult = normalizePeopleSearchResponse(edgeTry.raw, edgeTry.ok, edgeTry.status);
          if (edgeResult.people && edgeResult.people.length > 0) {
            return edgeResult;
          }
        }
      }

      return result;
    } catch (e) {
      console.error('People search error:', e);
      return {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : 'People search failed — start api_server.py locally or set VITE_PEOPLE_SEARCH_URL on Supabase.',
        people: [],
      };
    }
  },

  /**
   * Search for jobs/positions
   */
  async searchJobs(input: {
    job_titles?: string[];
    exclude_job_titles?: string[];
    job_description_keywords?: string[];
    industries?: string[];
    companies?: string[];
    locations?: string[];
    employment_types?: string[];
    seniority?: string[];
    recruiter_keywords?: string[];
    posted_within?: string;
    limit?: number;
  }): Promise<JobSearchResponse> {
    const { data, error } = await supabase.functions.invoke('job-search', {
      body: input,
    });

    if (error) {
      console.error('Job search error:', error);
      return { success: false, error: error.message };
    }

    const raw = data as JobSearchResponse & { success?: boolean; error?: string };
    if (raw && raw.success === false) {
      return { success: false, error: raw.error || 'Job search rejected', jobs: [] };
    }

    return data as JobSearchResponse;
  },

  /**
   * Save search results as scraped leads
   */
  async saveAsLeads(companies: CompanyResult[], jobId?: string): Promise<{ saved: number; errors: number }> {
    // ... keep existing code
    let saved = 0;
    let errors = 0;

    for (const company of companies) {
      try {
        const { error } = await supabase.from('scraped_leads').insert({
          domain: company.domain,
          source_url: company.website || company.linkedin_url,
          source_type: 'industry_search',
          lead_type: 'company',
          status: 'new',
          job_id: jobId || null,
          full_name: company.name || null,
          best_email: company.email || null,
          all_emails: company.email ? [company.email] : [],
          best_phone: company.phone || null,
          all_phones: company.phone ? [company.phone] : [],
          schema_data: {
            company_name: company.name,
            industry: company.industry,
            employee_count: company.employee_count,
            employee_range: company.employee_range,
            annual_revenue: company.annual_revenue,
            founded_year: company.founded_year,
            description: company.description,
            technologies: company.technologies,
            keywords: company.keywords,
            headquarters_city: company.headquarters_city,
            headquarters_state: company.headquarters_state,
            headquarters_country: company.headquarters_country,
          },
          linkedin_search_url: company.linkedin_url,
        });

        if (error) {
          console.error('Error saving company:', error);
          errors++;
        } else {
          saved++;
        }
      } catch (e) {
        console.error('Error saving company:', e);
        errors++;
      }
    }

    return { saved, errors };
  },
};
