import { supabase } from '@/integrations/supabase/client';

type FirecrawlResponse<T = any> = {
  success: boolean;
  error?: string;
  data?: T;
  links?: string[];
};

type ScrapeOptions = {
  formats?: (
    | 'markdown' | 'html' | 'rawHtml' | 'links' | 'screenshot' | 'branding' | 'summary'
    | { type: 'json'; schema?: object; prompt?: string }
  )[];
  onlyMainContent?: boolean;
  waitFor?: number;
  location?: { country?: string; languages?: string[] };
};

type SearchOptions = {
  limit?: number;
  lang?: string;
  country?: string;
  tbs?: string;
  scrapeOptions?: { formats?: ('markdown' | 'html')[] };
};

type MapOptions = {
  search?: string;
  limit?: number;
  includeSubdomains?: boolean;
};

type CrawlOptions = {
  limit?: number;
  maxDepth?: number;
  includePaths?: string[];
  excludePaths?: string[];
};

type RealEstateScrapeOptions = {
  url?: string;
  urls?: string[];
  location?: string;
  platform?: 'zillow' | 'apartments' | 'hotpads' | 'fsbo' | 'trulia' | 'redfin' | 'craigslist' | 'realtor';
  listingType?: 'sale' | 'rent';
  saveToJob?: boolean;
  jobId?: string;
};

type RealEstateListing = {
  address?: string;
  bedrooms?: number;
  bathrooms?: number;
  price?: string;
  days_on_market?: number;
  favorites_count?: number;
  views_count?: number;
  listing_type?: string;
  property_type?: string;
  square_feet?: number;
  year_built?: number;
  owner_name?: string;
  owner_phone?: string;
  owner_email?: string;
  listing_url?: string;
  listing_id?: string;
  description?: string;
  source_url?: string;
  source_platform?: string;
  scraped_at?: string;
};

type RealEstateResponse = {
  success: boolean;
  error?: string;
  listings?: RealEstateListing[];
  total?: number;
  urls_scraped?: number;
  errors?: { url: string; error: string }[];
};

export const firecrawlApi = {
  // Scrape a single URL
  async scrape(url: string, options?: ScrapeOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-scrape', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Search the web and optionally scrape results
  async search(query: string, options?: SearchOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-search', {
      body: { query, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Map a website to discover all URLs (fast sitemap)
  async map(url: string, options?: MapOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-map', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Crawl an entire website
  async crawl(url: string, options?: CrawlOptions): Promise<FirecrawlResponse> {
    const { data, error } = await supabase.functions.invoke('firecrawl-crawl', {
      body: { url, options },
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },

  // Scrape real estate FSBO/FRBO listings
  async scrapeRealEstate(options: RealEstateScrapeOptions): Promise<RealEstateResponse> {
    const { data, error } = await supabase.functions.invoke('scrape-real-estate', {
      body: options,
    });

    if (error) {
      return { success: false, error: error.message };
    }
    return data;
  },
};
