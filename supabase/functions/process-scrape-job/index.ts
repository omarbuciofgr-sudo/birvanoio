import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Configuration
const MAX_GLOBAL_CONCURRENCY = 5; // Max concurrent scrape workers
const LOCK_TIMEOUT_MS = 300000; // 5 minutes lock timeout
const CACHE_DURATION_HOURS = 24; // Cache duration in hours
const DEFAULT_BATCH_SIZE = 100; // Default targets per batch

interface SchemaField {
  field_name: string;
  field_type: string;
  is_required: boolean;
  extraction_hint?: string;
}

interface ScrapeJob {
  id: string;
  name: string;
  target_urls: string[];
  schema_template_id: string | null;
  max_pages_per_domain: number;
  request_delay_ms: number;
  status: string;
  completed_targets: number;
  failed_targets: number;
  total_targets: number;
  checkpoint_index: number;
  batch_size: number;
}

interface SchemaTemplate {
  id: string;
  name: string;
  niche: string;
  fields: SchemaField[];
}

// Priority titles for contact selection (higher index = higher priority)
const TITLE_PRIORITY: string[] = [
  'assistant', 'coordinator', 'specialist', 'associate', 'representative',
  'agent', 'consultant', 'advisor', 'analyst', 'office manager',
  'operations manager', 'leasing manager', 'property manager', 'regional manager',
  'general manager', 'managing director', 'director', 'vice president', 'vp',
  'president', 'ceo', 'chief executive officer', 'founder', 'co-founder',
  'owner', 'principal', 'partner',
];

const B2B_DECISION_MAKER_TITLES: string[] = [
  'cto', 'chief technology officer', 'cio', 'chief information officer',
  'cfo', 'chief financial officer', 'cmo', 'chief marketing officer',
  'coo', 'chief operating officer', 'vp of engineering', 'vp engineering',
  'vp of sales', 'vp sales', 'vp of marketing', 'vp marketing', 'head of', 'director of',
];

interface ContactInfo {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  sourceUrl: string | null;
  priority: number;
}

// Extract domain from URL
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url.startsWith('http') ? url : `https://${url}`);
    return urlObj.hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '').split('/')[0];
  }
}

// Format URL
function formatUrl(url: string): string {
  let formatted = url.trim();
  if (!formatted.startsWith('http://') && !formatted.startsWith('https://')) {
    formatted = `https://${formatted}`;
  }
  return formatted;
}

// Extract emails from text
function extractEmails(text: string): string[] {
  const emailRegex = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
  const matches = text.match(emailRegex) || [];
  return [...new Set(matches)].filter(email => 
    !email.includes('example.com') &&
    !email.includes('@2x') &&
    !email.endsWith('.png') &&
    !email.endsWith('.jpg') &&
    !email.endsWith('.gif')
  );
}

// Extract phone numbers from text
function extractPhones(text: string): string[] {
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches.map(p => p.replace(/\D/g, '')))].filter(p => p.length >= 10 && p.length <= 11);
}

// Get priority score for a title
function getTitlePriority(title: string | null, niche?: string): number {
  if (!title) return 0;
  const lowerTitle = title.toLowerCase();
  
  if (niche?.toLowerCase().includes('b2b')) {
    for (const dmTitle of B2B_DECISION_MAKER_TITLES) {
      if (lowerTitle.includes(dmTitle)) {
        return 100 + B2B_DECISION_MAKER_TITLES.indexOf(dmTitle);
      }
    }
  }
  
  for (let i = TITLE_PRIORITY.length - 1; i >= 0; i--) {
    if (lowerTitle.includes(TITLE_PRIORITY[i])) {
      return i + 1;
    }
  }
  
  return 0;
}

// Parse team/staff cards
function parseTeamCards(markdown: string, sourceUrl: string, niche?: string): ContactInfo[] {
  const contacts: ContactInfo[] = [];
  
  const cardPattern1 = /#{2,4}\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\n+(?:\*{1,2}([^*\n]+)\*{1,2})?\s*\n*([\s\S]*?)(?=\n#{2,4}|\n\n\n|$)/gi;
  const labelPattern = /(?:contact|agent|manager|broker|representative|team member|staff):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:,?\s*([^,\n]+))?/gi;
  
  let match;
  
  while ((match = cardPattern1.exec(markdown)) !== null) {
    const name = match[1]?.trim();
    const title = match[2]?.trim() || null;
    const content = match[3] || '';
    
    if (name && name.split(' ').length >= 2) {
      const emails = extractEmails(content);
      const phones = extractPhones(content);
      
      contacts.push({
        name, title,
        email: emails[0] || null,
        phone: phones[0] || null,
        sourceUrl,
        priority: getTitlePriority(title, niche),
      });
    }
  }
  
  while ((match = labelPattern.exec(markdown)) !== null) {
    const name = match[1]?.trim();
    const title = match[2]?.trim() || null;
    
    if (name && name.split(' ').length >= 2) {
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(markdown.length, match.index + match[0].length + 200);
      const context = markdown.substring(contextStart, contextEnd);
      
      const emails = extractEmails(context);
      const phones = extractPhones(context);
      
      const exists = contacts.some(c => c.name?.toLowerCase() === name.toLowerCase());
      
      if (!exists) {
        contacts.push({
          name, title,
          email: emails[0] || null,
          phone: phones[0] || null,
          sourceUrl,
          priority: getTitlePriority(title, niche),
        });
      }
    }
  }
  
  return contacts;
}

// Select the best contact
function selectBestContact(contacts: ContactInfo[]): ContactInfo | null {
  if (contacts.length === 0) return null;
  
  return contacts.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    const aScore = (a.email ? 2 : 0) + (a.phone ? 1 : 0);
    const bScore = (b.email ? 2 : 0) + (b.phone ? 1 : 0);
    return bScore - aScore;
  })[0];
}

// Extract names from text
function extractName(text: string): string | null {
  const namePatterns = [
    /(?:contact|owner|manager|director|ceo|founder|president|agent):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
    /(?:by|from|author):\s*([A-Z][a-z]+\s+[A-Z][a-z]+)/i,
  ];
  
  for (const pattern of namePatterns) {
    const match = text.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Extract contact form URL
function extractContactFormUrl(links: string[]): string | null {
  const contactKeywords = ['contact', 'get-in-touch', 'reach-us', 'contact-us', 'inquiry', 'enquiry'];
  
  for (const link of links) {
    const lowerLink = link.toLowerCase();
    if (contactKeywords.some(keyword => lowerLink.includes(keyword))) {
      return link;
    }
  }
  
  return null;
}

// Generate LinkedIn search URL
function generateLinkedInSearchUrl(domain: string, name?: string | null): string {
  const companyName = domain.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' ');
  const searchQuery = name ? `${name} ${companyName}` : companyName;
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(searchQuery)}`;
}

// Acquire a lock for concurrency control
// deno-lint-ignore no-explicit-any
async function acquireLock(supabase: any, lockType: string, lockKey: string, jobId: string): Promise<boolean> {
  const expiresAt = new Date(Date.now() + LOCK_TIMEOUT_MS).toISOString();
  
  // Clean up expired locks first
  await supabase
    .from('scraper_locks')
    .delete()
    .lt('expires_at', new Date().toISOString());
  
  // Check global concurrency
  if (lockType === 'global') {
    const { count } = await supabase
      .from('scraper_locks')
      .select('*', { count: 'exact', head: true })
      .eq('lock_type', 'global')
      .gt('expires_at', new Date().toISOString());
    
    if ((count || 0) >= MAX_GLOBAL_CONCURRENCY) {
      console.log(`Global concurrency limit reached (${count}/${MAX_GLOBAL_CONCURRENCY})`);
      return false;
    }
  }
  
  // Try to insert lock
  const { error } = await supabase
    .from('scraper_locks')
    .insert({
      lock_type: lockType,
      lock_key: `${lockType}:${lockKey}`,
      locked_by: jobId,
      expires_at: expiresAt,
    });
  
  if (error) {
    // Lock already exists (conflict)
    if (error.code === '23505') {
      console.log(`Lock already held for ${lockKey}`);
      return false;
    }
    console.error('Error acquiring lock:', error);
    return false;
  }
  
  return true;
}

// Release a lock
// deno-lint-ignore no-explicit-any
async function releaseLock(supabase: any, lockType: string, lockKey: string): Promise<void> {
  await supabase
    .from('scraper_locks')
    .delete()
    .eq('lock_key', `${lockType}:${lockKey}`);
}

// Check domain cache
// deno-lint-ignore no-explicit-any
async function checkDomainCache(supabase: any, domain: string): Promise<{ cached: boolean; leadId?: string }> {
  const { data } = await supabase
    .from('domain_cache')
    .select('lead_id, cache_expires_at')
    .eq('domain', domain)
    .single();
  
  if (data && new Date(data.cache_expires_at) > new Date()) {
    return { cached: true, leadId: data.lead_id };
  }
  
  return { cached: false };
}

// Update domain cache
// deno-lint-ignore no-explicit-any
async function updateDomainCache(supabase: any, domain: string, leadId: string, pagesCount: number): Promise<void> {
  const expiresAt = new Date(Date.now() + CACHE_DURATION_HOURS * 60 * 60 * 1000).toISOString();
  
  await supabase
    .from('domain_cache')
    .upsert({
      domain,
      lead_id: leadId,
      last_scraped_at: new Date().toISOString(),
      cache_expires_at: expiresAt,
      scraped_pages_count: pagesCount,
    }, { onConflict: 'domain' });
}

// Check if domain is blocked
// deno-lint-ignore no-explicit-any
async function isDomainBlocked(supabase: any, domain: string): Promise<{ blocked: boolean; reason?: string }> {
  const { data } = await supabase
    .from('blocked_domains')
    .select('block_reason, retry_after')
    .eq('domain', domain)
    .single();
  
  if (data) {
    // Check if retry time has passed
    if (data.retry_after && new Date(data.retry_after) < new Date()) {
      return { blocked: false };
    }
    return { blocked: true, reason: data.block_reason };
  }
  
  return { blocked: false };
}

// Mark domain as blocked
// deno-lint-ignore no-explicit-any
async function markDomainBlocked(supabase: any, domain: string, reason: string, httpStatus?: number): Promise<void> {
  // Exponential backoff: retry after 1 hour * block_count
  const { data: existing } = await supabase
    .from('blocked_domains')
    .select('block_count')
    .eq('domain', domain)
    .single();
  
  const blockCount = (existing?.block_count || 0) + 1;
  const retryAfterHours = Math.min(blockCount * 1, 24); // Max 24 hours
  const retryAfter = new Date(Date.now() + retryAfterHours * 60 * 60 * 1000).toISOString();
  
  await supabase
    .from('blocked_domains')
    .upsert({
      domain,
      block_reason: reason,
      http_status: httpStatus,
      retry_after: retryAfter,
      block_count: blockCount,
      last_attempt_at: new Date().toISOString(),
    }, { onConflict: 'domain' });
}

// Scrape a single URL using Firecrawl
async function scrapeUrl(url: string, apiKey: string): Promise<{
  success: boolean;
  markdown?: string;
  html?: string;
  links?: string[];
  error?: string;
  httpStatus?: number;
}> {
  try {
    const response = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url,
        formats: ['markdown', 'links'],
        onlyMainContent: false,
        waitFor: 2000,
      }),
    });

    const data = await response.json();
    
    if (!response.ok) {
      return { 
        success: false, 
        error: data.error || `HTTP ${response.status}`,
        httpStatus: response.status,
      };
    }

    return {
      success: true,
      markdown: data.data?.markdown || data.markdown,
      html: data.data?.html || data.html,
      links: data.data?.links || data.links || [],
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}

// Process a single target URL
async function processTarget(
  url: string,
  jobId: string,
  schemaTemplate: SchemaTemplate | null,
  firecrawlApiKey: string,
  // deno-lint-ignore no-explicit-any
  supabaseClient: any,
  forceRefresh: boolean = false
): Promise<{ success: boolean; leadId?: string; error?: string; needsEnrichment?: boolean; fromCache?: boolean }> {
  const domain = extractDomain(url);
  const formattedUrl = formatUrl(url);
  const startTime = Date.now();

  console.log(`Processing: ${domain}`);

  // Check if domain is blocked
  const blockStatus = await isDomainBlocked(supabaseClient, domain);
  if (blockStatus.blocked) {
    console.log(`Domain ${domain} is blocked: ${blockStatus.reason}`);
    return { success: false, error: `Domain blocked: ${blockStatus.reason}` };
  }

  // Check cache (unless force refresh)
  if (!forceRefresh) {
    const cacheResult = await checkDomainCache(supabaseClient, domain);
    if (cacheResult.cached && cacheResult.leadId) {
      console.log(`Using cached result for ${domain}`);
      return { success: true, leadId: cacheResult.leadId, fromCache: true, needsEnrichment: false };
    }
  }

  // Acquire per-domain lock (only 1 concurrent scrape per domain)
  const hasLock = await acquireLock(supabaseClient, 'domain', domain, jobId);
  if (!hasLock) {
    console.log(`Could not acquire lock for domain ${domain}`);
    return { success: false, error: 'Domain is being processed by another worker' };
  }

  try {
    // Scrape the main page
    const scrapeResult = await scrapeUrl(formattedUrl, firecrawlApiKey);
    const processingTime = Date.now() - startTime;

    if (!scrapeResult.success) {
      // Check for blocking/rate limiting
      if (scrapeResult.httpStatus && (scrapeResult.httpStatus === 403 || scrapeResult.httpStatus === 429)) {
        await markDomainBlocked(supabaseClient, domain, scrapeResult.error || 'Blocked', scrapeResult.httpStatus);
      }

      await supabaseClient.from('scraped_pages').insert({
        job_id: jobId,
        url: formattedUrl,
        domain,
        status: 'failed',
        error_message: scrapeResult.error,
        http_status: scrapeResult.httpStatus,
        processing_time_ms: processingTime,
      });
      
      return { success: false, error: scrapeResult.error };
    }

    const markdown = scrapeResult.markdown || '';
    const links = scrapeResult.links || [];

    // Record the successful page scrape
    await supabaseClient.from('scraped_pages').insert({
      job_id: jobId,
      url: formattedUrl,
      domain,
      status: 'scraped',
      markdown_content: markdown.substring(0, 50000),
      scraped_at: new Date().toISOString(),
      processing_time_ms: processingTime,
    });

    // Extract all contact information
    const allEmails = extractEmails(markdown);
    const allPhones = extractPhones(markdown);
    const contactFormUrl = extractContactFormUrl(links);
    
    const niche = schemaTemplate?.niche || undefined;
    const teamContacts = parseTeamCards(markdown, formattedUrl, niche);
    console.log(`Found ${teamContacts.length} team contacts for ${domain}`);
    
    const bestContact = selectBestContact(teamContacts);
    const fallbackName = extractName(markdown);
    
    const fullName = bestContact?.name || fallbackName;
    const contactTitle = bestContact?.title || null;
    const bestEmail = bestContact?.email || allEmails[0] || null;
    const bestPhone = bestContact?.phone || allPhones[0] || null;
    
    const contactEmails = teamContacts.map(c => c.email).filter(Boolean) as string[];
    const contactPhones = teamContacts.map(c => c.phone).filter(Boolean) as string[];
    const mergedEmails = [...new Set([...contactEmails, ...allEmails])];
    const mergedPhones = [...new Set([...contactPhones, ...allPhones])];
    
    const linkedinSearchUrl = generateLinkedInSearchUrl(domain, fullName);

    let confidenceScore = 30;
    if (mergedEmails.length > 0) confidenceScore += 20;
    if (mergedPhones.length > 0) confidenceScore += 15;
    if (fullName) confidenceScore += 15;
    if (contactTitle) confidenceScore += 10;
    if (bestContact && bestContact.email && bestContact.phone) confidenceScore += 10;
    if (contactFormUrl) confidenceScore += 5;

    const allContacts = teamContacts.map(c => ({
      name: c.name,
      title: c.title,
      email: c.email,
      phone: c.phone,
      priority: c.priority,
    }));

    const leadData: Record<string, unknown> = {
      job_id: jobId,
      domain,
      source_url: formattedUrl,
      full_name: fullName,
      best_email: bestEmail,
      best_phone: bestPhone,
      all_emails: mergedEmails,
      all_phones: mergedPhones,
      contact_form_url: contactFormUrl,
      linkedin_search_url: linkedinSearchUrl,
      confidence_score: Math.min(100, confidenceScore),
      email_source_url: bestEmail ? (bestContact?.sourceUrl || formattedUrl) : null,
      phone_source_url: bestPhone ? (bestContact?.sourceUrl || formattedUrl) : null,
      name_source_url: fullName ? (bestContact?.sourceUrl || formattedUrl) : null,
      scraped_at: new Date().toISOString(),
      status: 'new',
    };

    if (schemaTemplate) {
      leadData.schema_template_id = schemaTemplate.id;
      leadData.schema_data = {
        contact_title: contactTitle,
        all_contacts: allContacts,
        contacts_found: teamContacts.length,
      };
      leadData.schema_evidence = {
        contact_source: formattedUrl,
        extraction_method: teamContacts.length > 0 ? 'team_card_parsing' : 'regex_extraction',
      };
    } else {
      leadData.schema_data = {
        contact_title: contactTitle,
        all_contacts: allContacts,
        contacts_found: teamContacts.length,
      };
    }

    if (mergedEmails.length === 0 && mergedPhones.length === 0 && !contactFormUrl) {
      leadData.qc_flag = 'no_contact_info';
      leadData.qc_notes = 'No email, phone, or contact form found';
    } else if (!fullName && (mergedEmails.length > 0 || mergedPhones.length > 0)) {
      leadData.qc_flag = 'missing_name';
      leadData.qc_notes = 'Contact info found but no associated name';
    }

    const { data: lead, error } = await supabaseClient
      .from('scraped_leads')
      .insert(leadData)
      .select('id')
      .single();

    if (error) {
      console.error('Error inserting lead:', error);
      return { success: false, error: error.message };
    }

    // Update cache
    await updateDomainCache(supabaseClient, domain, lead.id, 1);

    return { 
      success: true, 
      leadId: lead?.id as string, 
      needsEnrichment: mergedEmails.length === 0 || mergedPhones.length === 0 || !fullName 
    };
  } finally {
    // Always release the lock
    await releaseLock(supabaseClient, 'domain', domain);
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  // Authentication check
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(
      JSON.stringify({ error: 'Authentication required' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } }
  });

  const { data: { user }, error: userError } = await authSupabase.auth.getUser();
  if (userError || !user) {
    return new Response(
      JSON.stringify({ error: 'Invalid authentication' }),
      { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const userId = user.id;

  // Check if user has admin role
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  const { data: hasAdminRole } = await supabase.rpc('has_role', { 
    _user_id: userId, 
    _role: 'admin' 
  });

  if (!hasAdminRole) {
    return new Response(
      JSON.stringify({ error: 'Admin access required' }),
      { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id;
    const batchSize = body.batch_size || DEFAULT_BATCH_SIZE;
    const autoEnrich = body.auto_enrich !== false;
    const autoValidate = body.auto_validate !== false;
    const forceRefresh = body.force_refresh || false;

    // Try to acquire global concurrency lock
    const workerId = `worker_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const hasGlobalLock = await acquireLock(supabase, 'global', workerId, workerId);
    
    if (!hasGlobalLock) {
      return new Response(
        JSON.stringify({ success: false, error: 'Global concurrency limit reached. Try again later.' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    try {
      let job: ScrapeJob | null = null;
      let schemaTemplate: SchemaTemplate | null = null;

      if (jobId) {
        const { data, error } = await supabase
          .from('scrape_jobs')
          .select('*')
          .eq('id', jobId)
          .single();
        
        if (error || !data) {
          return new Response(
            JSON.stringify({ success: false, error: 'Job not found' }),
            { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
        job = data as ScrapeJob;
      } else {
        const { data: queueItem } = await supabase
          .from('job_queue')
          .select('*')
          .eq('status', 'pending')
          .eq('job_type', 'scrape')
          .order('priority', { ascending: false })
          .order('created_at', { ascending: true })
          .limit(1)
          .single();

        if (queueItem) {
          await supabase
            .from('job_queue')
            .update({
              status: 'processing',
              locked_at: new Date().toISOString(),
            })
            .eq('id', queueItem.id);

          const { data } = await supabase
            .from('scrape_jobs')
            .select('*')
            .eq('id', queueItem.reference_id)
            .single();
          
          job = data as ScrapeJob;
        }
      }

      if (!job) {
        return new Response(
          JSON.stringify({ success: true, message: 'No jobs to process' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      if (!['queued', 'running'].includes(job.status)) {
        return new Response(
          JSON.stringify({ success: true, message: `Job is ${job.status}, skipping` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      await supabase
        .from('scrape_jobs')
        .update({ status: 'running' })
        .eq('id', job.id);

      if (job.schema_template_id) {
        const { data } = await supabase
          .from('schema_templates')
          .select('*')
          .eq('id', job.schema_template_id)
          .single();
        
        if (data) {
          schemaTemplate = data as SchemaTemplate;
        }
      }

      // Use checkpoint for resumable processing
      const startIndex = job.checkpoint_index || 0;
      const effectiveBatchSize = job.batch_size || batchSize;
      const remainingUrls = job.target_urls.slice(startIndex);
      const urlsToProcess = remainingUrls.slice(0, effectiveBatchSize);

      if (urlsToProcess.length === 0) {
        await supabase
          .from('scrape_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        await supabase
          .from('job_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('reference_id', job.id)
          .eq('job_type', 'scrape');

        return new Response(
          JSON.stringify({ success: true, message: 'Job completed', job_id: job.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Processing batch: ${urlsToProcess.length} URLs (index ${startIndex} to ${startIndex + urlsToProcess.length})`);

      const results: { url: string; success: boolean; error?: string; leadId?: string; fromCache?: boolean }[] = [];
      let newCompleted = 0;
      let newFailed = 0;
      const leadsToEnrich: string[] = [];

      for (const url of urlsToProcess) {
        try {
          const result = await processTarget(
            url,
            job.id,
            schemaTemplate,
            firecrawlApiKey,
            supabase,
            forceRefresh
          );

          results.push({ url, success: result.success, error: result.error, leadId: result.leadId, fromCache: result.fromCache });

          if (result.success) {
            newCompleted++;
            if (result.needsEnrichment && result.leadId && !result.fromCache) {
              leadsToEnrich.push(result.leadId);
            }
          } else {
            newFailed++;
          }

          // Update checkpoint after each URL for resumability
          const currentIndex = startIndex + urlsToProcess.indexOf(url) + 1;
          await supabase
            .from('scrape_jobs')
            .update({
              checkpoint_index: currentIndex,
              last_checkpoint_at: new Date().toISOString(),
              completed_targets: job.completed_targets + newCompleted,
              failed_targets: job.failed_targets + newFailed,
            })
            .eq('id', job.id);

          if (job.request_delay_ms > 0 && urlsToProcess.indexOf(url) < urlsToProcess.length - 1) {
            await new Promise(resolve => setTimeout(resolve, job.request_delay_ms));
          }
        } catch (error) {
          console.error(`Error processing ${url}:`, error);
          results.push({ url, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
          newFailed++;
        }
      }

      // Auto-enrich leads that need it
      if (autoEnrich && leadsToEnrich.length > 0) {
        console.log(`Auto-enriching ${leadsToEnrich.length} leads...`);
        try {
          await fetch(`${supabaseUrl}/functions/v1/enrich-lead`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lead_ids: leadsToEnrich }),
          });
        } catch (err) {
          console.error('Auto-enrichment failed:', err);
        }
      }

      // Auto-validate all processed leads
      const allLeadIds = results.filter(r => r.success && r.leadId && !r.fromCache).map(r => r.leadId!);
      if (autoValidate && allLeadIds.length > 0) {
        console.log(`Auto-validating ${allLeadIds.length} leads...`);
        try {
          await fetch(`${supabaseUrl}/functions/v1/validate-lead`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ lead_ids: allLeadIds }),
          });
        } catch (err) {
          console.error('Auto-validation failed:', err);
        }
      }

      // Check if job is now complete
      const newCheckpointIndex = startIndex + urlsToProcess.length;
      const isComplete = newCheckpointIndex >= job.total_targets;

      if (isComplete) {
        await supabase
          .from('scrape_jobs')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('id', job.id);

        await supabase
          .from('job_queue')
          .update({
            status: 'completed',
            completed_at: new Date().toISOString(),
          })
          .eq('reference_id', job.id)
          .eq('job_type', 'scrape');
      }

      const cachedCount = results.filter(r => r.fromCache).length;
      return new Response(
        JSON.stringify({
          success: true,
          job_id: job.id,
          processed: urlsToProcess.length,
          successful: newCompleted,
          failed: newFailed,
          from_cache: cachedCount,
          is_complete: isComplete,
          checkpoint: newCheckpointIndex,
          total: job.total_targets,
          results,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } finally {
      // Always release global lock
      await releaseLock(supabase, 'global', workerId);
    }
  } catch (error) {
    console.error('Error processing job:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
