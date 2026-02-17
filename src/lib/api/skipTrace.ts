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

const PRODUCTION_BACKEND = "https://resplendent-empathy-production.up.railway.app";
const FRONTEND_ORIGINS = ["https://www.brivano.io", "https://brivano.io"];

const getBackendUrl = (): string => {
  const url = import.meta.env.VITE_SCRAPER_BACKEND_URL;
  if (typeof url === "string" && url.trim()) return url.trim().replace(/\/$/, "");
  if (typeof window !== "undefined" && FRONTEND_ORIGINS.includes(window.location.origin))
    return PRODUCTION_BACKEND;
  return "http://localhost:8080";
};

export const skipTraceApi = {
  /**
   * Perform skip tracing on a property address to find owner contact info.
   * Calls the scraper backend (BatchData), not Supabase Edge Function.
   */
  async lookupOwner(input: SkipTraceInput): Promise<SkipTraceResult> {
    const base = getBackendUrl();
    const res = await fetch(`${base}/api/skip-trace`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('Skip trace error:', res.status, data);
      return {
        success: false,
        error: (data as { error?: string }).error || res.statusText || 'Skip trace failed',
      };
    }

    return data as SkipTraceResult;
  },

  /**
   * Batch skip trace multiple addresses
   * Returns results in the same order as input
   */
  async batchLookup(addresses: SkipTraceInput[]): Promise<SkipTraceResult[]> {
    const results = await Promise.all(
      addresses.map(addr => this.lookupOwner(addr))
    );
    return results;
  },

  /**
   * Helper to parse a full address string into components
   */
  parseAddress(fullAddress: string): SkipTraceInput {
    const parts = fullAddress.split(',').map(p => p.trim());
    
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
