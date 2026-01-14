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

export const skipTraceApi = {
  /**
   * Perform skip tracing on a property address to find owner contact info
   * Cost: ~$0.009 - $0.02 per lookup via Tracerfy
   */
  async lookupOwner(input: SkipTraceInput): Promise<SkipTraceResult> {
    const { data, error } = await supabase.functions.invoke('tracerfy-skip-trace', {
      body: input,
    });

    if (error) {
      console.error('Skip trace error:', error);
      return { success: false, error: error.message };
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
