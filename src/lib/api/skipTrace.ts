import { supabase } from '@/integrations/supabase/client';

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

/**
 * Skip trace uses Supabase Edge Function (BatchData). The Flask scraper backend
 * does not expose /api/skip-trace in all deployments; the edge function is always available with secrets.
 *
 * Important: `supabase.functions.invoke` uses the shared fetch helper, which falls back to the
 * **anon key** as `Authorization: Bearer` when there is no session. The edge function only
 * accepts a **user** JWT, so we must pass the session access token explicitly and never invoke
 * with the anon key as Bearer (that always yields 401 from the function).
 */
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

export const skipTraceApi = {
  async lookupOwner(input: SkipTraceInput): Promise<SkipTraceResult> {
    const accessToken = await getUserAccessTokenForEdgeFunction();
    if (!accessToken) {
      return {
        success: false,
        error: 'Please sign in to use skip trace. If you are signed in, refresh the page and try again.',
      };
    }

    const { data, error } = await supabase.functions.invoke('tracerfy-skip-trace', {
      body: input,
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    if (error) {
      console.error('Skip trace invoke error:', error);
      return {
        success: false,
        error: error.message || 'Skip trace failed',
      };
    }

    if (data && typeof data === 'object' && 'success' in data) {
      return data as SkipTraceResult;
    }

    return { success: false, error: 'Unexpected skip trace response' };
  },

  async batchLookup(addresses: SkipTraceInput[]): Promise<SkipTraceResult[]> {
    return Promise.all(addresses.map((addr) => this.lookupOwner(addr)));
  },

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

    return { address: fullAddress, fullAddress };
  },
};
