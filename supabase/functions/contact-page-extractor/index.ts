import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Contact/About page URL patterns
const CONTACT_PATHS = ['/contact', '/contact-us', '/get-in-touch', '/reach-us', '/connect'];
const ABOUT_PATHS = ['/about', '/about-us', '/our-team', '/team', '/staff', '/leadership', '/people', '/who-we-are'];

function extractEmails(text: string): string[] {
  const matches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || [];
  return [...new Set(matches)].filter(e => !e.includes('example.com') && !e.endsWith('.png') && !e.endsWith('.jpg'));
}

function extractPhones(text: string): string[] {
  const matches = text.match(/(?:\+?1[-.\s]?)?(?:\(\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g) || [];
  return [...new Set(matches.map(p => p.replace(/\D/g, '')))].filter(p => p.length >= 10 && p.length <= 11);
}

interface PersonInfo {
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  source_page: string;
}

function extractPeople(markdown: string, sourcePage: string): PersonInfo[] {
  const people: PersonInfo[] = [];

  // Pattern: Name with title below (common in team pages)
  const teamPatterns = [
    // ## Name \n *Title*
    /#{2,4}\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*\n+\s*\*{0,2}([^*\n]{3,60})\*{0,2}/g,
    // **Name** - Title  or  **Name**, Title
    /\*\*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\*\*\s*[-–,]\s*([^\n]{3,60})/g,
    // Name | Title (table-style)
    /\|?\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*\|\s*([A-Za-z\s&,]{3,60})\s*\|?/g,
  ];

  for (const pattern of teamPatterns) {
    let match;
    while ((match = pattern.exec(markdown)) !== null) {
      const name = match[1]?.trim();
      const title = match[2]?.trim();
      if (!name || name.split(' ').length < 2) continue;

      // Look for email/phone in surrounding context (200 chars after)
      const contextStart = match.index;
      const contextEnd = Math.min(markdown.length, match.index + match[0].length + 300);
      const context = markdown.substring(contextStart, contextEnd);
      const emails = extractEmails(context);
      const phones = extractPhones(context);

      if (!people.some(p => p.name.toLowerCase() === name.toLowerCase())) {
        people.push({ name, title, email: emails[0] || null, phone: phones[0] || null, source_page: sourcePage });
      }
    }
  }

  // Pattern: Role labels (Contact: Name, Manager: Name)
  const rolePattern = /(?:contact|owner|manager|director|ceo|founder|president|broker|agent|partner|principal)\s*[:|-]\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi;
  let roleMatch;
  while ((roleMatch = rolePattern.exec(markdown)) !== null) {
    const name = roleMatch[1]?.trim();
    if (!name || people.some(p => p.name.toLowerCase() === name.toLowerCase())) continue;
    const titleWord = roleMatch[0].split(/[:|-]/)[0].trim();
    const ctxStart = Math.max(0, roleMatch.index - 50);
    const ctxEnd = Math.min(markdown.length, roleMatch.index + roleMatch[0].length + 200);
    const ctx = markdown.substring(ctxStart, ctxEnd);
    people.push({ name, title: titleWord, email: extractEmails(ctx)[0] || null, phone: extractPhones(ctx)[0] || null, source_page: sourcePage });
  }

  return people;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

  if (!firecrawlApiKey) {
    return new Response(JSON.stringify({ error: 'Firecrawl not configured' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const authSupabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: authHeader } } });
  const { data: { user }, error: userError } = await authSupabase.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: 'Invalid authentication' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    const { lead_ids } = await req.json();
    if (!lead_ids?.length) {
      return new Response(JSON.stringify({ error: 'lead_ids required' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    const results: Array<{ lead_id: string; people_found: number; pages_scraped: string[] }> = [];

    for (const leadId of lead_ids.slice(0, 10)) {
      const { data: lead } = await supabase.from('scraped_leads').select('*').eq('id', leadId).single();
      if (!lead || !lead.domain || lead.domain.includes('-')) {
        results.push({ lead_id: leadId, people_found: 0, pages_scraped: [] });
        continue;
      }

      const domain = lead.domain;
      const allPeople: PersonInfo[] = [];
      const scrapedPages: string[] = [];
      const allEmails: string[] = [...(lead.all_emails || [])];
      const allPhones: string[] = [...(lead.all_phones || [])];

      // Try contact and about pages
      const pagesToTry = [...CONTACT_PATHS, ...ABOUT_PATHS];

      for (const path of pagesToTry) {
        const pageUrl = `https://${domain}${path}`;
        try {
          const resp = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: pageUrl, formats: ['markdown'], onlyMainContent: false, waitFor: 2000 }),
          });

          if (resp.ok) {
            const data = await resp.json();
            const md = data.data?.markdown || '';
            if (md.length > 100) { // Not a 404 page
              scrapedPages.push(path);
              const people = extractPeople(md, path);
              allPeople.push(...people);
              allEmails.push(...extractEmails(md));
              allPhones.push(...extractPhones(md));
            }
          }
        } catch { /* skip failed pages */ }

        // Stop if we've found good data
        if (allPeople.length >= 3 && scrapedPages.length >= 2) break;
      }

      // Deduplicate people
      const uniquePeople = allPeople.reduce((acc, p) => {
        if (!acc.some(e => e.name.toLowerCase() === p.name.toLowerCase())) acc.push(p);
        return acc;
      }, [] as PersonInfo[]);

      // Update lead with new data
      if (uniquePeople.length > 0 || scrapedPages.length > 0) {
        const updates: Record<string, unknown> = {};
        const uniqueEmails = [...new Set(allEmails)];
        const uniquePhones = [...new Set(allPhones)];

        if (uniqueEmails.length > (lead.all_emails?.length || 0)) updates.all_emails = uniqueEmails;
        if (uniquePhones.length > (lead.all_phones?.length || 0)) updates.all_phones = uniquePhones;

        // If we found a better primary contact
        if (uniquePeople.length > 0 && !lead.full_name) {
          const best = uniquePeople.sort((a, b) => {
            const titles = ['owner', 'ceo', 'founder', 'president', 'director', 'manager'];
            const aScore = a.title ? titles.findIndex(t => a.title!.toLowerCase().includes(t)) : -1;
            const bScore = b.title ? titles.findIndex(t => b.title!.toLowerCase().includes(t)) : -1;
            return bScore - aScore;
          })[0];
          if (best.name) updates.full_name = best.name;
          if (best.email && !lead.best_email) updates.best_email = best.email;
          if (best.phone && !lead.best_phone) updates.best_phone = best.phone;
        }

        // Store all found people in schema_data
        const existingContacts = (lead.schema_data as any)?.all_contacts || [];
        const mergedContacts = [...existingContacts];
        for (const p of uniquePeople) {
          if (!mergedContacts.some((c: any) => c.name?.toLowerCase() === p.name.toLowerCase())) {
            mergedContacts.push({ name: p.name, title: p.title, email: p.email, phone: p.phone, source: p.source_page });
          }
        }
        updates.schema_data = { ...(lead.schema_data || {}), all_contacts: mergedContacts, contacts_found: mergedContacts.length, deep_extraction_pages: scrapedPages };

        if (Object.keys(updates).length > 0) {
          await supabase.from('scraped_leads').update(updates).eq('id', leadId);
        }
      }

      results.push({ lead_id: leadId, people_found: uniquePeople.length, pages_scraped: scrapedPages });
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[ContactPageExtractor] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
