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
  platform?: 'zillow' | 'apartments' | 'hotpads' | 'fsbo' | 'trulia' | 'redfin' | 'craigslist' | 'realtor' | 'all';
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

// FSBO Scrape + Skip Trace workflow types
type FSBOScrapeAndTraceOptions = {
  url?: string;
  urls?: string[];
  location?: string;
  platform?: 'zillow' | 'apartments' | 'hotpads' | 'fsbo' | 'trulia' | 'redfin' | 'craigslist' | 'realtor' | 'all';
  listingType?: 'sale' | 'rent';
  enableSkipTrace?: boolean;
  saveToDatabase?: boolean;
  jobId?: string;
};

type EnrichedListing = RealEstateListing & {
  all_phones?: Array<{ number: string; type: string }>;
  all_emails?: Array<{ address: string; type?: string }>;
  skip_trace_confidence?: number;
  skip_trace_status?: 'pending' | 'success' | 'not_found' | 'error';
  skip_trace_error?: string;
};

type FSBOScrapeAndTraceResponse = {
  success: boolean;
  error?: string;
  listings?: EnrichedListing[];
  total?: number;
  urls_scraped?: number;
  skip_trace_stats?: {
    attempted: number;
    successful: number;
    rate: number;
  } | null;
  saved_to_database?: number | null;
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

  /**
   * Full FSBO/FRBO workflow: Scrape listings + Skip Trace owner info
   * This combines Firecrawl scraping with BatchData skip tracing in one call.
   * Cost: Firecrawl credits + ~$0.009 per address for skip tracing
   */
  async scrapeAndTraceFSBO(options: FSBOScrapeAndTraceOptions): Promise<FSBOScrapeAndTraceResponse> {
    const { data, error } = await supabase.functions.invoke('fsbo-scrape-and-trace', {
      body: options,
    });

    if (error) {
      // Prefer backend message (e.g. "Authentication required", "Admin access required")
      const message = (data as any)?.error ?? error.message;
      return { success: false, error: message };
    }
    if (data && !(data as FSBOScrapeAndTraceResponse).success && (data as FSBOScrapeAndTraceResponse).error) {
      return data as FSBOScrapeAndTraceResponse;
    }
    return data as FSBOScrapeAndTraceResponse;
  },
};
