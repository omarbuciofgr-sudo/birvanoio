import { scraperBackendApi } from '@/lib/api/scraperBackend';

/**
 * Scout must call the Flask route `POST /api/waterfall-enrich` (person + company, org→domain).
 * If `VITE_SCRAPER_BACKEND_URL` points at `*.supabase.co/functions/...`, the Edge function
 * `data-waterfall-enrich` returns 400 "Domain is required" for people rows without a domain.
 */
function resolveWaterfallEnrichPostUrl(): string {
  let base = scraperBackendApi.getBaseUrl().replace(/\/$/, '');
  const host =
    typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isLocalDev = host === 'localhost' || host === '127.0.0.1';

  if (isLocalDev && /supabase\.co/i.test(base) && /\/functions\//i.test(base)) {
    base = 'http://localhost:8080';
  }

  if (/\/functions\/v1\/[\w-]+$/i.test(base)) {
    return base;
  }

  return `${base}/api/waterfall-enrich`;
}

export type WaterfallEnrichBody = {
  domain?: string;
  company_name?: string;
  organization_name?: string;
  /** Scout People Search → "person"; Company/Jobs → "company" */
  enrichment_target?: 'company' | 'person';
  linkedin_url?: string;
  person_display_name?: string;
  target_titles?: string[];
  enrich_fields?: string[];
  intent_goals?: string[];
  custom_goal?: string;
};

export type WaterfallEnrichResponse = {
  success: boolean;
  error?: string;
  data?: Record<string, unknown> | null;
  is_complete?: boolean;
  providers_used?: string[];
};

/**
 * Company contact enrichment via Flask `/api/waterfall-enrich` (no Supabase Edge Function).
 * Return shape matches `supabase.functions.invoke`: `{ data, error }`.
 */
export async function invokeWaterfallEnrich(
  body: WaterfallEnrichBody
): Promise<{ data: WaterfallEnrichResponse | null; error: Error | null }> {
  const url = resolveWaterfallEnrichPostUrl();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
    const json = (await res.json().catch(() => null)) as WaterfallEnrichResponse | null;
    if (!res.ok) {
      const msg =
        json && typeof json === 'object' && json.error
          ? String(json.error)
          : `Enrichment API HTTP ${res.status} — is api_server.py running and /api/waterfall-enrich deployed?`;
      return { data: json ?? null, error: new Error(msg) };
    }
    if (!json || typeof json !== 'object' || json.success !== true) {
      const msg =
        json && typeof json === 'object' && json.error
          ? String(json.error)
          : 'Unexpected response from enrichment API (missing success: true).';
      return { data: json, error: new Error(msg) };
    }
    return { data: json, error: null };
  } catch (e) {
    return {
      data: null,
      error: e instanceof Error ? e : new Error(String(e)),
    };
  }
}
