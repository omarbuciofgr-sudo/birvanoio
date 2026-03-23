import { supabase } from '@/integrations/supabase/client';

// ── Technographics Search ──
export interface TechSearchInput {
  technologies: string[];
  industry?: string;
  location?: string;
  employee_ranges?: string[];
  limit?: number;
}

export interface TechSearchResponse {
  success: boolean;
  companies?: Array<{
    name: string;
    domain: string;
    website: string | null;
    linkedin_url: string | null;
    industry: string | null;
    employee_count: number | null;
    description: string | null;
    headquarters_city: string | null;
    headquarters_state: string | null;
    headquarters_country: string | null;
    technologies: string[];
    source_provider?: string;
  }>;
  total?: number;
  error?: string;
}

// ── Bulk Email Finder ──
export interface EmailFinderContact {
  first_name: string;
  last_name: string;
  domain: string;
  company?: string;
}

export interface EmailFinderResult {
  first_name: string;
  last_name: string;
  domain: string;
  email: string | null;
  confidence: number;
  source: string;
  verified: boolean;
}

export interface EmailFinderResponse {
  success: boolean;
  results?: EmailFinderResult[];
  summary?: { total: number; found: number; not_found: number };
  error?: string;
}

// ── Company News Signals ──
export interface NewsSignal {
  company_name: string;
  domain: string;
  signal_type: 'funding' | 'leadership_change' | 'hiring_surge' | 'acquisition' | 'product_launch' | 'expansion' | 'layoff' | 'partnership';
  headline: string;
  summary: string;
  source_url: string | null;
  detected_at: string;
  confidence: number;
}

export interface NewsSignalsResponse {
  success: boolean;
  signals?: NewsSignal[];
  total?: number;
  error?: string;
}

// ── Domain to Company ──
export interface DomainCompanyProfile {
  domain: string;
  name: string | null;
  industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  founded_year: number | null;
  description: string | null;
  linkedin_url: string | null;
  website: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  technologies: string[];
  annual_revenue: number | null;
  phone: string | null;
  logo_url: string | null;
  source_providers: string[];
}

export interface DomainResolveResponse {
  success: boolean;
  companies?: DomainCompanyProfile[];
  total?: number;
  resolved?: number;
  error?: string;
}

// ── Lookalike Search ──
export interface LookalikeCompany {
  name: string;
  domain: string;
  website: string | null;
  linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  description: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  technologies: string[];
  similarity_score: number;
  source_provider: string;
}

export interface LookalikeResponse {
  success: boolean;
  seed_company?: { name: string; domain: string; industry: string | null; employee_count: number | null };
  companies?: LookalikeCompany[];
  total?: number;
  error?: string;
}

export const b2bToolsApi = {
  /** Search companies by tech stack */
  async searchByTechnology(input: TechSearchInput): Promise<TechSearchResponse> {
    const { data, error } = await supabase.functions.invoke('technographics-search', { body: input });
    if (error) return { success: false, error: error.message };
    return data as TechSearchResponse;
  },

  /** Find emails for a list of contacts */
  async bulkFindEmails(contacts: EmailFinderContact[], verify = false): Promise<EmailFinderResponse> {
    const { data, error } = await supabase.functions.invoke('bulk-email-finder', {
      body: { contacts, verify },
    });
    if (error) return { success: false, error: error.message };
    return data as EmailFinderResponse;
  },

  /** Get news signals for companies */
  async getCompanySignals(
    companies: Array<{ name: string; domain: string }>,
    signalTypes?: string[]
  ): Promise<NewsSignalsResponse> {
    const { data, error } = await supabase.functions.invoke('company-news-signals', {
      body: { companies, signal_types: signalTypes },
    });
    if (error) return { success: false, error: error.message };
    return data as NewsSignalsResponse;
  },

  /** Resolve domains to company profiles */
  async resolveDomainsToCompanies(domains: string[]): Promise<DomainResolveResponse> {
    const { data, error } = await supabase.functions.invoke('domain-to-company', { body: { domains } });
    if (error) return { success: false, error: error.message };
    return data as DomainResolveResponse;
  },

  /** Find companies similar to a given company */
  async findLookalikes(domain: string, limit = 25): Promise<LookalikeResponse> {
    const { data, error } = await supabase.functions.invoke('lookalike-search', {
      body: { domain, limit },
    });
    if (error) return { success: false, error: error.message };
    return data as LookalikeResponse;
  },
};
