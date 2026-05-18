import { scraperBackendApi } from '@/lib/api/scraperBackend';

/**
 * Strip mistaken path suffixes from VITE_SCRAPER_BACKEND_URL (e.g. …/waterfall-enrich → root)
 * so we always POST to Flask `POST /api/waterfall-enrich` on Railway/local.
 */
function normalizeScraperRootForWaterfall(baseRaw: string): string {
  let base = baseRaw.trim().replace(/\/+$/, '');
  // Strip mistaken path suffixes (repeat until stable — handles …/api/waterfall-enrich/waterfall-enrich etc.)
  for (let i = 0; i < 4; i++) {
    const prev = base;
    base = base.replace(/\/api\/waterfall-enrich$/i, '');
    base = base.replace(/\/waterfall-enrich$/i, '');
    base = base.replace(/\/api$/i, '');
    base = base.replace(/\/+$/, '');
    if (base === prev) break;
  }
  return base;
}

/**
 * Scout must call the Flask route `POST /api/waterfall-enrich` (person + company, org→domain).
 * If `VITE_SCRAPER_BACKEND_URL` points at `*.supabase.co/functions/...`, the Edge function
 * `data-waterfall-enrich` returns 400 "Domain is required" for people rows without a domain.
 */
function resolveWaterfallEnrichPostUrl(): string {
  let base = normalizeScraperRootForWaterfall(scraperBackendApi.getBaseUrl());
  const host =
    typeof window !== 'undefined' ? window.location.hostname.toLowerCase() : '';
  const isLocalDev = host === 'localhost' || host === '127.0.0.1';

  if (isLocalDev && /supabase\.co/i.test(base) && /\/functions\//i.test(base)) {
    base = normalizeScraperRootForWaterfall('http://localhost:8080');
  }

  // Common typo: …/functions/v1/waterfall-enrich (404) — real slug is data-waterfall-enrich
  if (/supabase\.co\/functions\/v1\/waterfall-enrich$/i.test(base)) {
    base = base.replace(/\/waterfall-enrich$/i, '/data-waterfall-enrich');
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
  /** strict_b2b_v1 = Hunter→RR→Snov→ZB + Lusha→RR→PDL only (Flask/Edge). Omit for legacy waterfall on Edge-only deployments. */
  enrichment_mode?: 'strict_b2b_v1' | string;
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
export type InvokeWaterfallOptions = {
  signal?: AbortSignal;
  /** Retries on HTTP 429 (rate limit) with exponential backoff. */
  maxRetriesOn429?: number;
};

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Aborted', 'AbortError'));
      return;
    }
    const t = setTimeout(resolve, ms);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(t);
        reject(new DOMException('Aborted', 'AbortError'));
      },
      { once: true },
    );
  });
}

export async function invokeWaterfallEnrich(
  body: WaterfallEnrichBody,
  opts?: InvokeWaterfallOptions
): Promise<{ data: WaterfallEnrichResponse | null; error: Error | null; status?: number }> {
  const url = resolveWaterfallEnrichPostUrl();
  const max429 = opts?.maxRetriesOn429 ?? 0;
  let attempt = 0;

  while (true) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        cache: 'no-store',
        signal: opts?.signal,
      });
      const json = (await res.json().catch(() => null)) as WaterfallEnrichResponse | null;

      if (res.status === 429 && attempt < max429) {
        const delay = 1000 * Math.pow(2, attempt);
        attempt += 1;
        await sleep(delay, opts?.signal);
        continue;
      }

      if (!res.ok) {
        const msg =
          json && typeof json === 'object' && json.error
            ? String(json.error)
            : `Enrichment API HTTP ${res.status} — is api_server.py running and /api/waterfall-enrich deployed?`;
        return { data: json ?? null, error: new Error(msg), status: res.status };
      }
      if (!json || typeof json !== 'object' || json.success !== true) {
        const msg =
          json && typeof json === 'object' && json.error
            ? String(json.error)
            : 'Unexpected response from enrichment API (missing success: true).';
        return { data: json, error: new Error(msg), status: res.status };
      }
      return { data: json, error: null, status: res.status };
    } catch (e) {
      return {
        data: null,
        error: e instanceof Error ? e : new Error(String(e)),
      };
    }
  }
}
