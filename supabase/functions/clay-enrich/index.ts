import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const CLAY_API_BASE = 'https://api.clay.com/v3';

/**
 * Clay Enrichment Edge Function
 * 
 * Supports two modes:
 * 1. Direct enrichment via Clay's People & Company API (enterprise)
 * 2. Table-based enrichment: push rows to a Clay table, poll for results
 * 
 * Endpoints:
 *   POST /clay-enrich { mode: "enrich", leads: [...] }
 *   POST /clay-enrich { mode: "setup-check" }
 */

interface ClayEnrichInput {
  mode: 'enrich' | 'setup-check' | 'configure';
  leads?: Array<{
    lead_id: string;
    domain?: string;
    company_name?: string;
    full_name?: string;
    email?: string;
    linkedin_url?: string;
  }>;
  source_id?: string;
  table_id?: string;
}

interface ClayEnrichResult {
  lead_id: string;
  full_name?: string;
  email?: string;
  phone?: string;
  job_title?: string;
  linkedin_url?: string;
  company_name?: string;
  employee_count?: number;
  industry?: string;
  annual_revenue?: string;
  clay_row_id?: string;
  raw_data?: Record<string, unknown>;
}

async function fetchClay(path: string, apiKey: string, options: RequestInit = {}): Promise<Response> {
  const url = `${CLAY_API_BASE}${path}`;
  return fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
}

// Push leads to a Clay table source for enrichment
async function pushLeadsToClay(
  leads: ClayEnrichInput['leads'],
  sourceId: string,
  apiKey: string
): Promise<{ success: boolean; rows_added: number; errors: string[] }> {
  const errors: string[] = [];
  let rowsAdded = 0;

  // Clay expects rows with column data matching the table schema
  const rows = (leads || []).map(lead => ({
    'Company Domain': lead.domain || '',
    'Company Name': lead.company_name || '',
    'Full Name': lead.full_name || '',
    'Email': lead.email || '',
    'LinkedIn URL': lead.linkedin_url || '',
    '_brivano_lead_id': lead.lead_id,
  }));

  try {
    // Add rows in batches of 50
    const batchSize = 50;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      
      const response = await fetchClay(`/sources/${sourceId}/rows`, apiKey, {
        method: 'POST',
        body: JSON.stringify({ rows: batch }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Clay API error [${response.status}]:`, errorText);
        errors.push(`Batch ${Math.floor(i / batchSize) + 1}: HTTP ${response.status} - ${errorText}`);
        continue;
      }

      const data = await response.json();
      rowsAdded += batch.length;
      console.log(`Clay batch ${Math.floor(i / batchSize) + 1}: ${batch.length} rows added`);
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Push failed: ${msg}`);
    console.error('Clay push error:', error);
  }

  return { success: rowsAdded > 0, rows_added: rowsAdded, errors };
}

// Fetch enriched rows from Clay table
async function fetchEnrichedRows(
  tableId: string,
  apiKey: string,
  leadIds?: string[]
): Promise<ClayEnrichResult[]> {
  const results: ClayEnrichResult[] = [];
  
  try {
    const response = await fetchClay(`/tables/${tableId}/rows?limit=100`, apiKey, {
      method: 'GET',
    });

    if (!response.ok) {
      console.error(`Clay fetch rows error [${response.status}]:`, await response.text());
      return results;
    }

    const data = await response.json();
    const rows = data.rows || data.data || [];

    for (const row of rows) {
      const fields = row.fields || row;
      const leadId = fields['_brivano_lead_id'];
      
      // If we have specific lead IDs, only include matching rows
      if (leadIds && leadIds.length > 0 && !leadIds.includes(leadId)) continue;

      results.push({
        lead_id: leadId || row.id,
        full_name: fields['Full Name'] || fields['Contact Name'] || fields['Name'] || null,
        email: fields['Work Email'] || fields['Email'] || fields['Personal Email'] || null,
        phone: fields['Phone Number'] || fields['Mobile Phone'] || fields['Direct Phone'] || null,
        job_title: fields['Job Title'] || fields['Title'] || null,
        linkedin_url: fields['LinkedIn URL'] || fields['LinkedIn'] || null,
        company_name: fields['Company Name'] || fields['Company'] || null,
        employee_count: fields['Employee Count'] || fields['Company Size'] || null,
        industry: fields['Industry'] || fields['Company Industry'] || null,
        annual_revenue: fields['Annual Revenue'] || fields['Revenue'] || null,
        clay_row_id: row.id,
        raw_data: fields,
      });
    }
  } catch (error) {
    console.error('Clay fetch error:', error);
  }

  return results;
}

// Direct enrichment - try Clay's People & Company API (enterprise feature)
async function directEnrich(
  leads: ClayEnrichInput['leads'],
  apiKey: string
): Promise<{ results: ClayEnrichResult[]; supported: boolean }> {
  const results: ClayEnrichResult[] = [];
  
  for (const lead of leads || []) {
    try {
      // Try person enrichment by domain/name
      const params = new URLSearchParams();
      if (lead.domain) params.set('company_domain', lead.domain);
      if (lead.full_name) params.set('name', lead.full_name);
      if (lead.email) params.set('email', lead.email);
      if (lead.linkedin_url) params.set('linkedin_url', lead.linkedin_url);

      const response = await fetchClay(`/people/enrich?${params.toString()}`, apiKey, {
        method: 'GET',
      });

      if (response.status === 404 || response.status === 403) {
        // This endpoint may not be available on non-enterprise plans
        return { results: [], supported: false };
      }

      if (!response.ok) {
        console.error(`Clay direct enrich error [${response.status}]`);
        continue;
      }

      const data = await response.json();
      results.push({
        lead_id: lead.lead_id,
        full_name: data.full_name || data.name || null,
        email: data.work_email || data.email || null,
        phone: data.phone_number || data.mobile_phone || null,
        job_title: data.job_title || data.title || null,
        linkedin_url: data.linkedin_url || null,
        company_name: data.company_name || data.organization?.name || null,
        employee_count: data.company_employee_count || null,
        industry: data.company_industry || null,
        annual_revenue: data.company_annual_revenue || null,
        raw_data: data,
      });
    } catch (error) {
      console.error(`Clay direct enrich error for ${lead.lead_id}:`, error);
    }
  }

  return { results, supported: true };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const CLAY_API_KEY = Deno.env.get('CLAY_API_KEY');
    if (!CLAY_API_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'CLAY_API_KEY is not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: ClayEnrichInput = await req.json();

    // Setup check - verify API key works
    if (body.mode === 'setup-check') {
      try {
        const response = await fetchClay('/tables', CLAY_API_KEY, { method: 'GET' });
        const ok = response.ok;
        const data = ok ? await response.json() : null;
        return new Response(
          JSON.stringify({ 
            success: ok, 
            connected: ok,
            tables: ok ? (data.tables || data.data || []).map((t: any) => ({
              id: t.id,
              name: t.name,
            })) : [],
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } catch (error) {
        return new Response(
          JSON.stringify({ success: false, connected: false, error: 'Failed to connect to Clay API' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Enrich mode
    if (body.mode === 'enrich') {
      if (!body.leads?.length) {
        return new Response(
          JSON.stringify({ success: false, error: 'No leads provided' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log(`Clay enrichment: ${body.leads.length} leads`);

      // Strategy 1: Try direct enrichment API first (enterprise)
      const directResult = await directEnrich(body.leads, CLAY_API_KEY);
      
      if (directResult.supported && directResult.results.length > 0) {
        console.log(`Clay direct enrichment: ${directResult.results.length} results`);
        return new Response(
          JSON.stringify({
            success: true,
            method: 'direct_api',
            results: directResult.results,
            enriched_count: directResult.results.length,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Strategy 2: Table-based enrichment
      if (body.source_id) {
        const pushResult = await pushLeadsToClay(body.leads, body.source_id, CLAY_API_KEY);
        
        let enrichedResults: ClayEnrichResult[] = [];
        if (pushResult.success && body.table_id) {
          // Wait a bit for enrichment to process, then fetch
          await new Promise(resolve => setTimeout(resolve, 5000));
          const leadIds = body.leads.map(l => l.lead_id);
          enrichedResults = await fetchEnrichedRows(body.table_id, CLAY_API_KEY, leadIds);
        }

        return new Response(
          JSON.stringify({
            success: pushResult.success,
            method: 'table_enrichment',
            rows_added: pushResult.rows_added,
            results: enrichedResults,
            enriched_count: enrichedResults.length,
            errors: pushResult.errors,
            note: enrichedResults.length === 0 
              ? 'Leads pushed to Clay. Enrichment may still be processing. Fetch results later.' 
              : undefined,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // No table configured - try direct only approach
      if (!directResult.supported) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Clay direct enrichment API not available on your plan. Please configure a Clay table source ID for table-based enrichment.',
            setup_required: true,
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          method: 'direct_api',
          results: directResult.results,
          enriched_count: directResult.results.length,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Invalid mode. Use "enrich" or "setup-check".' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Clay enrichment error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Clay enrichment failed' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
