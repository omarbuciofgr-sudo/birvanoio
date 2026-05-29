import { supabase } from '@/integrations/supabase/client';
import { scraperBackendApi } from '@/lib/api/scraperBackend';
import { employeeCountToRange } from '@/lib/peopleExport';
import {
  formatPeopleSearchEmptyError,
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
  /** People search: job title from provider */
  job_title?: string | null;
  /** People search: LinkedIn headline */
  headline?: string | null;
  /** People search: seniority level */
  seniority?: string | null;
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
  /** Backend dropped these filter keys to return matches */
  filters_relaxed?: string[];
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
    const base = scraperBackendApi.getBaseUrl();
    const hadRestrictiveFilters = peopleSearchHasRestrictiveFilters(input);
    const attempts: PeopleSearchRequestBody[] = [input];
    if (hadRestrictiveFilters) {
      attempts.push(relaxPeopleSearchBody(input));
    }

    try {
      let last: PeopleSearchResponse = { success: true, people: [], total: 0 };

      for (const body of attempts) {
        const res = await fetch(`${base}/api/people-search`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
          cache: 'no-store',
        });
        const raw = (await res.json().catch(() => ({}))) as PeopleSearchResponse;
        if (!res.ok) {
          return {
            success: false,
            error: raw.error || `People search failed (${res.status})`,
            people: [],
          };
        }
        if (raw?.success === false && raw.error) {
          return { success: false, error: raw.error, people: [] };
        }
        last = raw;
        if (Array.isArray(raw.people) && raw.people.length > 0) {
          return raw;
        }
      }

      if (!last.people?.length) {
        return {
          ...last,
          success: false,
          error: formatPeopleSearchEmptyError(last.message ?? last.error, hadRestrictiveFilters, ['apollo']),
        };
      }
      return last;
    } catch (e) {
      console.error('People search error:', e);
      return {
        success: false,
        error:
          e instanceof Error
            ? e.message
            : 'Scraper backend unreachable — start api_server.py and set APOLLO_API_KEY in backend .env',
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
            organization_name: company.organization_name,
            job_title: company.job_title,
            headline: company.headline,
            seniority: company.seniority,
            industry: company.industry,
            employee_count: company.employee_count,
            employee_range: company.employee_range || employeeCountToRange(company.employee_count) || null,
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
