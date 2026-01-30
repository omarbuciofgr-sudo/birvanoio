import { supabase } from '@/integrations/supabase/client';

export interface CompanySearchInput {
  industry?: string;
  employee_count_min?: number;
  employee_count_max?: number;
  location?: string;
  keywords?: string;
  limit?: number;
}

export interface CompanyResult {
  name: string;
  domain: string;
  website: string | null;
  linkedin_url: string | null;
  industry: string | null;
  employee_count: number | null;
  employee_range: string | null;
  annual_revenue: number | null;
  founded_year: number | null;
  description: string | null;
  headquarters_city: string | null;
  headquarters_state: string | null;
  headquarters_country: string | null;
  technologies: string[];
  keywords: string[];
}

export interface IndustrySearchResponse {
  success: boolean;
  companies?: CompanyResult[];
  total?: number;
  pagination?: {
    page: number;
    per_page: number;
    total_entries: number;
    total_pages: number;
  };
  error?: string;
}

// Common industries for the dropdown
export const INDUSTRIES = [
  { value: 'software', label: 'Software & Technology' },
  { value: 'financial_services', label: 'Financial Services' },
  { value: 'healthcare', label: 'Healthcare' },
  { value: 'real_estate', label: 'Real Estate' },
  { value: 'construction', label: 'Construction' },
  { value: 'manufacturing', label: 'Manufacturing' },
  { value: 'retail', label: 'Retail' },
  { value: 'restaurants', label: 'Restaurants & Food Service' },
  { value: 'hospitality', label: 'Hospitality & Travel' },
  { value: 'education', label: 'Education' },
  { value: 'legal', label: 'Legal Services' },
  { value: 'marketing', label: 'Marketing & Advertising' },
  { value: 'consulting', label: 'Consulting' },
  { value: 'insurance', label: 'Insurance' },
  { value: 'telecommunications', label: 'Telecommunications' },
  { value: 'transportation', label: 'Transportation & Logistics' },
  { value: 'energy', label: 'Energy & Utilities' },
  { value: 'agriculture', label: 'Agriculture' },
  { value: 'entertainment', label: 'Entertainment & Media' },
  { value: 'nonprofit', label: 'Non-Profit' },
];

// Employee count ranges
export const EMPLOYEE_RANGES = [
  { value: '1-10', label: '1-10 employees', min: 1, max: 10 },
  { value: '11-50', label: '11-50 employees', min: 11, max: 50 },
  { value: '51-200', label: '51-200 employees', min: 51, max: 200 },
  { value: '201-500', label: '201-500 employees', min: 201, max: 500 },
  { value: '501-1000', label: '501-1000 employees', min: 501, max: 1000 },
  { value: '1001-5000', label: '1001-5000 employees', min: 1001, max: 5000 },
  { value: '5001+', label: '5000+ employees', min: 5001, max: 999999 },
];

export const industrySearchApi = {
  /**
   * Search for companies by industry, size, and location
   */
  async searchCompanies(input: CompanySearchInput): Promise<IndustrySearchResponse> {
    const { data, error } = await supabase.functions.invoke('industry-search', {
      body: input,
    });

    if (error) {
      console.error('Industry search error:', error);
      return { success: false, error: error.message };
    }

    return data as IndustrySearchResponse;
  },

  /**
   * Save search results as scraped leads
   */
  async saveAsLeads(companies: CompanyResult[], jobId?: string): Promise<{ saved: number; errors: number }> {
    let saved = 0;
    let errors = 0;

    for (const company of companies) {
      try {
        const { error } = await supabase.from('scraped_leads').insert({
          domain: company.domain,
          source_url: company.website || company.linkedin_url,
          source_type: 'industry_search',
          lead_type: 'company',
          status: 'new',
          job_id: jobId || null,
          schema_data: {
            company_name: company.name,
            industry: company.industry,
            employee_count: company.employee_count,
            employee_range: company.employee_range,
            annual_revenue: company.annual_revenue,
            founded_year: company.founded_year,
            description: company.description,
            technologies: company.technologies,
            keywords: company.keywords,
            headquarters_city: company.headquarters_city,
            headquarters_state: company.headquarters_state,
            headquarters_country: company.headquarters_country,
          },
          linkedin_search_url: company.linkedin_url,
        });

        if (error) {
          console.error('Error saving company:', error);
          errors++;
        } else {
          saved++;
        }
      } catch (e) {
        console.error('Error saving company:', e);
        errors++;
      }
    }

    return { saved, errors };
  },
};
