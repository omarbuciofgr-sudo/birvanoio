import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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
}

interface SchemaTemplate {
  id: string;
  name: string;
  niche: string;
  fields: SchemaField[];
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
  // Filter out common false positives
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
  // Match various phone formats
  const phoneRegex = /(?:\+?1[-.\s]?)?(?:\(\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g;
  const matches = text.match(phoneRegex) || [];
  return [...new Set(matches.map(p => p.replace(/\D/g, '')))].filter(p => p.length >= 10 && p.length <= 11);
}

// Extract names from text (simple heuristic)
function extractName(text: string): string | null {
  // Look for common patterns like "Contact: John Smith" or "Owner: Jane Doe"
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

// Extract contact form URL from links
function extractContactFormUrl(links: string[], baseUrl: string): string | null {
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
  const searchQuery = name 
    ? `${name} ${companyName}`
    : companyName;
  return `https://www.linkedin.com/search/results/all/?keywords=${encodeURIComponent(searchQuery)}`;
}

// Scrape a single URL using Firecrawl
async function scrapeUrl(url: string, apiKey: string): Promise<{
  success: boolean;
  markdown?: string;
  html?: string;
  links?: string[];
  error?: string;
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
      return { success: false, error: data.error || `HTTP ${response.status}` };
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

// Process a single target URL and extract lead data
async function processTarget(
  url: string,
  jobId: string,
  schemaTemplate: SchemaTemplate | null,
  firecrawlApiKey: string,
  // deno-lint-ignore no-explicit-any
  supabaseClient: any
): Promise<{ success: boolean; leadId?: string; error?: string; needsEnrichment?: boolean }> {
  const domain = extractDomain(url);
  const formattedUrl = formatUrl(url);

  console.log(`Processing: ${domain}`);

  // Scrape the main page
  const scrapeResult = await scrapeUrl(formattedUrl, firecrawlApiKey);

  if (!scrapeResult.success) {
    // Record the failed page
    await supabaseClient.from('scraped_pages').insert({
      job_id: jobId,
      url: formattedUrl,
      domain,
      status: 'failed',
      error_message: scrapeResult.error,
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
    markdown_content: markdown.substring(0, 50000), // Limit storage
    scraped_at: new Date().toISOString(),
  });

  // Extract contact information
  const emails = extractEmails(markdown);
  const phones = extractPhones(markdown);
  const fullName = extractName(markdown);
  const contactFormUrl = extractContactFormUrl(links, formattedUrl);
  const linkedinSearchUrl = generateLinkedInSearchUrl(domain, fullName);

  // Calculate confidence score based on data quality
  let confidenceScore = 30; // Base score
  if (emails.length > 0) confidenceScore += 25;
  if (phones.length > 0) confidenceScore += 20;
  if (fullName) confidenceScore += 15;
  if (contactFormUrl) confidenceScore += 10;

  // Prepare lead data
  const leadData: Record<string, unknown> = {
    job_id: jobId,
    domain,
    source_url: formattedUrl,
    full_name: fullName,
    best_email: emails[0] || null,
    best_phone: phones[0] || null,
    all_emails: emails,
    all_phones: phones,
    contact_form_url: contactFormUrl,
    linkedin_search_url: linkedinSearchUrl,
    confidence_score: Math.min(100, confidenceScore),
    email_source_url: emails.length > 0 ? formattedUrl : null,
    phone_source_url: phones.length > 0 ? formattedUrl : null,
    name_source_url: fullName ? formattedUrl : null,
    scraped_at: new Date().toISOString(),
    status: 'new',
  };

  // Add schema template if provided
  if (schemaTemplate) {
    leadData.schema_template_id = schemaTemplate.id;
    
    // Extract schema-specific fields using AI (placeholder - would need LLM integration)
    // For now, we'll leave schema_data empty
    leadData.schema_data = {};
    leadData.schema_evidence = {};
  }

  // Set QC flags for data quality issues
  if (emails.length === 0 && phones.length === 0 && !contactFormUrl) {
    leadData.qc_flag = 'no_contact_info';
    leadData.qc_notes = 'No email, phone, or contact form found';
  }

  // Insert the lead
  const { data: lead, error } = await supabaseClient
    .from('scraped_leads')
    .insert(leadData)
    .select('id')
    .single();

  if (error) {
    console.error('Error inserting lead:', error);
    return { success: false, error: error.message };
  }

  return { success: true, leadId: lead?.id as string, needsEnrichment: emails.length === 0 || phones.length === 0 || !fullName };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!firecrawlApiKey) {
    console.error('FIRECRAWL_API_KEY not configured');
    return new Response(
      JSON.stringify({ success: false, error: 'Firecrawl connector not configured' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = body.job_id;
    const batchSize = body.batch_size || 5; // Process N URLs per invocation
    const autoEnrich = body.auto_enrich !== false; // Default to true
    const autoValidate = body.auto_validate !== false; // Default to true

    // If specific job ID provided, process that job
    // Otherwise, pick up from queue
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
      // Get next job from queue
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
        // Lock the queue item
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

    // Check if job is in a processable state
    if (!['queued', 'running'].includes(job.status)) {
      return new Response(
        JSON.stringify({ success: true, message: `Job is ${job.status}, skipping` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update job to running
    await supabase
      .from('scrape_jobs')
      .update({ status: 'running' })
      .eq('id', job.id);

    // Get schema template if specified
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

    // Determine which URLs to process
    const processedCount = job.completed_targets + job.failed_targets;
    const remainingUrls = job.target_urls.slice(processedCount);
    const urlsToProcess = remainingUrls.slice(0, batchSize);

    if (urlsToProcess.length === 0) {
      // Job is complete
      await supabase
        .from('scrape_jobs')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      // Update queue item
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

    console.log(`Processing ${urlsToProcess.length} URLs for job ${job.id}`);

    // Process each URL
    const results: { url: string; success: boolean; error?: string; leadId?: string }[] = [];
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
          supabase
        );

        results.push({ url, success: result.success, error: result.error, leadId: result.leadId });

        if (result.success) {
          newCompleted++;
          // Track leads that need enrichment (missing contact info)
          if (result.needsEnrichment && result.leadId) {
            leadsToEnrich.push(result.leadId);
          }
        } else {
          newFailed++;
        }

        // Delay between requests
        if (job.request_delay_ms > 0 && urlsToProcess.indexOf(url) < urlsToProcess.length - 1) {
          await new Promise(resolve => setTimeout(resolve, job.request_delay_ms));
        }
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        results.push({ url, success: false, error: error instanceof Error ? error.message : 'Unknown error' });
        newFailed++;
      }

      // Update progress after each URL
      await supabase
        .from('scrape_jobs')
        .update({
          completed_targets: job.completed_targets + newCompleted,
          failed_targets: job.failed_targets + newFailed,
        })
        .eq('id', job.id);
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
    const allLeadIds = results.filter(r => r.success && r.leadId).map(r => r.leadId!);
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
    const totalProcessed = job.completed_targets + job.failed_targets + newCompleted + newFailed;
    const isComplete = totalProcessed >= job.total_targets;

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

    return new Response(
      JSON.stringify({
        success: true,
        job_id: job.id,
        processed: results.length,
        completed: newCompleted,
        failed: newFailed,
        is_complete: isComplete,
        results,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in process-scrape-job:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
