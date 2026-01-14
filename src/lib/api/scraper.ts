import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import type {
  SchemaTemplate,
  ScrapeJob,
  ScrapedLead,
  ClientOrganization,
  ClientUser,
  EnrichmentProviderConfig,
  CrawlLog,
  CreateSchemaTemplateInput,
  CreateScrapeJobInput,
  CreateClientOrganizationInput,
  AssignLeadsInput,
  ScrapedLeadStatus,
  ScrapeJobStatus,
} from '@/types/scraper';

// ============================================
// Schema Templates API
// ============================================

export const schemaTemplatesApi = {
  async list(): Promise<SchemaTemplate[]> {
    const { data, error } = await supabase
      .from('schema_templates')
      .select('*')
      .order('is_default', { ascending: false })
      .order('name');
    
    if (error) throw error;
    return (data || []) as unknown as SchemaTemplate[];
  },

  async get(id: string): Promise<SchemaTemplate | null> {
    const { data, error } = await supabase
      .from('schema_templates')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as unknown as SchemaTemplate;
  },

  async create(input: CreateSchemaTemplateInput): Promise<SchemaTemplate> {
    const { data: userData } = await supabase.auth.getUser();
    
    const insertData = {
      name: input.name,
      description: input.description,
      niche: input.niche,
      fields: input.fields as unknown as Json,
      is_default: input.is_default,
      created_by: userData.user?.id,
    };
    
    const { data, error } = await supabase
      .from('schema_templates')
      .insert(insertData)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as SchemaTemplate;
  },

  async update(id: string, input: Partial<CreateSchemaTemplateInput>): Promise<SchemaTemplate> {
    const updateData: Record<string, unknown> = {};
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.niche !== undefined) updateData.niche = input.niche;
    if (input.fields !== undefined) updateData.fields = input.fields;
    if (input.is_default !== undefined) updateData.is_default = input.is_default;
    
    const { data, error } = await supabase
      .from('schema_templates')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as SchemaTemplate;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('schema_templates')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },
};

// ============================================
// Client Organizations API
// ============================================

export const clientOrganizationsApi = {
  async list(): Promise<ClientOrganization[]> {
    const { data, error } = await supabase
      .from('client_organizations')
      .select('*')
      .order('name');
    
    if (error) throw error;
    return (data || []) as unknown as ClientOrganization[];
  },

  async get(id: string): Promise<ClientOrganization | null> {
    const { data, error } = await supabase
      .from('client_organizations')
      .select('*')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as unknown as ClientOrganization;
  },

  async create(input: CreateClientOrganizationInput): Promise<ClientOrganization> {
    const { data, error } = await supabase
      .from('client_organizations')
      .insert(input)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ClientOrganization;
  },

  async update(id: string, input: Partial<CreateClientOrganizationInput>): Promise<ClientOrganization> {
    const { data, error } = await supabase
      .from('client_organizations')
      .update(input)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ClientOrganization;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('client_organizations')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async getUsers(orgId: string): Promise<ClientUser[]> {
    const { data, error } = await supabase
      .from('client_users')
      .select('*')
      .eq('organization_id', orgId);
    
    if (error) throw error;
    return (data || []) as unknown as ClientUser[];
  },

  async addUser(orgId: string, userId: string, isPrimary = false): Promise<ClientUser> {
    const { data, error } = await supabase
      .from('client_users')
      .insert({
        organization_id: orgId,
        user_id: userId,
        is_primary: isPrimary,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ClientUser;
  },

  async removeUser(orgId: string, userId: string): Promise<void> {
    const { error } = await supabase
      .from('client_users')
      .delete()
      .eq('organization_id', orgId)
      .eq('user_id', userId);
    
    if (error) throw error;
  },
};

// ============================================
// Scrape Jobs API
// ============================================

export const scrapeJobsApi = {
  async list(status?: ScrapeJobStatus): Promise<ScrapeJob[]> {
    let query = supabase
      .from('scrape_jobs')
      .select('*, schema_template:schema_templates(*)')
      .order('created_at', { ascending: false });
    
    if (status) {
      query = query.eq('status', status);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []) as unknown as ScrapeJob[];
  },

  async get(id: string): Promise<ScrapeJob | null> {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .select('*, schema_template:schema_templates(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as unknown as ScrapeJob;
  },

  async create(input: CreateScrapeJobInput): Promise<ScrapeJob> {
    const { data: userData } = await supabase.auth.getUser();
    
    const { data, error } = await supabase
      .from('scrape_jobs')
      .insert({
        ...input,
        total_targets: input.target_urls.length,
        created_by: userData.user?.id,
      })
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ScrapeJob;
  },

  async update(id: string, input: Partial<CreateScrapeJobInput & { status: ScrapeJobStatus }>): Promise<ScrapeJob> {
    const updateData: Record<string, unknown> = { ...input };
    if (input.target_urls) {
      updateData.total_targets = input.target_urls.length;
    }
    
    const { data, error } = await supabase
      .from('scrape_jobs')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ScrapeJob;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('scrape_jobs')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async start(id: string): Promise<ScrapeJob> {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .update({
        status: 'queued',
        started_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    
    // Queue the job for processing
    await supabase.from('job_queue').insert({
      job_type: 'scrape',
      reference_id: id,
      priority: 0,
    });
    
    // Trigger the job processor edge function
    supabase.functions.invoke('process-scrape-job', {
      body: { job_id: id },
    }).catch(err => console.error('Failed to trigger job processor:', err));
    
    return data as unknown as ScrapeJob;
  },

  async pause(id: string): Promise<ScrapeJob> {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .update({ status: 'paused' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ScrapeJob;
  },

  async resume(id: string): Promise<ScrapeJob> {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .update({ status: 'queued' })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ScrapeJob;
  },

  async cancel(id: string): Promise<ScrapeJob> {
    const { data, error } = await supabase
      .from('scrape_jobs')
      .update({
        status: 'cancelled',
        completed_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ScrapeJob;
  },

  async getCrawlLogs(jobId: string): Promise<CrawlLog[]> {
    const { data, error } = await supabase
      .from('crawl_logs')
      .select('*')
      .eq('job_id', jobId)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    return (data || []) as unknown as CrawlLog[];
  },
};

// ============================================
// Scraped Leads API
// ============================================

export const scrapedLeadsApi = {
  async list(filters?: {
    job_id?: string;
    status?: ScrapedLeadStatus;
    assigned_to_org?: string;
    unassigned_only?: boolean;
  }): Promise<ScrapedLead[]> {
    let query = supabase
      .from('scraped_leads')
      .select('*, schema_template:schema_templates(*), assigned_organization:client_organizations(*)')
      .order('created_at', { ascending: false });
    
    if (filters?.job_id) {
      query = query.eq('job_id', filters.job_id);
    }
    if (filters?.status) {
      query = query.eq('status', filters.status);
    }
    if (filters?.assigned_to_org) {
      query = query.eq('assigned_to_org', filters.assigned_to_org);
    }
    if (filters?.unassigned_only) {
      query = query.is('assigned_to_org', null);
    }
    
    const { data, error } = await query;
    
    if (error) throw error;
    return (data || []) as unknown as ScrapedLead[];
  },

  async get(id: string): Promise<ScrapedLead | null> {
    const { data, error } = await supabase
      .from('scraped_leads')
      .select('*, schema_template:schema_templates(*), assigned_organization:client_organizations(*)')
      .eq('id', id)
      .single();
    
    if (error) throw error;
    return data as unknown as ScrapedLead;
  },

  async update(id: string, input: Partial<ScrapedLead>): Promise<ScrapedLead> {
    const { data, error } = await supabase
      .from('scraped_leads')
      .update(input as Record<string, unknown>)
      .eq('id', id)
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as ScrapedLead;
  },

  async updateStatus(id: string, status: ScrapedLeadStatus): Promise<ScrapedLead> {
    return this.update(id, { status });
  },

  async assignToOrganization(input: AssignLeadsInput): Promise<void> {
    const { data: userData } = await supabase.auth.getUser();
    
    const { error } = await supabase
      .from('scraped_leads')
      .update({
        assigned_to_org: input.organization_id,
        assigned_by: userData.user?.id,
        assigned_at: new Date().toISOString(),
        status: 'assigned',
      })
      .in('id', input.lead_ids);
    
    if (error) throw error;
  },

  async unassign(leadIds: string[]): Promise<void> {
    const { error } = await supabase
      .from('scraped_leads')
      .update({
        assigned_to_org: null,
        assigned_by: null,
        assigned_at: null,
        status: 'approved',
      })
      .in('id', leadIds);
    
    if (error) throw error;
  },

  async delete(id: string): Promise<void> {
    const { error } = await supabase
      .from('scraped_leads')
      .delete()
      .eq('id', id);
    
    if (error) throw error;
  },

  async bulkDelete(ids: string[]): Promise<void> {
    const { error } = await supabase
      .from('scraped_leads')
      .delete()
      .in('id', ids);
    
    if (error) throw error;
  },

  // Export to CSV
  async exportToCsv(filters?: {
    job_id?: string;
    assigned_to_org?: string;
  }): Promise<string> {
    const leads = await this.list(filters);
    
    if (leads.length === 0) {
      return '';
    }
    
    // Define CSV columns
    const universalColumns = [
      'id', 'domain', 'source_url', 'full_name', 'best_email', 'best_phone',
      'contact_form_url', 'linkedin_search_url', 'confidence_score', 'qc_flag',
      'email_validation_status', 'phone_validation_status', 'status', 'scraped_at'
    ];
    
    // Get schema fields from first lead if available
    const schemaFields = leads[0]?.schema_template?.fields || [];
    const schemaColumns = schemaFields.map((f: { field_name: string }) => f.field_name);
    
    const allColumns = [...universalColumns, ...schemaColumns];
    
    // Build CSV
    const rows: string[] = [];
    rows.push(allColumns.join(','));
    
    for (const lead of leads) {
      const row = allColumns.map(col => {
        let value: unknown;
        
        if (universalColumns.includes(col)) {
          value = lead[col as keyof ScrapedLead];
        } else {
          value = lead.schema_data?.[col];
        }
        
        if (value === null || value === undefined) return '';
        if (Array.isArray(value)) return `"${value.join('; ')}"`;
        if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value);
      });
      rows.push(row.join(','));
    }
    
    return rows.join('\n');
  },

  // Export to JSON
  async exportToJson(filters?: {
    job_id?: string;
    assigned_to_org?: string;
  }): Promise<string> {
    const leads = await this.list(filters);
    return JSON.stringify(leads, null, 2);
  },
};

// ============================================
// Enrichment Providers API
// ============================================

export const enrichmentProvidersApi = {
  async list(): Promise<EnrichmentProviderConfig[]> {
    const { data, error } = await supabase
      .from('enrichment_providers_config')
      .select('*')
      .order('display_name');
    
    if (error) throw error;
    return (data || []) as unknown as EnrichmentProviderConfig[];
  },

  async update(provider: string, config: Partial<EnrichmentProviderConfig>): Promise<EnrichmentProviderConfig> {
    const { data, error } = await supabase
      .from('enrichment_providers_config')
      .update(config as Record<string, unknown>)
      .eq('provider', provider as 'apollo' | 'hunter' | 'clearbit' | 'manual')
      .select()
      .single();
    
    if (error) throw error;
    return data as unknown as EnrichmentProviderConfig;
  },

  async enable(provider: 'apollo' | 'hunter' | 'clearbit' | 'manual'): Promise<void> {
    await this.update(provider, { is_enabled: true });
  },

  async disable(provider: 'apollo' | 'hunter' | 'clearbit' | 'manual'): Promise<void> {
    await this.update(provider, { is_enabled: false });
  },
};
