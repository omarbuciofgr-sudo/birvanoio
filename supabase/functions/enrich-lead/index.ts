import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnrichmentResult {
  full_name?: string;
  email?: string;
  phone?: string;
  company_name?: string;
  job_title?: string;
  linkedin_url?: string;
  provider: string;
  fields_enriched: string[];
}

// Generate LinkedIn search URL (safe, does not scrape)
function generateLinkedInSearchUrl(companyName?: string, name?: string, jobTitle?: string): string {
  const parts: string[] = [];
  if (name) parts.push(name);
  if (companyName) parts.push(companyName);
  if (jobTitle) parts.push(jobTitle);
  
  const query = parts.join(' ');
  return `https://www.linkedin.com/search/results/people/?keywords=${encodeURIComponent(query)}`;
}

// Apollo.io API enrichment
async function enrichWithApollo(
  domain: string,
  name?: string | null,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
    // Domain search to find people
    const response = await fetch('https://api.apollo.io/v1/mixed_people/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache',
      },
      body: JSON.stringify({
        api_key: apiKey,
        q_organization_domains: domain,
        page: 1,
        per_page: 5,
      }),
    });

    const data = await response.json();
    
    if (data.people && data.people.length > 0) {
      // Find best match (prefer owner/founder/CEO, or first person)
      const priorityTitles = ['owner', 'ceo', 'founder', 'president', 'director', 'manager'];
      let bestMatch = data.people[0];
      
      for (const person of data.people) {
        const title = (person.title || '').toLowerCase();
        if (priorityTitles.some(pt => title.includes(pt))) {
          bestMatch = person;
          break;
        }
      }

      const fieldsEnriched: string[] = [];
      if (bestMatch.name) fieldsEnriched.push('full_name');
      if (bestMatch.email) fieldsEnriched.push('email');
      if (bestMatch.phone_numbers?.[0]) fieldsEnriched.push('phone');
      if (bestMatch.organization?.name) fieldsEnriched.push('company_name');
      if (bestMatch.title) fieldsEnriched.push('job_title');
      if (bestMatch.linkedin_url) fieldsEnriched.push('linkedin_url');

      return {
        full_name: bestMatch.name,
        email: bestMatch.email,
        phone: bestMatch.phone_numbers?.[0]?.number,
        company_name: bestMatch.organization?.name,
        job_title: bestMatch.title,
        linkedin_url: bestMatch.linkedin_url,
        provider: 'apollo',
        fields_enriched: fieldsEnriched,
      };
    }

    return null;
  } catch (error) {
    console.error('Apollo enrichment error:', error);
    return null;
  }
}

// Hunter.io email finder
async function findEmailWithHunter(
  domain: string,
  firstName?: string,
  lastName?: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
    // If we have a name, try to find specific email
    if (firstName && lastName) {
      const response = await fetch(
        `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${firstName}&last_name=${lastName}&api_key=${apiKey}`
      );
      const data = await response.json();

      if (data.data?.email) {
        return {
          email: data.data.email,
          provider: 'hunter',
          fields_enriched: ['email'],
        };
      }
    }

    // Fall back to domain search
    const response = await fetch(
      `https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=5`
    );
    const data = await response.json();

    if (data.data?.emails?.[0]) {
      const bestEmail = data.data.emails[0];
      const fieldsEnriched: string[] = ['email'];
      
      const result: EnrichmentResult = {
        email: bestEmail.value,
        provider: 'hunter',
        fields_enriched: fieldsEnriched,
      };

      if (bestEmail.first_name && bestEmail.last_name) {
        result.full_name = `${bestEmail.first_name} ${bestEmail.last_name}`;
        fieldsEnriched.push('full_name');
      }
      if (bestEmail.position) {
        result.job_title = bestEmail.position;
        fieldsEnriched.push('job_title');
      }
      if (bestEmail.linkedin) {
        result.linkedin_url = bestEmail.linkedin;
        fieldsEnriched.push('linkedin_url');
      }

      return result;
    }

    return null;
  } catch (error) {
    console.error('Hunter enrichment error:', error);
    return null;
  }
}

// Clearbit company enrichment
async function enrichWithClearbit(
  domain: string,
  apiKey?: string
): Promise<EnrichmentResult | null> {
  if (!apiKey) return null;

  try {
    const response = await fetch(
      `https://company.clearbit.com/v2/companies/find?domain=${domain}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) return null;

    const data = await response.json();
    const fieldsEnriched: string[] = [];

    if (data.name) fieldsEnriched.push('company_name');

    return {
      company_name: data.name,
      provider: 'clearbit',
      fields_enriched: fieldsEnriched,
    };
  } catch (error) {
    console.error('Clearbit enrichment error:', error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const apolloApiKey = Deno.env.get('APOLLO_API_KEY');
  const hunterApiKey = Deno.env.get('HUNTER_API_KEY');
  const clearbitApiKey = Deno.env.get('CLEARBIT_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const body = await req.json().catch(() => ({}));
    const { lead_id, lead_ids } = body;

    const idsToProcess = lead_ids || (lead_id ? [lead_id] : []);

    if (idsToProcess.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: 'No lead IDs provided' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check which providers are enabled
    const { data: providersConfig } = await supabase
      .from('enrichment_providers_config')
      .select('*')
      .eq('is_enabled', true);

    const enabledProviders = new Set(providersConfig?.map(p => p.provider) || []);

    console.log(`Enriching ${idsToProcess.length} lead(s) with providers: ${Array.from(enabledProviders).join(', ')}`);

    const results: { lead_id: string; enrichments: EnrichmentResult[] }[] = [];

    for (const leadId of idsToProcess) {
      const { data: lead, error: fetchError } = await supabase
        .from('scraped_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (fetchError || !lead) {
        results.push({ lead_id: leadId, enrichments: [] });
        continue;
      }

      const enrichments: EnrichmentResult[] = [];
      const updates: Record<string, unknown> = {};
      const providersUsed: string[] = lead.enrichment_providers_used || [];

      // Determine what's missing
      const needsName = !lead.full_name;
      const needsEmail = !lead.best_email;
      const needsPhone = !lead.best_phone;
      const needsCompany = !lead.schema_data?.company_name;
      const needsJobTitle = !lead.schema_data?.job_title;

      // Skip if everything is filled
      if (!needsName && !needsEmail && !needsPhone && !needsCompany && !needsJobTitle) {
        // Just ensure LinkedIn URL is generated
        if (!lead.linkedin_search_url) {
          updates.linkedin_search_url = generateLinkedInSearchUrl(
            lead.schema_data?.company_name as string,
            lead.full_name,
            lead.schema_data?.job_title as string
          );
        }
        results.push({ lead_id: leadId, enrichments: [] });
        continue;
      }

      // Try Apollo first (best for B2B)
      if (enabledProviders.has('apollo') && apolloApiKey) {
        const apolloResult = await enrichWithApollo(lead.domain, lead.full_name, apolloApiKey);
        if (apolloResult) {
          enrichments.push(apolloResult);
          providersUsed.push('apollo');

          // Apply enriched data
          if (apolloResult.full_name && needsName) {
            updates.full_name = apolloResult.full_name;
            updates.name_source_url = null; // Will be marked as enrichment
          }
          if (apolloResult.email && needsEmail) {
            updates.best_email = apolloResult.email;
            const allEmails = lead.all_emails || [];
            if (!allEmails.includes(apolloResult.email)) {
              updates.all_emails = [...allEmails, apolloResult.email];
            }
          }
          if (apolloResult.phone && needsPhone) {
            updates.best_phone = apolloResult.phone;
            const allPhones = lead.all_phones || [];
            if (!allPhones.includes(apolloResult.phone)) {
              updates.all_phones = [...allPhones, apolloResult.phone];
            }
          }
          if (apolloResult.company_name || apolloResult.job_title) {
            updates.schema_data = {
              ...(lead.schema_data || {}),
              ...(apolloResult.company_name ? { company_name: apolloResult.company_name } : {}),
              ...(apolloResult.job_title ? { job_title: apolloResult.job_title } : {}),
            };
          }
          if (apolloResult.linkedin_url) {
            updates.linkedin_search_url = apolloResult.linkedin_url;
          }

          // Log enrichment
          await supabase.from('enrichment_logs').insert({
            lead_id: leadId,
            provider: 'apollo',
            action: 'person_lookup',
            fields_enriched: apolloResult.fields_enriched,
            success: true,
          });
        }
      }

      // Try Hunter if still missing email
      if (enabledProviders.has('hunter') && hunterApiKey && (!updates.best_email && needsEmail)) {
        const nameParts = (updates.full_name || lead.full_name)?.split(' ') || [];
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || undefined;

        const hunterResult = await findEmailWithHunter(lead.domain, firstName, lastName, hunterApiKey);
        if (hunterResult) {
          enrichments.push(hunterResult);
          providersUsed.push('hunter');

          if (hunterResult.email) {
            updates.best_email = hunterResult.email;
            const allEmails = updates.all_emails as string[] || lead.all_emails || [];
            if (!allEmails.includes(hunterResult.email)) {
              updates.all_emails = [...allEmails, hunterResult.email];
            }
          }
          if (hunterResult.full_name && !updates.full_name && needsName) {
            updates.full_name = hunterResult.full_name;
          }
          if (hunterResult.job_title) {
            updates.schema_data = {
              ...(updates.schema_data || lead.schema_data || {}),
              job_title: hunterResult.job_title,
            };
          }

          await supabase.from('enrichment_logs').insert({
            lead_id: leadId,
            provider: 'hunter',
            action: 'email_discovery',
            fields_enriched: hunterResult.fields_enriched,
            success: true,
          });
        }
      }

      // Try Clearbit for company enrichment
      if (enabledProviders.has('clearbit') && clearbitApiKey && needsCompany) {
        const clearbitResult = await enrichWithClearbit(lead.domain, clearbitApiKey);
        if (clearbitResult) {
          enrichments.push(clearbitResult);
          providersUsed.push('clearbit');

          if (clearbitResult.company_name) {
            updates.schema_data = {
              ...(updates.schema_data || lead.schema_data || {}),
              company_name: clearbitResult.company_name,
            };
          }

          await supabase.from('enrichment_logs').insert({
            lead_id: leadId,
            provider: 'clearbit',
            action: 'company_lookup',
            fields_enriched: clearbitResult.fields_enriched,
            success: true,
          });
        }
      }

      // Generate LinkedIn search URL if not set
      if (!lead.linkedin_search_url && !updates.linkedin_search_url) {
        const companyName = (updates.schema_data as Record<string, unknown>)?.company_name as string || 
          lead.schema_data?.company_name as string || lead.domain;
        const fullName = updates.full_name as string || lead.full_name;
        const jobTitle = (updates.schema_data as Record<string, unknown>)?.job_title as string ||
          lead.schema_data?.job_title as string;

        updates.linkedin_search_url = generateLinkedInSearchUrl(companyName, fullName, jobTitle);
      }

      // Store enrichment data
      if (enrichments.length > 0) {
        updates.enrichment_data = {
          ...(lead.enrichment_data || {}),
          last_enriched_at: new Date().toISOString(),
          enrichment_results: enrichments,
        };
        updates.enrichment_providers_used = [...new Set(providersUsed)];

        // Recalculate confidence score
        let newScore = lead.confidence_score || 30;
        if (updates.best_email) newScore += 15;
        if (updates.best_phone) newScore += 10;
        if (updates.full_name) newScore += 10;
        updates.confidence_score = Math.min(100, newScore);
      }

      // Apply updates
      if (Object.keys(updates).length > 0) {
        await supabase
          .from('scraped_leads')
          .update(updates)
          .eq('id', leadId);
      }

      results.push({ lead_id: leadId, enrichments });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in enrich-lead:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
