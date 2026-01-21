import { supabase } from '@/integrations/supabase/client';

// Scored lead with AI insights
export interface ScoredProspect extends ProspectResult {
  score: number;
  score_breakdown: {
    data_completeness: number;
    contact_quality: number;
    decision_maker_fit: number;
    company_fit: number;
    total: number;
  };
  ai_insights: string;
  priority: 'high' | 'medium' | 'low';
  recommended_action: string;
}

export interface ScoringSummary {
  total_leads: number;
  high_priority: number;
  medium_priority: number;
  low_priority: number;
  average_score: number;
}

/**
 * Prospect Search API - ZoomInfo-style lead prospecting
 * 
 * This combines Apollo.io's people database with Firecrawl web search
 * and Google Places to find decision-makers in any niche and location.
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
  searchType?: 'apollo_search' | 'web_discovery' | 'hybrid' | 'google_places';
  limit?: number;
  enrichWebResults?: boolean;
  validate_contacts?: boolean;
  use_waterfall?: boolean;
}

// Google Places result
export interface PlaceResult {
  place_id: string;
  name: string;
  address: string;
  phone: string | null;
  website: string | null;
  rating: number | null;
  review_count: number | null;
  business_status: string | null;
  types: string[];
  location: { lat: number; lng: number } | null;
  hours: string[] | null;
  owner_mentions: string[];
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
   * Search Google Places for local businesses
   */
  async searchPlaces(query: string, limit: number = 20): Promise<{
    success: boolean;
    data?: PlaceResult[];
    error?: string;
  }> {
    const { data, error } = await supabase.functions.invoke('google-places-search', {
      body: { action: 'search', query, limit },
    });

    if (error) {
      console.error('Google Places search error:', error);
      return { success: false, error: error.message };
    }

    return data;
  },

  /**
   * Enrich a Google Places result with contact info from Apollo/Hunter/PDL
   */
  async enrichPlaceResult(place: PlaceResult, targetTitles?: string[]): Promise<ProspectResult | null> {
    // Extract domain from website
    let domain: string | null = null;
    if (place.website) {
      try {
        const url = new URL(place.website);
        domain = url.hostname.replace(/^www\./, '');
      } catch {
        domain = null;
      }
    }

    if (!domain) {
      // Return basic result without enrichment
      return {
        full_name: place.owner_mentions[0] || null,
        email: null,
        phone: place.phone,
        mobile_phone: null,
        direct_phone: null,
        job_title: place.owner_mentions[0] ? 'Owner (from reviews)' : null,
        seniority_level: 'owner',
        department: 'executive',
        linkedin_url: null,
        company_name: place.name,
        company_domain: null,
        company_website: place.website,
        company_linkedin_url: null,
        industry: place.types[0]?.replace(/_/g, ' ') || null,
        employee_count: null,
        annual_revenue: null,
        founded_year: null,
        headquarters_city: null,
        headquarters_state: null,
        source: 'google_places',
        confidence_score: place.phone ? 40 : 20,
        enrichment_providers: ['google_places'],
      };
    }

    // Call waterfall enrichment
    const { data, error } = await supabase.functions.invoke('data-waterfall-enrich', {
      body: { 
        domain, 
        target_titles: targetTitles || ['owner', 'ceo', 'founder', 'president'],
      },
    });

    if (error || !data?.success) {
      // Return basic result
      return {
        full_name: place.owner_mentions[0] || null,
        email: null,
        phone: place.phone,
        mobile_phone: null,
        direct_phone: null,
        job_title: place.owner_mentions[0] ? 'Owner (from reviews)' : null,
        seniority_level: 'owner',
        department: 'executive',
        linkedin_url: null,
        company_name: place.name,
        company_domain: domain,
        company_website: place.website,
        company_linkedin_url: null,
        industry: place.types[0]?.replace(/_/g, ' ') || null,
        employee_count: null,
        annual_revenue: null,
        founded_year: null,
        headquarters_city: null,
        headquarters_state: null,
        source: 'google_places',
        confidence_score: place.phone ? 40 : 20,
        enrichment_providers: ['google_places'],
      };
    }

    const enriched = data.data;
    return {
      full_name: enriched.full_name || place.owner_mentions[0] || null,
      email: enriched.email || null,
      phone: enriched.phone || place.phone,
      mobile_phone: enriched.mobile_phone || null,
      direct_phone: enriched.direct_phone || null,
      job_title: enriched.job_title || (place.owner_mentions[0] ? 'Owner' : null),
      seniority_level: enriched.seniority_level || 'owner',
      department: enriched.department || 'executive',
      linkedin_url: enriched.linkedin_url || null,
      company_name: enriched.company_name || place.name,
      company_domain: domain,
      company_website: place.website,
      company_linkedin_url: enriched.company_linkedin_url || null,
      industry: enriched.industry || place.types[0]?.replace(/_/g, ' ') || null,
      employee_count: enriched.employee_count || null,
      annual_revenue: enriched.annual_revenue || null,
      founded_year: enriched.founded_year || null,
      headquarters_city: enriched.headquarters_city || null,
      headquarters_state: enriched.headquarters_state || null,
      source: 'google_places_enriched',
      confidence_score: enriched.email ? 85 : (enriched.phone || place.phone ? 60 : 30),
      enrichment_providers: ['google_places', ...(data.providers_used || [])],
    };
  },

  /**
   * Batch enrich multiple places
   */
  async enrichPlaceResults(
    places: PlaceResult[], 
    targetTitles?: string[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<ProspectResult[]> {
    const results: ProspectResult[] = [];
    
    for (let i = 0; i < places.length; i++) {
      const enriched = await this.enrichPlaceResult(places[i], targetTitles);
      if (enriched) {
        results.push(enriched);
      }
      onProgress?.(i + 1, places.length);
    }
    
    return results;
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
      // Determine source type based on the prospect source
      const getSourceType = (source?: string): string => {
        if (!source) return 'prospect_search';
        if (source.includes('google_places')) return 'google_places';
        if (source.includes('apollo')) return 'apollo';
        if (source.includes('firecrawl')) return 'firecrawl';
        return 'prospect_search';
      };

      const leadsToInsert = prospects.map(prospect => ({
        domain: prospect.company_domain || 'unknown',
        full_name: prospect.full_name,
        best_email: prospect.email,
        best_phone: prospect.phone || prospect.mobile_phone || prospect.direct_phone,
        best_contact_title: prospect.job_title,
        lead_type: 'company' as const,
        source_type: getSourceType(prospect.source),
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
        enrichment_providers_used: prospect.enrichment_providers || [],
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

  /**
   * Score prospects using AI for priority and recommended actions
   */
  async scoreProspects(
    prospects: ProspectResult[],
    criteria?: {
      target_industry?: string;
      target_titles?: string[];
      min_company_size?: number;
      max_company_size?: number;
    }
  ): Promise<{ 
    success: boolean; 
    data?: ScoredProspect[]; 
    summary?: ScoringSummary;
    error?: string 
  }> {
    try {
      const leadsToScore = prospects.map(p => ({
        full_name: p.full_name,
        email: p.email,
        phone: p.phone || p.mobile_phone || p.direct_phone,
        job_title: p.job_title,
        seniority_level: p.seniority_level,
        company_name: p.company_name,
        industry: p.industry,
        employee_count: p.employee_count,
        annual_revenue: p.annual_revenue,
        website: p.company_website,
        linkedin_url: p.linkedin_url,
        email_validation_status: null,
        phone_validation_status: null,
        source: p.source,
      }));

      const { data, error } = await supabase.functions.invoke('ai-lead-scoring', {
        body: { 
          leads: leadsToScore, 
          criteria: criteria || {},
          use_ai: true,
        },
      });

      if (error) {
        console.error('Lead scoring error:', error);
        return { success: false, error: error.message };
      }

      if (!data?.success) {
        return { success: false, error: data?.error || 'Scoring failed' };
      }

      // Map scored leads back to ScoredProspect format
      const scoredProspects: ScoredProspect[] = data.data.map((scored: any, index: number) => ({
        ...prospects[index],
        score: scored.score,
        score_breakdown: scored.score_breakdown,
        ai_insights: scored.ai_insights,
        priority: scored.priority,
        recommended_action: scored.recommended_action,
      }));

      // Sort by score descending
      scoredProspects.sort((a, b) => b.score - a.score);

      return { 
        success: true, 
        data: scoredProspects,
        summary: data.summary,
      };
    } catch (error) {
      console.error('Scoring error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  },
};
