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

// Priority titles for contact selection (higher index = higher priority)
const TITLE_PRIORITY: string[] = [
  'assistant',
  'coordinator',
  'specialist',
  'associate',
  'representative',
  'agent',
  'consultant',
  'advisor',
  'analyst',
  'office manager',
  'operations manager',
  'leasing manager',
  'property manager',
  'regional manager',
  'general manager',
  'managing director',
  'director',
  'vice president',
  'vp',
  'president',
  'ceo',
  'chief executive officer',
  'founder',
  'co-founder',
  'owner',
  'principal',
  'partner',
];

// B2B decision-maker titles (for niche-specific prioritization)
const B2B_DECISION_MAKER_TITLES: string[] = [
  'cto', 'chief technology officer',
  'cio', 'chief information officer',
  'cfo', 'chief financial officer',
  'cmo', 'chief marketing officer',
  'coo', 'chief operating officer',
  'vp of engineering', 'vp engineering',
  'vp of sales', 'vp sales',
  'vp of marketing', 'vp marketing',
  'head of',
  'director of',
];

interface ContactInfo {
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  sourceUrl: string | null;
  priority: number;
}

// Get priority score for a title
function getTitlePriority(title: string | null, niche?: string): number {
  if (!title) return 0;
  const lowerTitle = title.toLowerCase();
  
  // Check for B2B decision-maker titles if niche is B2B
  if (niche?.toLowerCase().includes('b2b')) {
    for (const dmTitle of B2B_DECISION_MAKER_TITLES) {
      if (lowerTitle.includes(dmTitle)) {
        return 100 + B2B_DECISION_MAKER_TITLES.indexOf(dmTitle);
      }
    }
  }
  
  // Check standard priority titles
  for (let i = TITLE_PRIORITY.length - 1; i >= 0; i--) {
    if (lowerTitle.includes(TITLE_PRIORITY[i])) {
      return i + 1;
    }
  }
  
  return 0;
}

// Parse team/staff cards and extract associated contact info
function parseTeamCards(markdown: string, sourceUrl: string, niche?: string): ContactInfo[] {
  const contacts: ContactInfo[] = [];
  
  // Pattern 1: Markdown-style cards with headers and content
  // e.g., "### John Smith\n**Owner**\njohn@example.com\n(555) 123-4567"
  const cardPattern1 = /#{2,4}\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\n+(?:\*{1,2}([^*\n]+)\*{1,2})?\s*\n*([\s\S]*?)(?=\n#{2,4}|\n\n\n|$)/gi;
  
  // Pattern 2: List-style team members
  // e.g., "- **Name**: John Smith | **Title**: Owner | **Email**: john@example.com"
  const cardPattern2 = /[-*]\s*(?:\*{1,2})?(?:name)?:?\s*\*{0,2}\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)[|\n].*?(?:title|role|position)?:?\s*([^|\n]+)?[|\n]?.*?([\s\S]*?)(?=\n[-*]|\n\n|$)/gi;
  
  // Pattern 3: Card/section blocks (div-like structures in markdown)
  // e.g., content between horizontal rules or section breaks
  const cardPattern3 = /(?:^|\n)([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\s*\n+([^#\n][^\n]+)?\s*\n*((?:[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}|(?:\+?1[-.\s]?)?(?:\(\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4})[\s\S]*?)(?=\n[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\s*\n|\n\n\n|$)/gi;
  
  // Pattern 4: Explicit label patterns
  // e.g., "Contact: John Smith, CEO"
  const labelPattern = /(?:contact|agent|manager|broker|representative|team member|staff):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)(?:,?\s*([^,\n]+))?/gi;
  
  let match;
  
  // Extract from Pattern 1
  while ((match = cardPattern1.exec(markdown)) !== null) {
    const name = match[1]?.trim();
    const title = match[2]?.trim() || null;
    const content = match[3] || '';
    
    if (name && name.split(' ').length >= 2) {
      const emails = extractEmails(content);
      const phones = extractPhones(content);
      
      contacts.push({
        name,
        title,
        email: emails[0] || null,
        phone: phones[0] || null,
        sourceUrl,
        priority: getTitlePriority(title, niche),
      });
    }
  }
  
  // Extract from Pattern 4 (label patterns)
  while ((match = labelPattern.exec(markdown)) !== null) {
    const name = match[1]?.trim();
    const title = match[2]?.trim() || null;
    
    if (name && name.split(' ').length >= 2) {
      // Look for email/phone near this match
      const contextStart = Math.max(0, match.index - 100);
      const contextEnd = Math.min(markdown.length, match.index + match[0].length + 200);
      const context = markdown.substring(contextStart, contextEnd);
      
      const emails = extractEmails(context);
      const phones = extractPhones(context);
      
      // Check if this contact already exists
      const exists = contacts.some(c => 
        c.name?.toLowerCase() === name.toLowerCase()
      );
      
      if (!exists) {
        contacts.push({
          name,
          title,
          email: emails[0] || null,
          phone: phones[0] || null,
          sourceUrl,
          priority: getTitlePriority(title, niche),
        });
      }
    }
  }
  
  // Extract from structured sections (About/Team/Staff/Leadership)
  const teamSectionPattern = /(?:#+\s*(?:our\s*)?(?:team|staff|leadership|management|agents?|brokers?|about\s*us)[\s\S]*?)(?=\n#+[^#]|\n\n\n|$)/gi;
  
  while ((match = teamSectionPattern.exec(markdown)) !== null) {
    const sectionContent = match[0];
    
    // Look for name + title patterns within the section
    const nameWithTitlePattern = /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)[\s,\-–|]+(?:is\s+(?:our|the)\s+)?([A-Za-z\s,]+?(?:owner|founder|ceo|president|director|manager|agent|broker|coordinator|specialist)[A-Za-z\s,]*?)(?=\.|,|\n|$)/gi;
    
    let innerMatch;
    while ((innerMatch = nameWithTitlePattern.exec(sectionContent)) !== null) {
      const name = innerMatch[1]?.trim();
      const title = innerMatch[2]?.trim();
      
      if (name && name.split(' ').length >= 2) {
        // Look for email/phone near this name
        const contextStart = Math.max(0, innerMatch.index);
        const contextEnd = Math.min(sectionContent.length, innerMatch.index + 300);
        const context = sectionContent.substring(contextStart, contextEnd);
        
        const emails = extractEmails(context);
        const phones = extractPhones(context);
        
        const exists = contacts.some(c => 
          c.name?.toLowerCase() === name.toLowerCase()
        );
        
        if (!exists) {
          contacts.push({
            name,
            title,
            email: emails[0] || null,
            phone: phones[0] || null,
            sourceUrl,
            priority: getTitlePriority(title, niche),
          });
        }
      }
    }
  }
  
  return contacts;
}

// Select the best contact based on priority and data completeness
function selectBestContact(contacts: ContactInfo[], niche?: string): ContactInfo | null {
  if (contacts.length === 0) return null;
  
  // Sort by priority (descending), then by data completeness
  return contacts.sort((a, b) => {
    // First, compare priority
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    
    // Then, prefer contacts with more data
    const aScore = (a.email ? 2 : 0) + (a.phone ? 1 : 0);
    const bScore = (b.email ? 2 : 0) + (b.phone ? 1 : 0);
    return bScore - aScore;
  })[0];
}

// Extract names from text (enhanced version)
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

  // Extract all contact information from page
  const allEmails = extractEmails(markdown);
  const allPhones = extractPhones(markdown);
  const contactFormUrl = extractContactFormUrl(links, formattedUrl);
  
  // Get niche from schema template for prioritization
  const niche = schemaTemplate?.niche || undefined;
  
  // Parse team/staff cards to find associated contacts
  const teamContacts = parseTeamCards(markdown, formattedUrl, niche);
  console.log(`Found ${teamContacts.length} team contacts for ${domain}`);
  
  // Select the best contact based on title priority and data completeness
  const bestContact = selectBestContact(teamContacts, niche);
  
  // Fallback to simple extraction if no team cards found
  const fallbackName = extractName(markdown);
  
  // Determine final contact info
  const fullName = bestContact?.name || fallbackName;
  const contactTitle = bestContact?.title || null;
  const bestEmail = bestContact?.email || allEmails[0] || null;
  const bestPhone = bestContact?.phone || allPhones[0] || null;
  
  // Collect all emails and phones (from team cards + page-wide extraction)
  const contactEmails = teamContacts.map(c => c.email).filter(Boolean) as string[];
  const contactPhones = teamContacts.map(c => c.phone).filter(Boolean) as string[];
  const mergedEmails = [...new Set([...contactEmails, ...allEmails])];
  const mergedPhones = [...new Set([...contactPhones, ...allPhones])];
  
  // Generate LinkedIn search URL with best contact info
  const linkedinSearchUrl = generateLinkedInSearchUrl(domain, fullName);

  // Calculate confidence score based on data quality
  let confidenceScore = 30; // Base score
  if (mergedEmails.length > 0) confidenceScore += 20;
  if (mergedPhones.length > 0) confidenceScore += 15;
  if (fullName) confidenceScore += 15;
  if (contactTitle) confidenceScore += 10; // Bonus for having a title
  if (bestContact && bestContact.email && bestContact.phone) confidenceScore += 10; // Bonus for associated contact
  if (contactFormUrl) confidenceScore += 5;

  // Prepare lead data with all contacts for reference
  const allContacts = teamContacts.map(c => ({
    name: c.name,
    title: c.title,
    email: c.email,
    phone: c.phone,
    priority: c.priority,
  }));

  // Prepare lead data
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

  // Add schema template if provided
  if (schemaTemplate) {
    leadData.schema_template_id = schemaTemplate.id;
    
    // Store extracted contacts and title info in schema_data
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
    // Even without schema, store contact details in schema_data
    leadData.schema_data = {
      contact_title: contactTitle,
      all_contacts: allContacts,
      contacts_found: teamContacts.length,
    };
  }

  // Set QC flags for data quality issues
  if (mergedEmails.length === 0 && mergedPhones.length === 0 && !contactFormUrl) {
    leadData.qc_flag = 'no_contact_info';
    leadData.qc_notes = 'No email, phone, or contact form found';
  } else if (!fullName && (mergedEmails.length > 0 || mergedPhones.length > 0)) {
    leadData.qc_flag = 'missing_name';
    leadData.qc_notes = 'Contact info found but no associated name';
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

  return { 
    success: true, 
    leadId: lead?.id as string, 
    needsEnrichment: mergedEmails.length === 0 || mergedPhones.length === 0 || !fullName 
  };
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
