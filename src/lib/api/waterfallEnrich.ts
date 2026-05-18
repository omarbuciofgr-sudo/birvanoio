import { resolveEdgeFunctionUrl, edgeHeaders } from '@/lib/api/supabaseEdgeFetch';

export type WaterfallEnrichBody = {
  domain?: string;
  company_name?: string;
  organization_name?: string;
  /** Scout People Search → "person"; Company/Jobs → "company" */
  enrichment_target?: 'company' | 'person';
  /** strict_b2b_v1 = Hunter→RR→Snov→ZB + Lusha→RR→PDL (Edge). Omit for legacy waterfall fields (e.g. industry). */
  enrichment_mode?: 'strict_b2b_v1' | string;
  linkedin_url?: string;
  person_display_name?: string;
  apollo_person_id?: string;
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

export type InvokeWaterfallOptions = {
  signal?: AbortSignal;
  /** Retries on HTTP 429 (rate limit) with exponential backoff. */
  maxRetriesOn429?: number;
};

function resolveWaterfallEnrichPostUrl(): string {
  return resolveEdgeFunctionUrl('data-waterfall-enrich', 'VITE_WATERFALL_ENRICH_URL');
}

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

/** Scout footer / Quick enrich → Supabase Edge `data-waterfall-enrich` only. */
export async function invokeWaterfallEnrich(
  body: WaterfallEnrichBody,
  opts?: InvokeWaterfallOptions,
): Promise<{ data: WaterfallEnrichResponse | null; error: Error | null; status?: number }> {
  const url = resolveWaterfallEnrichPostUrl();
  const max429 = opts?.maxRetriesOn429 ?? 0;
  let attempt = 0;

  while (true) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: edgeHeaders(),
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
            : `Enrichment API HTTP ${res.status} — deploy data-waterfall-enrich and set vendor secrets on Supabase.`;
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
