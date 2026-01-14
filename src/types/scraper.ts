// ============================================
// Lead Scraper + Enrichment Platform Types
// ============================================

// Enum types matching database
export type ScrapeJobStatus = 'draft' | 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
export type ValidationStatus = 'unverified' | 'likely_valid' | 'verified' | 'invalid';
export type ScrapedPageStatus = 'pending' | 'scraping' | 'scraped' | 'failed' | 'blocked' | 'skipped';
export type EnrichmentProvider = 'apollo' | 'hunter' | 'clearbit' | 'manual';
export type ScrapedLeadStatus = 'new' | 'review' | 'approved' | 'assigned' | 'in_progress' | 'won' | 'lost' | 'rejected';

// Schema field definition
export interface SchemaField {
  field_name: string;
  type: 'string' | 'number' | 'array' | 'url' | 'boolean';
  description: string;
  extraction_hints: string;
  required: boolean;
}

// Schema template
export interface SchemaTemplate {
  id: string;
  name: string;
  description: string | null;
  niche: string;
  fields: SchemaField[];
  is_default: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// Client organization
export interface ClientOrganization {
  id: string;
  name: string;
  contact_email: string | null;
  contact_phone: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Client user mapping
export interface ClientUser {
  id: string;
  user_id: string;
  organization_id: string;
  is_primary: boolean;
  created_at: string;
}

// Scrape job
export interface ScrapeJob {
  id: string;
  name: string;
  description: string | null;
  schema_template_id: string | null;
  status: ScrapeJobStatus;
  target_urls: string[];
  input_method: 'paste' | 'csv' | 'search';
  max_pages_per_domain: number;
  respect_robots_txt: boolean;
  use_playwright_fallback: boolean;
  request_delay_ms: number;
  total_targets: number;
  completed_targets: number;
  failed_targets: number;
  started_at: string | null;
  completed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  schema_template?: SchemaTemplate;
}

// Scraped page
export interface ScrapedPage {
  id: string;
  job_id: string;
  url: string;
  domain: string;
  page_type: string | null;
  status: ScrapedPageStatus;
  html_content: string | null;
  markdown_content: string | null;
  extracted_signals: Record<string, unknown>;
  http_status: number | null;
  error_message: string | null;
  blocked_reason: string | null;
  scraped_at: string | null;
  processing_time_ms: number | null;
  created_at: string;
}

// Scraped lead (main output)
export interface ScrapedLead {
  id: string;
  job_id: string | null;
  assigned_to_org: string | null;
  assigned_by: string | null;
  assigned_at: string | null;
  status: ScrapedLeadStatus;
  domain: string;
  source_url: string | null;
  
  // Universal fields
  full_name: string | null;
  best_email: string | null;
  all_emails: string[];
  best_phone: string | null;
  all_phones: string[];
  contact_form_url: string | null;
  
  // Evidence URLs
  name_source_url: string | null;
  email_source_url: string | null;
  phone_source_url: string | null;
  contact_form_source_url: string | null;
  
  // LinkedIn
  linkedin_search_url: string | null;
  
  // Validation
  email_validation_status: ValidationStatus;
  email_validation_notes: string | null;
  phone_validation_status: ValidationStatus;
  phone_line_type: string | null;
  phone_validation_notes: string | null;
  
  // Confidence & QC
  confidence_score: number;
  qc_flag: string | null;
  qc_notes: string | null;
  
  // Schema data
  schema_template_id: string | null;
  schema_data: Record<string, unknown>;
  schema_evidence: Record<string, string>;
  
  // Enrichment
  enrichment_data: Record<string, unknown>;
  enrichment_providers_used: string[];
  
  // Timestamps
  scraped_at: string;
  created_at: string;
  updated_at: string;
  
  // Joined fields
  schema_template?: SchemaTemplate;
  assigned_organization?: ClientOrganization;
}

// Enrichment provider config
export interface EnrichmentProviderConfig {
  id: string;
  provider: EnrichmentProvider;
  display_name: string;
  api_key_secret_name: string | null;
  is_enabled: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// Enrichment log
export interface EnrichmentLog {
  id: string;
  lead_id: string;
  provider: EnrichmentProvider;
  action: 'person_lookup' | 'company_lookup' | 'email_discovery' | 'phone_enrichment';
  request_data: Record<string, unknown> | null;
  response_data: Record<string, unknown> | null;
  fields_enriched: string[];
  success: boolean;
  error_message: string | null;
  credits_used: number;
  created_at: string;
}

// Validation log
export interface ValidationLog {
  id: string;
  lead_id: string;
  validation_type: 'email' | 'phone';
  provider: string | null;
  input_value: string;
  result_status: ValidationStatus;
  result_details: Record<string, unknown> | null;
  created_at: string;
}

// Crawl log
export interface CrawlLog {
  id: string;
  job_id: string;
  domain: string;
  pages_crawled_count: number;
  pages_blocked_count: number;
  pages_error_count: number;
  blocked_detected: boolean;
  blocked_reason: string | null;
  errors: unknown[];
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
}

// Job queue item
export interface JobQueueItem {
  id: string;
  job_type: 'scrape' | 'enrich' | 'validate' | 'dedupe';
  reference_id: string;
  priority: number;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled';
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  attempts: number;
  max_attempts: number;
  next_attempt_at: string;
  locked_by: string | null;
  locked_at: string | null;
  created_at: string;
  completed_at: string | null;
}

// Lead duplicate
export interface LeadDuplicate {
  id: string;
  primary_lead_id: string;
  duplicate_lead_id: string;
  match_reason: 'email' | 'phone' | 'domain_name' | 'company_city_contact';
  merged_at: string | null;
  created_at: string;
}

// ============================================
// Form types for creating/updating
// ============================================

export interface CreateSchemaTemplateInput {
  name: string;
  description?: string;
  niche: string;
  fields: SchemaField[];
  is_default?: boolean;
}

export interface CreateScrapeJobInput {
  name: string;
  description?: string;
  schema_template_id?: string;
  target_urls: string[];
  input_method?: 'paste' | 'csv' | 'search';
  max_pages_per_domain?: number;
  respect_robots_txt?: boolean;
  use_playwright_fallback?: boolean;
  request_delay_ms?: number;
}

export interface CreateClientOrganizationInput {
  name: string;
  contact_email?: string;
  contact_phone?: string;
  notes?: string;
}

export interface AssignLeadsInput {
  lead_ids: string[];
  organization_id: string;
}
