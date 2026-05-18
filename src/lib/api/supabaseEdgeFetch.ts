import { resolveSupabaseAnonKey, resolveSupabaseUrl } from '@/integrations/supabase/constants';

function edgeHeaders(): Record<string, string> {
  const anon = resolveSupabaseAnonKey();
  return {
    'Content-Type': 'application/json',
    apikey: anon,
    Authorization: `Bearer ${anon}`,
  };
}

/** Full URL override, or `${supabaseUrl}/functions/v1/${slug}`. */
export function resolveEdgeFunctionUrl(
  slug: string,
  envOverrideKey: 'VITE_PEOPLE_SEARCH_URL' | 'VITE_WATERFALL_ENRICH_URL',
): string {
  const override = (import.meta.env[envOverrideKey] as string | undefined)?.trim();
  if (override) return override.replace(/\/+$/, '');
  const base = resolveSupabaseUrl().replace(/\/+$/, '');
  return `${base}/functions/v1/${slug}`;
}

export type EdgeFetchResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
};

/**
 * POST to a Supabase Edge Function with anon apikey headers.
 */
export async function edgeFetch<T = unknown>(
  slug: string,
  body: unknown,
  opts?: { url?: string; signal?: AbortSignal },
): Promise<EdgeFetchResult<T>> {
  const url =
    opts?.url ??
    `${resolveSupabaseUrl().replace(/\/+$/, '')}/functions/v1/${slug.replace(/^\//, '')}`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: edgeHeaders(),
      body: JSON.stringify(body),
      cache: 'no-store',
      signal: opts?.signal,
    });
    const data = (await res.json().catch(() => null)) as T | null;
    return { ok: res.ok, status: res.status, data };
  } catch (e) {
    console.error(`Edge ${slug} error:`, e);
    return { ok: false, status: 0, data: null };
  }
}

export { edgeHeaders };
