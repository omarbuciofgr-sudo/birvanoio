import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Normalize email for comparison
function normalizeEmail(email: string | null): string | null {
  if (!email) return null;
  return email.toLowerCase().trim();
}

// Normalize phone for comparison (remove all non-digits)
function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  // Remove leading 1 for US numbers
  if (digits.length === 11 && digits.startsWith('1')) {
    return digits.substring(1);
  }
  return digits.length >= 10 ? digits : null;
}

// Normalize name for comparison
function normalizeName(name: string | null): string | null {
  if (!name) return null;
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

interface LeadForDedup {
  id: string;
  domain: string;
  best_email: string | null;
  best_phone: string | null;
  full_name: string | null;
  schema_data: Record<string, unknown> | null;
  confidence_score: number;
  email_validation_status: string | null;
  phone_validation_status: string | null;
  created_at: string;
}

interface DuplicateMatch {
  primary_id: string;
  duplicate_id: string;
  match_reason: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

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
    const { job_id, lead_ids, auto_merge = false } = body;

    // Get leads to check for duplicates
    let leadsToCheck: LeadForDedup[] = [];
    
    if (lead_ids && lead_ids.length > 0) {
      // Fetch the new leads
      const { data: newLeads, error } = await supabase
        .from('scraped_leads')
        .select('id, domain, best_email, best_phone, full_name, schema_data, confidence_score, email_validation_status, phone_validation_status, created_at')
        .in('id', lead_ids)
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      leadsToCheck = (newLeads || []) as LeadForDedup[];
      
      // CROSS-JOB DEDUP: Also fetch existing leads that might be duplicates
      // Look up by domain and email to find potential cross-job matches
      const domains = [...new Set(leadsToCheck.map(l => l.domain).filter(Boolean))];
      const emails = [...new Set(leadsToCheck.map(l => normalizeEmail(l.best_email)).filter(Boolean))] as string[];
      const phones = [...new Set(leadsToCheck.map(l => normalizePhone(l.best_phone)).filter(Boolean))] as string[];
      
      // Fetch existing leads with matching domains, emails, or phones
      let existingQuery = supabase
        .from('scraped_leads')
        .select('id, domain, best_email, best_phone, full_name, schema_data, confidence_score, email_validation_status, phone_validation_status, created_at')
        .not('id', 'in', `(${lead_ids.join(',')})`)
        .not('status', 'eq', 'rejected');
      
      if (domains.length > 0) {
        existingQuery = existingQuery.in('domain', domains);
      }
      
      const { data: existingLeads } = await existingQuery.limit(500);
      
      if (existingLeads && existingLeads.length > 0) {
        console.log(`Cross-job dedup: checking ${leadsToCheck.length} new leads against ${existingLeads.length} existing leads`);
        leadsToCheck = [...(existingLeads as LeadForDedup[]), ...leadsToCheck];
      }
    } else if (job_id) {
      const { data, error } = await supabase
        .from('scraped_leads')
        .select('id, domain, best_email, best_phone, full_name, schema_data, confidence_score, email_validation_status, phone_validation_status, created_at')
        .eq('job_id', job_id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      leadsToCheck = (data || []) as LeadForDedup[];
    } else {
      // Full database dedup
      const { data, error } = await supabase
        .from('scraped_leads')
        .select('id, domain, best_email, best_phone, full_name, schema_data, confidence_score, email_validation_status, phone_validation_status, created_at')
        .not('status', 'eq', 'rejected')
        .order('created_at', { ascending: true })
        .limit(1000);
      if (error) throw error;
      leadsToCheck = (data || []) as LeadForDedup[];
    }

    const leads = leadsToCheck;

    if (!leads || leads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, duplicates_found: 0, message: 'No leads to check' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Checking ${leads.length} leads for duplicates`);

    // Build indexes for faster lookup
    const emailIndex = new Map<string, LeadForDedup[]>();
    const phoneIndex = new Map<string, LeadForDedup[]>();
    const domainNameIndex = new Map<string, LeadForDedup[]>();
    const companyLocationIndex = new Map<string, LeadForDedup[]>();

    for (const lead of leads) {
      const typedLead = lead as LeadForDedup;
      
      // Email index
      const normalizedEmail = normalizeEmail(typedLead.best_email);
      if (normalizedEmail) {
        if (!emailIndex.has(normalizedEmail)) {
          emailIndex.set(normalizedEmail, []);
        }
        emailIndex.get(normalizedEmail)!.push(typedLead);
      }

      // Phone index
      const normalizedPhone = normalizePhone(typedLead.best_phone);
      if (normalizedPhone) {
        if (!phoneIndex.has(normalizedPhone)) {
          phoneIndex.set(normalizedPhone, []);
        }
        phoneIndex.get(normalizedPhone)!.push(typedLead);
      }

      // Domain + Name index
      const normalizedName = normalizeName(typedLead.full_name);
      if (normalizedName) {
        const domainNameKey = `${typedLead.domain}:${normalizedName}`;
        if (!domainNameIndex.has(domainNameKey)) {
          domainNameIndex.set(domainNameKey, []);
        }
        domainNameIndex.get(domainNameKey)!.push(typedLead);
      }

      // Company + Location + Contact index
      const companyName = typedLead.schema_data?.company_name as string;
      const city = typedLead.schema_data?.city as string;
      const state = typedLead.schema_data?.state as string;
      if (companyName && (city || state) && typedLead.full_name) {
        const locationKey = `${companyName.toLowerCase()}:${(city || '').toLowerCase()}:${(state || '').toLowerCase()}:${normalizeName(typedLead.full_name)}`;
        if (!companyLocationIndex.has(locationKey)) {
          companyLocationIndex.set(locationKey, []);
        }
        companyLocationIndex.get(locationKey)!.push(typedLead);
      }
    }

    // Find duplicates
    const duplicateMatches: DuplicateMatch[] = [];
    const processedPairs = new Set<string>();

    function addMatch(leads: LeadForDedup[], reason: string) {
      if (leads.length < 2) return;

      // Sort by quality: verified > likely_valid > unverified, then by confidence, then by created_at
      const sorted = [...leads].sort((a, b) => {
        // Prefer verified status
        const aVerified = a.email_validation_status === 'verified' || a.phone_validation_status === 'verified';
        const bVerified = b.email_validation_status === 'verified' || b.phone_validation_status === 'verified';
        if (aVerified && !bVerified) return -1;
        if (!aVerified && bVerified) return 1;

        // Prefer higher confidence
        if (a.confidence_score !== b.confidence_score) {
          return b.confidence_score - a.confidence_score;
        }

        // Prefer older (first created)
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });

      const primary = sorted[0];
      for (let i = 1; i < sorted.length; i++) {
        const duplicate = sorted[i];
        const pairKey = [primary.id, duplicate.id].sort().join(':');
        
        if (!processedPairs.has(pairKey)) {
          processedPairs.add(pairKey);
          duplicateMatches.push({
            primary_id: primary.id,
            duplicate_id: duplicate.id,
            match_reason: reason,
          });
        }
      }
    }

    // Check each index for duplicates
    for (const [, leads] of emailIndex) {
      if (leads.length > 1) addMatch(leads, 'email');
    }
    for (const [, leads] of phoneIndex) {
      if (leads.length > 1) addMatch(leads, 'phone');
    }
    for (const [, leads] of domainNameIndex) {
      if (leads.length > 1) addMatch(leads, 'domain_name');
    }
    for (const [, leads] of companyLocationIndex) {
      if (leads.length > 1) addMatch(leads, 'company_city_contact');
    }

    console.log(`Found ${duplicateMatches.length} duplicate pairs`);

    // Store duplicate relationships
    for (const match of duplicateMatches) {
      // Check if already recorded
      const { data: existing } = await supabase
        .from('lead_duplicates')
        .select('id')
        .eq('primary_lead_id', match.primary_id)
        .eq('duplicate_lead_id', match.duplicate_id)
        .single();

      if (!existing) {
        await supabase.from('lead_duplicates').insert({
          primary_lead_id: match.primary_id,
          duplicate_lead_id: match.duplicate_id,
          match_reason: match.match_reason,
        });
      }
    }

    // Auto-merge if requested
    let mergedCount = 0;
    if (auto_merge && duplicateMatches.length > 0) {
      for (const match of duplicateMatches) {
        // Get both leads
        const { data: primaryLead } = await supabase
          .from('scraped_leads')
          .select('*')
          .eq('id', match.primary_id)
          .single();

        const { data: duplicateLead } = await supabase
          .from('scraped_leads')
          .select('*')
          .eq('id', match.duplicate_id)
          .single();

        if (primaryLead && duplicateLead) {
          // Merge: keep primary, combine arrays, take best values
          const updates: Record<string, unknown> = {};

          // Combine all_emails
          const allEmails = new Set([
            ...(primaryLead.all_emails || []),
            ...(duplicateLead.all_emails || []),
          ]);
          updates.all_emails = Array.from(allEmails);

          // Combine all_phones
          const allPhones = new Set([
            ...(primaryLead.all_phones || []),
            ...(duplicateLead.all_phones || []),
          ]);
          updates.all_phones = Array.from(allPhones);

          // Take best email (prefer verified)
          if (!primaryLead.best_email || 
              (duplicateLead.email_validation_status === 'verified' && primaryLead.email_validation_status !== 'verified')) {
            updates.best_email = duplicateLead.best_email || primaryLead.best_email;
            updates.email_validation_status = duplicateLead.email_validation_status || primaryLead.email_validation_status;
            updates.email_source_url = duplicateLead.email_source_url || primaryLead.email_source_url;
          }

          // Take best phone (prefer verified)
          if (!primaryLead.best_phone ||
              (duplicateLead.phone_validation_status === 'verified' && primaryLead.phone_validation_status !== 'verified')) {
            updates.best_phone = duplicateLead.best_phone || primaryLead.best_phone;
            updates.phone_validation_status = duplicateLead.phone_validation_status || primaryLead.phone_validation_status;
            updates.phone_source_url = duplicateLead.phone_source_url || primaryLead.phone_source_url;
          }

          // Take name if missing
          if (!primaryLead.full_name && duplicateLead.full_name) {
            updates.full_name = duplicateLead.full_name;
            updates.name_source_url = duplicateLead.name_source_url;
          }

          // Merge schema_data
          updates.schema_data = {
            ...(duplicateLead.schema_data || {}),
            ...(primaryLead.schema_data || {}),
          };

          // Merge enrichment providers
          updates.enrichment_providers_used = Array.from(new Set([
            ...(primaryLead.enrichment_providers_used || []),
            ...(duplicateLead.enrichment_providers_used || []),
          ]));

          // Update confidence score to max
          updates.confidence_score = Math.max(
            primaryLead.confidence_score || 0,
            duplicateLead.confidence_score || 0
          );

          // Update primary lead
          await supabase
            .from('scraped_leads')
            .update(updates)
            .eq('id', match.primary_id);

          // Mark duplicate as merged
          await supabase
            .from('scraped_leads')
            .update({ status: 'rejected', qc_flag: 'merged', qc_notes: `Merged into ${match.primary_id}` })
            .eq('id', match.duplicate_id);

          // Update duplicate record
          await supabase
            .from('lead_duplicates')
            .update({ merged_at: new Date().toISOString() })
            .eq('primary_lead_id', match.primary_id)
            .eq('duplicate_lead_id', match.duplicate_id);

          mergedCount++;
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        duplicates_found: duplicateMatches.length,
        merged_count: mergedCount,
        duplicate_pairs: duplicateMatches,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in dedupe-leads:', error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
