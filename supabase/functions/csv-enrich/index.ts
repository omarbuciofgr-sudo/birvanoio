import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface EnrichRequest {
  company_name: string;
  existing_data?: Record<string, string>;
}

interface EnrichedRow {
  company_name: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  linkedin_url: string | null;
  company_domain: string | null;
  contact_name: string | null;
  job_title: string | null;
  ai_description: string | null;
  enrichment_source: string | null;
  status: "enriched" | "partial" | "not_found" | "error";
  original_data?: Record<string, string>;
}

async function enrichWithApollo(companyName: string, apiKey: string): Promise<Partial<EnrichedRow> | null> {
  try {
    // Search for organization first
    const orgResponse = await fetch("https://api.apollo.io/v1/mixed_companies/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        q_organization_name: companyName,
        page: 1,
        per_page: 1,
      }),
    });

    const orgData = await orgResponse.json();
    const org = orgData.organizations?.[0] || orgData.accounts?.[0];

    let domain = org?.primary_domain || org?.website_url;
    if (domain) {
      domain = domain.replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    }

    // Now search for people at this company
    const peopleResponse = await fetch("https://api.apollo.io/v1/mixed_people/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Api-Key": apiKey },
      body: JSON.stringify({
        q_organization_name: companyName,
        page: 1,
        per_page: 5,
      }),
    });

    const peopleData = await peopleResponse.json();
    const people = peopleData.people || [];

    // Find best contact (prioritize owners/executives)
    const priorityTitles = ["owner", "ceo", "founder", "president", "director", "manager"];
    let bestPerson = people[0];
    for (const person of people) {
      const title = (person.title || "").toLowerCase();
      if (priorityTitles.some((pt) => title.includes(pt))) {
        bestPerson = person;
        break;
      }
    }

    const personOrg = bestPerson?.organization || {};

    return {
      phone: bestPerson?.phone_numbers?.[0]?.number || null,
      email: bestPerson?.email || null,
      website: personOrg.website_url || org?.website_url || null,
      linkedin_url: bestPerson?.linkedin_url || null,
      company_domain: domain || personOrg.primary_domain || null,
      contact_name: bestPerson?.name || null,
      job_title: bestPerson?.title || null,
      enrichment_source: "apollo",
    };
  } catch (error) {
    console.error("[csv-enrich] Apollo error:", error);
    return null;
  }
}

async function enrichEmailWithHunter(domain: string, firstName: string | null, lastName: string | null, apiKey: string): Promise<string | null> {
  try {
    if (firstName && lastName) {
      const resp = await fetch(
        `https://api.hunter.io/v2/email-finder?domain=${domain}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${apiKey}`
      );
      const data = await resp.json();
      if (data.data?.email) return data.data.email;
    }

    const resp = await fetch(`https://api.hunter.io/v2/domain-search?domain=${domain}&api_key=${apiKey}&limit=1`);
    const data = await resp.json();
    return data.data?.emails?.[0]?.value || null;
  } catch (error) {
    console.error("[csv-enrich] Hunter error:", error);
    return null;
  }
}

async function generateAIDescription(companyName: string, enrichedData: Partial<EnrichedRow>): Promise<string | null> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) return null;

  try {
    const context = [
      companyName,
      enrichedData.website ? `Website: ${enrichedData.website}` : "",
      enrichedData.job_title ? `Key contact: ${enrichedData.contact_name} (${enrichedData.job_title})` : "",
    ].filter(Boolean).join(". ");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          {
            role: "system",
            content: "Write a 1-sentence business description for the company. Be concise and factual. If you don't have enough info, make a reasonable inference based on the company name.",
          },
          { role: "user", content: context },
        ],
      }),
    });

    if (!response.ok) return null;
    const data = await response.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const { rows, row_index } = await req.json();

    // Single row enrichment
    if (row_index !== undefined && rows?.length === 1) {
      const row = rows[0] as EnrichRequest;
      const result = await enrichSingleRow(row);
      return new Response(JSON.stringify({ results: [result], row_index }), {
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    // Batch enrichment
    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return new Response(JSON.stringify({ error: "No rows provided" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    if (rows.length > 100) {
      return new Response(JSON.stringify({ error: "Maximum 100 rows per batch" }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const results: EnrichedRow[] = [];
    for (const row of rows as EnrichRequest[]) {
      const result = await enrichSingleRow(row);
      results.push(result);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error) {
    console.error("[csv-enrich] Error:", error);
    return new Response(JSON.stringify({ error: "Internal error" }), {
      status: 500,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  }
});

async function enrichSingleRow(row: EnrichRequest): Promise<EnrichedRow> {
  const apolloKey = Deno.env.get("APOLLO_API_KEY");
  const hunterKey = Deno.env.get("HUNTER_API_KEY");

  const result: EnrichedRow = {
    company_name: row.company_name,
    phone: null,
    email: null,
    website: null,
    linkedin_url: null,
    company_domain: null,
    contact_name: null,
    job_title: null,
    ai_description: null,
    enrichment_source: null,
    status: "not_found",
    original_data: row.existing_data,
  };

  try {
    // Step 1: Apollo enrichment
    if (apolloKey) {
      const apolloResult = await enrichWithApollo(row.company_name, apolloKey);
      if (apolloResult) {
        Object.assign(result, apolloResult);
      }
    }

    // Step 2: Hunter.io fallback for email
    if (!result.email && hunterKey && result.company_domain) {
      const [firstName, ...rest] = (result.contact_name || "").split(" ");
      const lastName = rest.join(" ");
      const email = await enrichEmailWithHunter(result.company_domain, firstName || null, lastName || null, hunterKey);
      if (email) {
        result.email = email;
        result.enrichment_source = (result.enrichment_source || "") + "+hunter";
      }
    }

    // Step 3: AI description
    const aiDesc = await generateAIDescription(row.company_name, result);
    if (aiDesc) result.ai_description = aiDesc;

    // Determine status
    const enrichedFields = [result.phone, result.email, result.website, result.contact_name].filter(Boolean);
    if (enrichedFields.length >= 3) {
      result.status = "enriched";
    } else if (enrichedFields.length > 0) {
      result.status = "partial";
    } else {
      result.status = "not_found";
    }
  } catch (error) {
    console.error(`[csv-enrich] Error enriching ${row.company_name}:`, error);
    result.status = "error";
  }

  return result;
}
