import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Tech detection patterns for common technologies
const TECH_PATTERNS: Record<string, RegExp[]> = {
  // CMS
  'WordPress': [/wp-content/i, /wordpress/i, /wp-json/i],
  'Shopify': [/shopify/i, /cdn\.shopify/i, /myshopify\.com/i],
  'Squarespace': [/squarespace/i, /sqsp/i],
  'Wix': [/wix\.com/i, /wixsite/i, /parastorage\.com/i],
  'Webflow': [/webflow/i],
  'Drupal': [/drupal/i, /sites\/default\/files/i],
  'Joomla': [/joomla/i, /com_content/i],
  'Ghost': [/ghost\.io/i, /ghost-api/i],
  'HubSpot CMS': [/hs-scripts/i, /hubspot/i, /hbspt/i],
  // Analytics
  'Google Analytics': [/google-analytics|googletagmanager|gtag|UA-\d+|G-\w+/i],
  'Facebook Pixel': [/facebook\.net\/en_US\/fbevents|fbq\(/i],
  'Hotjar': [/hotjar/i, /hj\(/i],
  'Mixpanel': [/mixpanel/i],
  'Segment': [/segment\.com|analytics\.js/i],
  'Heap': [/heap-\d+|heapanalytics/i],
  // Marketing
  'Mailchimp': [/mailchimp|mc\.js|chimpstatic/i],
  'HubSpot': [/hubspot|hs-analytics|hbspt/i],
  'Marketo': [/marketo|munchkin/i],
  'Salesforce': [/salesforce|pardot/i],
  'ActiveCampaign': [/activecampaign/i],
  'Intercom': [/intercom|intercomcdn/i],
  'Drift': [/drift\.com|driftt/i],
  'Zendesk': [/zendesk|zdassets/i],
  'Freshdesk': [/freshdesk/i],
  // E-commerce
  'Stripe': [/stripe\.com|js\.stripe/i],
  'PayPal': [/paypal/i],
  'Square': [/squareup|square\.site/i],
  // CDN/Hosting
  'Cloudflare': [/cloudflare/i, /cf-ray/i],
  'AWS': [/amazonaws\.com|aws\./i],
  'Google Cloud': [/googleapis|gstatic/i],
  'Vercel': [/vercel/i],
  'Netlify': [/netlify/i],
  // Frameworks
  'React': [/react|__next/i],
  'Vue.js': [/vue\.js|vuejs/i],
  'Angular': [/angular/i, /ng-/i],
  'jQuery': [/jquery/i],
  'Bootstrap': [/bootstrap/i],
  'Tailwind CSS': [/tailwindcss|tailwind/i],
};

// Revenue estimation based on employee count and industry
function estimateRevenue(employeeCount: number | null, industry: string | null): {
  estimated_revenue_min: number | null;
  estimated_revenue_max: number | null;
  revenue_range: string | null;
} {
  if (!employeeCount) return { estimated_revenue_min: null, estimated_revenue_max: null, revenue_range: null };

  // Industry multipliers (revenue per employee in USD)
  const industryMultipliers: Record<string, [number, number]> = {
    'technology': [150000, 400000],
    'software': [200000, 500000],
    'saas': [200000, 600000],
    'healthcare': [100000, 300000],
    'finance': [200000, 500000],
    'retail': [80000, 200000],
    'real_estate': [100000, 350000],
    'construction': [100000, 250000],
    'manufacturing': [120000, 300000],
    'professional_services': [100000, 250000],
    'education': [50000, 150000],
    'hospitality': [40000, 120000],
    'default': [80000, 250000],
  };

  const normalizedIndustry = (industry || '').toLowerCase().replace(/[^a-z_]/g, '_');
  const [minPerEmp, maxPerEmp] = industryMultipliers[normalizedIndustry] || industryMultipliers['default'];

  const min = employeeCount * minPerEmp;
  const max = employeeCount * maxPerEmp;

  let range = '';
  if (max < 1_000_000) range = 'Under $1M';
  else if (max < 5_000_000) range = '$1M - $5M';
  else if (max < 10_000_000) range = '$5M - $10M';
  else if (max < 50_000_000) range = '$10M - $50M';
  else if (max < 100_000_000) range = '$50M - $100M';
  else if (max < 500_000_000) range = '$100M - $500M';
  else if (max < 1_000_000_000) range = '$500M - $1B';
  else range = '$1B+';

  return { estimated_revenue_min: min, estimated_revenue_max: max, revenue_range: range };
}

// Detect technologies from page content
function detectTechnologies(html: string, markdown: string): string[] {
  const detected: string[] = [];
  const combined = html + ' ' + markdown;

  for (const [tech, patterns] of Object.entries(TECH_PATTERNS)) {
    for (const pattern of patterns) {
      if (pattern.test(combined)) {
        detected.push(tech);
        break;
      }
    }
  }

  return [...new Set(detected)];
}

// Detect social media links and follower context
function detectSocialProfiles(markdown: string, links: string[]): Record<string, string> {
  const socials: Record<string, string> = {};
  const allText = links.join(' ') + ' ' + markdown;

  const socialPatterns: Record<string, RegExp> = {
    facebook: /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9.]+)/i,
    instagram: /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)/i,
    twitter: /(?:https?:\/\/)?(?:www\.)?(?:twitter|x)\.com\/([a-zA-Z0-9_]+)/i,
    linkedin: /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(?:company|in)\/([a-zA-Z0-9-]+)/i,
    youtube: /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(?:c\/|channel\/|@)([a-zA-Z0-9_-]+)/i,
    tiktok: /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/i,
  };

  for (const [platform, pattern] of Object.entries(socialPatterns)) {
    const match = allText.match(pattern);
    if (match) {
      socials[platform] = match[0].startsWith('http') ? match[0] : `https://${match[0]}`;
    }
  }

  return socials;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const firecrawlApiKey = Deno.env.get('FIRECRAWL_API_KEY');

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

    const results: Array<{ lead_id: string; technologies: string[]; revenue_estimate: string | null; social_profiles: Record<string, string> }> = [];

    for (const leadId of lead_ids.slice(0, 20)) {
      const { data: lead } = await supabase.from('scraped_leads').select('*').eq('id', leadId).single();
      if (!lead) continue;

      const domain = lead.domain;
      const enrichmentData = (lead.enrichment_data || {}) as Record<string, unknown>;
      let detectedTech: string[] = (enrichmentData.technologies as string[]) || [];
      let socialProfiles: Record<string, string> = {};

      // Scrape homepage for tech detection if we don't have tech data yet
      if (detectedTech.length === 0 && firecrawlApiKey && domain && !domain.includes('-')) {
        try {
          const scrapeResp = await fetch('https://api.firecrawl.dev/v1/scrape', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${firecrawlApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: `https://${domain}`, formats: ['html', 'links', 'markdown'], onlyMainContent: false, waitFor: 3000 }),
          });
          if (scrapeResp.ok) {
            const scrapeData = await scrapeResp.json();
            const html = scrapeData.data?.html || '';
            const md = scrapeData.data?.markdown || '';
            const links = scrapeData.data?.links || [];
            detectedTech = detectTechnologies(html, md);
            socialProfiles = detectSocialProfiles(md, links);
          }
        } catch (e) { console.error(`[TechDetect] Scrape failed for ${domain}:`, e); }
      }

      // Revenue estimation
      const employeeCount = enrichmentData.employee_count as number || null;
      const industry = enrichmentData.industry as string || lead.schema_data?.industry as string || null;
      const revenueEstimate = estimateRevenue(employeeCount, industry);

      // Update lead enrichment data
      const updatedEnrichment = {
        ...enrichmentData,
        technologies: detectedTech.length > 0 ? detectedTech : enrichmentData.technologies,
        social_profiles: Object.keys(socialProfiles).length > 0 ? socialProfiles : enrichmentData.social_profiles,
        ...revenueEstimate,
        tech_enriched_at: new Date().toISOString(),
      };

      await supabase.from('scraped_leads').update({
        enrichment_data: updatedEnrichment,
      }).eq('id', leadId);

      results.push({
        lead_id: leadId,
        technologies: detectedTech,
        revenue_estimate: revenueEstimate.revenue_range,
        social_profiles: socialProfiles,
      });
    }

    return new Response(JSON.stringify({ success: true, results }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('[TechnographicsEnrichment] Error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  }
});
