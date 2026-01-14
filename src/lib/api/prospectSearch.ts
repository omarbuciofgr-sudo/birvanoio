import { supabase } from '@/integrations/supabase/client';

/**
 * Prospect Search API - ZoomInfo-style lead prospecting
 * 
 * This combines Apollo.io's people database with Firecrawl web search
 * to find decision-makers in any niche and location.
 */

export interface ProspectSearchParams {
  // What niche/industry
  industry?: string;         // e.g., "Roofing", "Real Estate", "Software"
  keywords?: string[];       // Additional keywords for search
  
  // Where
  location?: {
    city?: string;
    state?: string;
    country?: string;
  };
  
  // Who (target contact)
  targetTitles?: string[];   // e.g., ["Owner", "CEO", "Founder"]
  seniorityLevels?: string[]; // e.g., ["owner", "c_suite", "vp", "director"]
  departments?: string[];    // e.g., ["executive", "sales", "operations"]
  
  // Company filters
  employeeCountMin?: number;
  employeeCountMax?: number;
  revenueMin?: number;
  revenueMax?: number;
  
  // Search settings
  searchType?: 'apollo_search' | 'web_discovery' | 'hybrid';
  limit?: number;
  enrichWebResults?: boolean;
}

export interface ProspectResult {
  // Contact
  full_name: string | null;
  email: string | null;
  phone: string | null;
  mobile_phone: string | null;
  direct_phone: string | null;
  job_title: string | null;
  seniority_level: string | null;
  department: string | null;
  linkedin_url: string | null;
  
  // Company
  company_name: string | null;
  company_domain: string | null;
  company_website: string | null;
  company_linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  annual_revenue: number | null;
  founded_year: number | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  
  // Source
  source: string;
  confidence_score: number;
  enrichment_providers: string[];
}

export interface ProspectSearchResponse {
  success: boolean;
  data?: ProspectResult[];
  total?: number;
  search_params?: {
    industry: string;
    location: { city?: string; state?: string };
    target_titles: string[];
    search_type: string;
  };
  error?: string;
}

// Common US industries for autocomplete
export const INDUSTRIES = [
  'Roofing',
  'HVAC',
  'Plumbing',
  'Electrical',
  'Construction',
  'Real Estate',
  'Insurance',
  'Landscaping',
  'Solar',
  'Home Services',
  'Auto Repair',
  'Medical',
  'Dental',
  'Legal',
  'Accounting',
  'Marketing',
  'Software',
  'SaaS',
  'E-commerce',
  'Manufacturing',
  'Retail',
  'Restaurant',
  'Hospitality',
  'Financial Services',
  'Consulting',
];

// Common decision-maker titles
export const DECISION_MAKER_TITLES = [
  'Owner',
  'Founder',
  'CEO',
  'President',
  'Partner',
  'Managing Director',
  'General Manager',
  'COO',
  'CFO',
  'CTO',
  'VP of Sales',
  'VP of Marketing',
  'VP of Operations',
  'Director',
  'Manager',
];

// Seniority levels for filtering
export const SENIORITY_LEVELS = [
  { value: 'owner', label: 'Owner/Partner' },
  { value: 'founder', label: 'Founder' },
  { value: 'c_suite', label: 'C-Suite (CEO, CTO, etc.)' },
  { value: 'vp', label: 'VP Level' },
  { value: 'director', label: 'Director' },
  { value: 'manager', label: 'Manager' },
];

// US States for location picker
export const US_STATES = [
  'Alabama', 'Alaska', 'Arizona', 'Arkansas', 'California', 'Colorado', 'Connecticut',
  'Delaware', 'Florida', 'Georgia', 'Hawaii', 'Idaho', 'Illinois', 'Indiana', 'Iowa',
  'Kansas', 'Kentucky', 'Louisiana', 'Maine', 'Maryland', 'Massachusetts', 'Michigan',
  'Minnesota', 'Mississippi', 'Missouri', 'Montana', 'Nebraska', 'Nevada', 'New Hampshire',
  'New Jersey', 'New Mexico', 'New York', 'North Carolina', 'North Dakota', 'Ohio',
  'Oklahoma', 'Oregon', 'Pennsylvania', 'Rhode Island', 'South Carolina', 'South Dakota',
  'Tennessee', 'Texas', 'Utah', 'Vermont', 'Virginia', 'Washington', 'West Virginia',
  'Wisconsin', 'Wyoming',
];

export const prospectSearchApi = {
  /**
   * Search for prospects/decision-makers by industry, location, and criteria
   * This is the ZoomInfo-style search that finds contacts directly
   */
  async search(params: ProspectSearchParams): Promise<ProspectSearchResponse> {
    const { data, error } = await supabase.functions.invoke('prospect-search', {
      body: params,
    });

    if (error) {
      console.error('Prospect search error:', error);
      return { success: false, error: error.message };
    }

    return data as ProspectSearchResponse;
  },

  /**
   * Quick search with simple string input
   * Parses "roofing companies in Houston, TX" style queries
   */
  async quickSearch(query: string, limit: number = 25): Promise<ProspectSearchResponse> {
    const parsed = this.parseSearchQuery(query);
    return this.search({ ...parsed, limit });
  },

  /**
   * Parse a natural language search query
   * e.g., "roofing companies in Houston, Texas" → { industry: "roofing", location: { city: "Houston", state: "Texas" } }
   */
  parseSearchQuery(query: string): ProspectSearchParams {
    const params: ProspectSearchParams = {};
    
    // Extract location (city, state pattern)
    const locationMatch = query.match(/(?:in|near|around)\s+([A-Za-z\s]+),?\s*([A-Z]{2}|[A-Za-z]+)?/i);
    if (locationMatch) {
      params.location = {
        city: locationMatch[1]?.trim(),
        state: locationMatch[2]?.trim(),
        country: 'USA',
      };
      // Remove location from query to get industry
      query = query.replace(locationMatch[0], '').trim();
    }
    
    // Clean up common words
    const cleanedQuery = query
      .replace(/\b(companies|company|businesses|business|contractors|services)\b/gi, '')
      .replace(/\s+/g, ' ')
      .trim();
    
    if (cleanedQuery) {
      // Check if it matches a known industry
      const matchedIndustry = INDUSTRIES.find(
        ind => cleanedQuery.toLowerCase().includes(ind.toLowerCase())
      );
      
      if (matchedIndustry) {
        params.industry = matchedIndustry;
      } else {
        params.keywords = cleanedQuery.split(' ').filter(w => w.length > 2);
        params.industry = cleanedQuery;
      }
    }
    
    return params;
  },

  /**
   * Save prospect results to scraped_leads table
   */
  async saveProspectsAsLeads(
    prospects: ProspectResult[],
    jobId?: string
  ): Promise<{ success: boolean; savedCount: number; error?: string }> {
    try {
      const leadsToInsert = prospects.map(prospect => ({
        domain: prospect.company_domain || 'unknown',
        full_name: prospect.full_name,
        best_email: prospect.email,
        best_phone: prospect.phone || prospect.mobile_phone || prospect.direct_phone,
        best_contact_title: prospect.job_title,
        schema_data: {
          company_name: prospect.company_name,
          industry: prospect.industry,
          employee_count: prospect.employee_count,
          annual_revenue: prospect.annual_revenue,
          headquarters_city: prospect.headquarters_city,
          headquarters_state: prospect.headquarters_state,
          linkedin_url: prospect.linkedin_url,
          company_linkedin_url: prospect.company_linkedin_url,
          seniority_level: prospect.seniority_level,
          department: prospect.department,
        },
        confidence_score: prospect.confidence_score,
        source_url: prospect.company_website,
        status: 'new' as const,
        job_id: jobId || null,
        enrichment_providers_used: prospect.enrichment_providers,
      }));

      const { data, error } = await supabase
        .from('scraped_leads')
        .insert(leadsToInsert)
        .select('id');

      if (error) {
        console.error('Error saving prospects:', error);
        return { success: false, savedCount: 0, error: error.message };
      }

      return { success: true, savedCount: data?.length || 0 };
    } catch (error) {
      console.error('Error saving prospects:', error);
      return { 
        success: false, 
        savedCount: 0, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
};
