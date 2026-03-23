import { FunctionsHttpError } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { scraperBackendApi } from '@/lib/api/scraperBackend';

export interface SkipTraceInput {
  address: string;
  city?: string;
  state?: string;
  zip?: string;
  fullAddress?: string;
}

export interface SkipTraceResult {
  success: boolean;
  data?: {
    fullName: string | null;
    firstName: string | null;
    lastName: string | null;
    phones: Array<{
      number: string;
      type: string;
      lineType?: string;
    }>;
    emails: Array<{
      address: string;
      type?: string;
    }>;
    mailingAddress?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    propertyAddress?: {
      street: string;
      city: string;
      state: string;
      zip: string;
    };
    confidence?: number;
  };
  error?: string;
  message?: string;
}

const SKIP_TRACE_BACKEND_TIMEOUT_MS = 35000;

/**
 * Scraper backend (Railway Flask) runs BatchData with BATCHDATA_API_KEY on the server — no Supabase Edge Function required.
 * Returns null if the route is missing, times out, or the response is not valid JSON with `success`.
 */
async function lookupViaScraperBackend(input: SkipTraceInput): Promise<SkipTraceResult | null> {
  const base = scraperBackendApi.getBaseUrl();
  const url = `${base}/api/skip-trace`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SKIP_TRACE_BACKEND_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
      mode: 'cors',
      credentials: 'omit',
      signal: controller.signal,
    });
    if (res.status === 404) return null;
    const data = (await res.json().catch(() => null)) as SkipTraceResult | null;
    if (data && typeof data === 'object' && typeof data.success === 'boolean') {
      return data;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function getUserAccessTokenForEdgeFunction(): Promise<string | null> {
  const {
    data: { session: first },
  } = await supabase.auth.getSession();
  if (first?.access_token) return first.access_token;

  const {
    data: { session: refreshed },
  } = await supabase.auth.refreshSession();
  return refreshed?.access_token ?? null;
}

async function lookupViaSupabaseEdgeFunction(
  input: SkipTraceInput,
  accessToken: string
): Promise<SkipTraceResult> {
  const { data, error } = await supabase.functions.invoke('tracerfy-skip-trace', {
    body: input,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (error) {
    console.error('Skip trace invoke error:', error);
    let message = error instanceof Error ? error.message : 'Skip trace failed';
    if (error instanceof FunctionsHttpError && error.context) {
      try {
        const body = (await error.context.json()) as { error?: string; message?: string };
        if (typeof body?.error === 'string' && body.error.trim()) message = body.error;
        else if (typeof body?.message === 'string' && body.message.trim()) message = body.message;
      } catch {
        /* response body not JSON */
      }
    }
    return { success: false, error: message };
  }

  if (data && typeof data === 'object' && 'success' in data) {
    return data as SkipTraceResult;
  }

  return { success: false, error: 'Unexpected skip trace response' };
}

/**
 * Order: (1) Flask/Railway `POST /api/skip-trace` with server-side BATCHDATA_API_KEY.
 * (2) Supabase Edge Function `tracerfy-skip-trace` if the backend is unreachable or old (no route).
 */
export const skipTraceApi = {
  async lookupOwner(input: SkipTraceInput): Promise<SkipTraceResult> {
    const fromBackend = await lookupViaScraperBackend(input);
    if (fromBackend !== null) return fromBackend;

    const accessToken = await getUserAccessTokenForEdgeFunction();
    if (!accessToken) {
      return {
        success: false,
        error:
          'Skip trace could not reach the scraper backend (check it is running and has BATCHDATA_API_KEY). Sign in to fall back to cloud skip trace.',
      };
    }

    return lookupViaSupabaseEdgeFunction(input, accessToken);
  },

  async batchLookup(addresses: SkipTraceInput[]): Promise<SkipTraceResult[]> {
    return Promise.all(addresses.map((addr) => this.lookupOwner(addr)));
  },

  /**
   * FSBO.com (and some scrapers) use a single line with no commas, e.g.
   * "7313 North Oleander Avenue Chicago IL 60631" from the listing URL slug.
   * BatchData needs street / city / state / zip — comma-only parsing leaves everything in `street`.
   */
  parseAddress(fullAddress: string): SkipTraceInput {
    const parts = fullAddress.split(',').map((p) => p.trim());

    if (parts.length >= 3) {
      const stateZip = parts[parts.length - 1].trim().split(/\s+/);
      return {
        address: parts[0],
        city: parts[1],
        state: stateZip[0] || '',
        zip: stateZip.length > 1 ? stateZip[stateZip.length - 1] : '',
        fullAddress,
      };
    }

    const spaceParsed = tryParseSpaceSeparatedUsAddress(fullAddress);
    if (spaceParsed) return spaceParsed;

    return { address: fullAddress, fullAddress };
  },
};

/** Match "... City ST 12345" at end (US), split street vs city heuristically for two-word cities. */
function tryParseSpaceSeparatedUsAddress(full: string): SkipTraceInput | null {
  const t = full.trim().replace(/\s+/g, ' ');
  const m = t.match(/\s+([A-Za-z]{2})\s+(\d{5})(?:-\d{4})?\s*$/i);
  if (!m || m.index === undefined) return null;
  const state = m[1].toUpperCase();
  const zip = m[2];
  const before = t.slice(0, m.index).trim();
  const words = before.split(/\s+/);
  if (words.length < 2) return null;

  const multiWordCityEndings = new Set([
    'antonio',
    'angeles',
    'diego',
    'paul',
    'worth',
    'brook',
    'island',
    'beach',
    'falls',
    'hills',
    'springs',
    'city',
    'plano',
    'collins',
    'wayne',
    'orleans',
  ]);
  const twoWordCityPrefixes = new Set([
    'new',
    'fort',
    'west',
    'east',
    'north',
    'south',
    'lake',
    'little',
    'el',
    'st',
    'san',
    'los',
    'las',
    'des',
    'la',
  ]);

  const lastW = words[words.length - 1].toLowerCase();
  const secondLast = words.length >= 2 ? words[words.length - 2].toLowerCase().replace(/\.$/, '') : '';
  let cityWords = 1;
  if (words.length >= 3 && (multiWordCityEndings.has(lastW) || twoWordCityPrefixes.has(secondLast))) {
    cityWords = 2;
  }

  const city = words.slice(-cityWords).join(' ');
  const street = words.slice(0, -cityWords).join(' ');
  if (!street) return null;

  return { address: street, city, state, zip, fullAddress: full };
}
