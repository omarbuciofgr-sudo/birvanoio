/**
 * Google Jobs (SerpApi) — default: Supabase Edge Function `google-jobs-search` (key in secrets only).
 * Set `VITE_GOOGLE_JOBS_BACKEND=scraper` to use Flask `POST /api/google-jobs/search` instead.
 */

import { supabase } from '@/integrations/supabase/client';
import { scraperBackendApi } from '@/lib/api/scraperBackend';

const USE_LEGACY_SCRAPER = import.meta.env.VITE_GOOGLE_JOBS_BACKEND === 'scraper';

export type GoogleJobDetectedExtensions = {
  posted_at?: string | null;
  schedule_type?: string | null;
} | null;

export type GoogleJobApplyOption = {
  title?: string;
  link?: string;
};

export type GoogleJobItem = {
  title?: string | null;
  company_name?: string | null;
  location?: string | null;
  description?: string | null;
  detected_extensions?: GoogleJobDetectedExtensions;
  apply_options?: GoogleJobApplyOption[] | null;
  job_id?: string | null;
};

export type GoogleJobsSearchResponse = {
  jobs: GoogleJobItem[];
  next_page_token?: string | null;
  serpapi_pagination?: { next_page_token?: string | null };
  error?: string;
  search_metadata?: Record<string, unknown>;
};

export async function searchGoogleJobs(body: Record<string, unknown>): Promise<GoogleJobsSearchResponse> {
  if (USE_LEGACY_SCRAPER) {
    const base = scraperBackendApi.getBaseUrl().replace(/\/$/, '');
    const res = await fetch(`${base}/api/google-jobs/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(body ?? {}),
    });
    const data = (await res.json().catch(() => ({}))) as GoogleJobsSearchResponse;
    if (!res.ok && !data.error) {
      return {
        jobs: [],
        next_page_token: null,
        serpapi_pagination: { next_page_token: null },
        error: `HTTP ${res.status}`,
      };
    }
    return data;
  }

  const { data, error } = await supabase.functions.invoke('google-jobs-search', {
    body: body ?? {},
  });
  if (error) {
    return {
      jobs: [],
      next_page_token: null,
      serpapi_pagination: { next_page_token: null },
      error: error.message,
    };
  }
  return (data ?? {}) as GoogleJobsSearchResponse;
}
