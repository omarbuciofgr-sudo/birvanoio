import { validatePeopleSearchRequest } from "../_shared/scraperValidation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

interface PeopleSearchInput {
  person_titles?: string[];
  person_seniorities?: string[];
  person_departments?: string[];
  person_locations?: string[];
  organization_industry_tag_ids?: string[];
  organization_num_employees_ranges?: string[];
  organization_ids?: string[];
  q_organization_name?: string;
  person_past_organization_ids?: string[];
  person_past_titles?: string[];
  past_companies?: string[];
  skills?: string[];
  certifications?: string[];
  languages?: string[];
  education_level?: string[];
  schools?: string[];
  exclude_person_names?: string[];
  profile_keywords?: string[];
  years_experience_min?: number;
  years_experience_max?: number;
  email_status?: string;
  technologies?: string[];
  revenue_range?: string;
  funding_range?: string;
  funding_stage?: string;
  market_segments?: string[];
  buying_intent?: string;
  sic_codes?: string[];
  naics_codes?: string[];
  job_posting_filter?: string;
  job_categories?: string[];
  limit?: number;
  page?: number;
}

interface PersonResult {
  id: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  title: string | null;
  headline: string | null;
  seniority: string | null;
  departments: string[];
  organization_name: string | null;
  organization_domain: string | null;
  organization_industry: string | null;
  organization_employee_count: number | null;
  city: string | null;
  state: string | null;
  country: string | null;
  linkedin_url: string | null;
  email_status: string | null;
  photo_url: string | null;
  email?: string | null;
  phone?: string | null;
  source_provider?: string;
}

// Map seniority labels to Apollo codes
const SENIORITY_MAP: Record<string, string> = {
  owner: "owner",
  founder: "founder",
  c_suite: "c_suite",
  c_level: "c_suite",
  partner: "partner",
  vp: "vp",
  head: "head",
  director: "director",
  lead: "senior",
  manager: "manager",
  senior: "senior",
  mid: "senior",
  associate: "entry",
  entry: "entry",
  intern: "intern",
};

/** Apollo expects org size like "1,10" not "1-10" (same as industry-search). */
function mapApolloEmployeeRanges(ranges: string[]): string[] {
  return ranges.map((r) => {
    if (r === "5001+" || r === "10001+") return "10001,";
    return r.replace("-", ",");
  });
}

// Map department labels to Apollo codes
const DEPARTMENT_MAP: Record<string, string> = {
  engineering: "engineering",
  sales: "sales",
  marketing: "marketing",
  finance: "finance",
  hr: "human_resources",
  operations: "operations",
  product: "product_management",
  design: "design",
  support: "support",
  legal: "legal",
  customer_success: "support",
  it: "information_technology",
  executive: "master_executive",
  data: "data_science",
  education: "education",
  consulting: "consulting",
  media: "media_and_communication",
};

/**
 * Apollo `mixed_people/api_search` preview usually sends `last_name_obfuscated` (e.g. `Hu***n`)
 * instead of real `last_name`. Without it, only `first_name` is visible until enrichment.
 */
function apolloDisplayName(p: {
  first_name?: string | null;
  last_name?: string | null;
  last_name_obfuscated?: string | null;
  lastNameObfuscated?: string | null;
  name?: string | null;
}): string {
  const fn = String(p.first_name ?? "").trim();
  const ln = String(p.last_name ?? "").trim();
  const lnObf = String(p.last_name_obfuscated ?? p.lastNameObfuscated ?? "").trim();
  const fromParts = [fn, ln].filter(Boolean).join(" ");
  const full = String(p.name ?? "").trim();
  if (fn && ln) return fromParts;
  if (fn && lnObf) return `${fn} ${lnObf}`.trim();
  if (full) return full;
  return fromParts || fn || lnObf;
}

const APOLLO_BULK_MATCH_URL = "https://api.apollo.io/api/v1/people/bulk_match";
const APOLLO_ORG_ENRICH_URL = "https://api.apollo.io/api/v1/organizations/enrich";

function organizationDomainFromOrg(org: Record<string, unknown> | null | undefined): string | null {
  if (!org || typeof org !== "object") return null;
  for (const key of ["primary_domain", "domain"]) {
    const v = org[key];
    if (typeof v === "string" && v.trim()) return v.trim().toLowerCase();
  }
  const wu = org.website_url;
  if (typeof wu === "string" && wu.trim()) {
    return wu
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0] || null;
  }
  return null;
}

function mergeApolloPersonMatch(row: PersonResult, m: Record<string, unknown>): void {
  const fn = String(m.first_name ?? "").trim();
  const ln = String(m.last_name ?? "").trim();
  const full = String(m.name ?? "").trim();
  const name = full || [fn, ln].filter(Boolean).join(" ");
  if (name) row.name = name;
  if (fn) row.first_name = fn;
  if (ln) row.last_name = ln;
  if (m.linkedin_url && !row.linkedin_url) row.linkedin_url = String(m.linkedin_url);

  const email = String(m.email ?? "").trim();
  if (email && !row.email) row.email = email;
  if (m.email_status && !row.email_status) row.email_status = String(m.email_status);

  const org = (m.organization ?? {}) as Record<string, unknown>;
  if (org.name && !row.organization_name) row.organization_name = String(org.name);
  const dom = organizationDomainFromOrg(org);
  if (dom && !row.organization_domain) row.organization_domain = dom;
  const ind = org.industry;
  if (typeof ind === "string" && ind.trim() && !row.organization_industry) {
    row.organization_industry = ind.trim();
  }
  const ec = org.estimated_num_employees;
  if (typeof ec === "number" && ec > 0 && !row.organization_employee_count) {
    row.organization_employee_count = ec;
  }

  const pns = m.phone_numbers as unknown[] | undefined;
  if (Array.isArray(pns) && pns.length > 0 && !row.phone) {
    const first = pns[0] as Record<string, unknown>;
    const phone = String(first.sanitized_number ?? first.number ?? "").trim();
    if (phone) row.phone = phone;
  }
}

/** bulk_match fills names, work email, and org fields omitted by api_search preview. */
async function hydrateApolloPeopleFromBulkMatch(rows: PersonResult[], apiKey: string): Promise<void> {
  const raw = (Deno.env.get("APOLLO_PEOPLE_SEARCH_FULL_NAME") || "true").trim().toLowerCase();
  if (["0", "false", "no", "off"].includes(raw)) return;

  const need = rows.filter((r) => {
    if (!r.id) return false;
    return (
      !String(r.last_name ?? "").trim() ||
      !r.organization_domain ||
      !r.organization_industry ||
      !r.email
    );
  });
  if (!need.length) return;

  const byId = new Map(rows.filter((r) => r.id).map((r) => [String(r.id), r]));
  const revealEmail = (Deno.env.get("APOLLO_PEOPLE_SEARCH_REVEAL_EMAIL") || "false").trim().toLowerCase();
  const revealEmails = ["1", "true", "yes", "on"].includes(revealEmail);

  console.log(
    `[People Apollo] bulk_match: hydrating ${need.length} rows (credits; APOLLO_PEOPLE_SEARCH_FULL_NAME=false to skip)`,
  );

  for (let i = 0; i < need.length; i += 10) {
    const chunk = need.slice(i, i + 10);
    const details = chunk.map((r) => ({ id: r.id }));
    const qs = new URLSearchParams({
      reveal_personal_emails: revealEmails ? "true" : "false",
      reveal_phone_number: "false",
    });
    try {
      const response = await fetch(`${APOLLO_BULK_MATCH_URL}?${qs}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify({ details }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        console.warn("[People Apollo] bulk_match HTTP", response.status, JSON.stringify(data).slice(0, 400));
        continue;
      }
      const matches = Array.isArray(data.matches) ? data.matches : [];
      for (const m of matches) {
        if (!m || typeof m !== "object" || !m.id) continue;
        const row = byId.get(String(m.id));
        if (!row) continue;
        mergeApolloPersonMatch(row, m as Record<string, unknown>);
      }
    } catch (e) {
      console.warn("[People Apollo] bulk_match failed", e);
    }
  }
}

async function resolveApolloOrgDomainByName(name: string, apiKey: string): Promise<string | null> {
  const trimmed = name.trim();
  if (!trimmed) return null;
  const headers = {
    "Content-Type": "application/json",
    "Cache-Control": "no-cache",
    "X-Api-Key": apiKey,
  };
  for (const params of [
    { page: 1, per_page: 5, q_organization_name: trimmed },
    { page: 1, per_page: 5, q_keywords: trimmed },
  ]) {
    try {
      let response = await fetch("https://api.apollo.io/api/v1/organizations/search", {
        method: "POST",
        headers,
        body: JSON.stringify(params),
      });
      let data = await response.json().catch(() => ({}));
      if (!response.ok) {
        response = await fetch("https://api.apollo.io/api/v1/mixed_companies/search", {
          method: "POST",
          headers,
          body: JSON.stringify(params),
        });
        data = await response.json().catch(() => ({}));
        if (!response.ok) continue;
      }
      const orgs = (data.organizations || data.accounts || []) as Record<string, unknown>[];
      for (const org of orgs) {
        const d = organizationDomainFromOrg(org);
        if (d) return d;
      }
    } catch {
      /* try next */
    }
  }
  return null;
}

/** organizations/enrich for rows still missing industry or domain after bulk_match. */
async function hydrateApolloOrganizationsFromEnrich(rows: PersonResult[], apiKey: string): Promise<void> {
  const domainCache = new Map<string, Record<string, unknown>>();
  for (const row of rows) {
    if (row.organization_industry && row.organization_domain) continue;

    let domain = row.organization_domain?.trim().toLowerCase() || "";
    if (!domain && row.organization_name) {
      domain = (await resolveApolloOrgDomainByName(row.organization_name, apiKey)) || "";
      if (domain && !row.organization_domain) row.organization_domain = domain;
    }
    if (!domain) continue;

    let org = domainCache.get(domain);
    if (!org) {
      try {
        const response = await fetch(APOLLO_ORG_ENRICH_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Cache-Control": "no-cache",
            "X-Api-Key": apiKey,
          },
          body: JSON.stringify({ domain }),
        });
        const data = await response.json().catch(() => ({}));
        org = (data.organization || {}) as Record<string, unknown>;
        domainCache.set(domain, org);
      } catch (e) {
        console.warn("[People Apollo] organizations/enrich failed", domain, e);
        continue;
      }
    }

    const ind = org.industry;
    if (typeof ind === "string" && ind.trim() && !row.organization_industry) {
      row.organization_industry = ind.trim();
    }
    const dom = organizationDomainFromOrg(org);
    if (dom && !row.organization_domain) row.organization_domain = dom;
    const ec = org.estimated_num_employees;
    if (typeof ec === "number" && ec > 0 && !row.organization_employee_count) {
      row.organization_employee_count = ec;
    }
    if (org.name && !row.organization_name) row.organization_name = String(org.name);
  }
}

// ── Provider 1: Apollo ──────────────────────────────────────────────
async function searchApollo(input: PeopleSearchInput, apiKey: string): Promise<PersonResult[] | null> {
  const params: Record<string, unknown> = {
    page: input.page || 1,
    per_page: Math.min(input.limit || 25, 100),
  };

  if (input.person_titles?.length) params.person_titles = input.person_titles;
  if (input.person_seniorities?.length) {
    params.person_seniorities = input.person_seniorities.map((s) => SENIORITY_MAP[s] || s);
  }
  if (input.person_departments?.length) {
    params.person_departments = input.person_departments.map((d) => DEPARTMENT_MAP[d] || d);
  }
  if (input.person_locations?.length) params.person_locations = input.person_locations;

  if (input.organization_industry_tag_ids?.length) {
    params.q_organization_keyword_tags = input.organization_industry_tag_ids;
  }
  if (input.organization_num_employees_ranges?.length) {
    params.organization_num_employees_ranges = mapApolloEmployeeRanges(input.organization_num_employees_ranges);
  }
  if (input.q_organization_name) params.q_organization_name = input.q_organization_name;

  const keywordParts: string[] = [];
  if (input.profile_keywords?.length) keywordParts.push(...input.profile_keywords);
  if (keywordParts.length > 0) params.q_keywords = keywordParts.join(" ");

  if (input.exclude_person_names?.length) params.person_not_names = input.exclude_person_names;
  if (input.person_past_titles?.length) params.person_past_titles = input.person_past_titles;
  if (input.past_companies?.length) {
    params.q_person_past_organization_name = input.past_companies.join(" ");
  }

  if (input.email_status) {
    if (input.email_status === "verified") params.contact_email_status = ["verified"];
    else if (input.email_status === "likely_valid") params.contact_email_status = ["verified", "guessed"];
    else if (input.email_status === "has_email") params.contact_email_status = ["verified", "guessed", "unavailable"];
  }

  if (input.technologies?.length) {
    const uids = input.technologies
      .map((t) => String(t).trim())
      .filter((t) => /^[a-f0-9]{24}$/i.test(t));
    if (uids.length > 0) params.currently_using_any_of_technology_uids = uids;
  }

  if (input.revenue_range) {
    const revenueMap: Record<string, string[]> = {
      "0-1M": ["0-1M"],
      "1M-5M": ["1M-10M"],
      "5M-10M": ["1M-10M"],
      "10M-50M": ["10M-50M"],
      "50M-100M": ["50M-100M"],
      "100M-500M": ["100M-500M"],
      "500M-1B": ["500M-1B"],
      "1B+": ["1B+"],
    };
    const mapped = revenueMap[input.revenue_range];
    if (mapped) params.organization_revenue_ranges = mapped;
  }

  if (input.funding_stage) {
    const stageMap: Record<string, string> = {
      seed: "seed",
      series_a: "series_a",
      series_b: "series_b",
      series_c: "series_c",
      series_d: "series_d",
      ipo: "ipo",
      private_equity: "private_equity",
      debt_financing: "debt_financing",
      grant: "grant",
    };
    const mapped = stageMap[input.funding_stage];
    if (mapped) params.organization_latest_funding_stage_cd = [mapped];
  }

  if (input.market_segments?.length) {
    const segmentKeywords = input.market_segments.map((s) => {
      const map: Record<string, string> = {
        enterprise: "enterprise",
        mid_market: "mid-market",
        smb: "small business",
        startup: "startup",
      };
      return map[s] || s;
    });
    params.q_organization_keyword_tags = [
      ...((params.q_organization_keyword_tags as string[]) || []),
      ...segmentKeywords,
    ];
  }

  if (input.buying_intent === "high") {
    params.organization_job_locations = params.organization_job_locations || ["United States"];
  }
  if (input.sic_codes?.length) params.organization_sic_codes = input.sic_codes;
  if (input.naics_codes?.length) params.organization_naics_codes = input.naics_codes;
  if (input.job_posting_filter === "has_job_postings") {
    params.organization_job_locations = params.organization_job_locations || ["United States"];
  }
  if (input.job_categories?.length) {
    params.organization_department_or_subdepartment_counts = input.job_categories.map((cat) => ({
      department_or_subdepartment: cat,
      min: 1,
    }));
  }

  console.log("[People Apollo] Params:", JSON.stringify(params));

  try {
    const tryEndpoint = async (path: string) => {
      const r = await fetch(`https://api.apollo.io${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "X-Api-Key": apiKey,
        },
        body: JSON.stringify(params),
      });
      const text = await r.text();
      let parsed: any = null;
      try { parsed = text ? JSON.parse(text) : null; } catch { /* non-JSON body */ }
      return { ok: r.ok, status: r.status, parsed, text };
    };

    let resp = await tryEndpoint("/api/v1/mixed_people/api_search");
    // Fallback to the standard endpoint when api_search rejects the key.
    if (!resp.ok && (resp.status === 401 || resp.status === 403 || resp.status === 404)) {
      console.warn(`[People Apollo] api_search ${resp.status} (${(resp.text || "").slice(0, 80)}) — retrying /mixed_people/search`);
      resp = await tryEndpoint("/api/v1/mixed_people/search");
    }

    if (!resp.ok) {
      console.error(`[People Apollo] Error ${resp.status}:`, (resp.parsed && (resp.parsed.error || resp.parsed)) || (resp.text || "").slice(0, 200));
      return null;
    }
    const data = resp.parsed || {};
    const people = data.people || [];
    console.log(`[People Apollo] Found ${people.length} people`);
    if (people.length === 0) return null;

    const rows: PersonResult[] = people.map((p: any) => ({
      id: p.id || "",
      name: apolloDisplayName(p),
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      title: p.title || null,
      headline: p.headline || null,
      seniority: p.seniority || null,
      departments: p.departments || [],
      organization_name: p.organization?.name || null,
      organization_domain: organizationDomainFromOrg(p.organization) ||
        (typeof p.organization?.primary_domain === "string" ? p.organization.primary_domain : null),
      organization_industry: p.organization?.industry || null,
      organization_employee_count: p.organization?.estimated_num_employees || null,
      city: p.city || null,
      state: p.state || null,
      country: p.country || null,
      linkedin_url: p.linkedin_url || null,
      email_status: p.email_status || null,
      photo_url: p.photo_url || null,
      email: p.email || null,
      phone: p.phone_numbers?.[0]?.sanitized_number || p.phone || null,
      source_provider: "apollo",
    }));
    await hydrateApolloPeopleFromBulkMatch(rows, apiKey);
    await hydrateApolloOrganizationsFromEnrich(rows, apiKey);
    return rows;
  } catch (e) {
    console.error("[People Apollo] Exception:", e);
    return null;
  }
}

// ── Provider 2: People Data Labs ────────────────────────────────────
const PDL_INDUSTRY_MAP: Record<string, string> = {
  software: "computer software",
  technology: "information technology and services",
  financial_services: "financial services",
  finance: "financial services",
  healthcare: "hospital & health care",
  real_estate: "real estate",
  construction: "construction",
  manufacturing: "manufacturing",
  retail: "retail",
  restaurants: "restaurants",
  hospitality: "hospitality",
  education: "education management",
  legal: "law practice",
  marketing: "marketing and advertising",
  marketing_agencies: "marketing and advertising",
  advertising: "marketing and advertising",
  consulting: "management consulting",
  insurance: "insurance",
  telecommunications: "telecommunications",
  transportation: "transportation/trucking/railroad",
  logistics: "logistics and supply chain",
  energy: "oil & energy",
  agriculture: "farming",
  entertainment: "entertainment",
  media: "media production",
  nonprofit: "nonprofit organization management",
};

function mapPdlIndustry(v: string): string {
  const key = v.trim().toLowerCase().replace(/[\s-]+/g, "_");
  return PDL_INDUSTRY_MAP[key] || v.trim().toLowerCase().replace(/_/g, " ");
}

const PDL_COUNTRY_MAP: Record<string, string> = {
  us: "united states",
  usa: "united states",
  "u.s.": "united states",
  "u.s.a.": "united states",
  uk: "united kingdom",
  "u.k.": "united kingdom",
  ca: "canada",
  au: "australia",
};

function escPdl(s: string): string {
  return String(s).replace(/'/g, "''");
}

function pdlLocationClause(loc: string): string {
  const trimmed = loc.trim();
  const lower = trimmed.toLowerCase();
  const country = PDL_COUNTRY_MAP[lower];
  if (country) return `location_country='${escPdl(country)}'`;
  // Two-letter US state code
  if (/^[A-Z]{2}$/.test(trimmed) && !["US", "UK", "CA", "AU"].includes(trimmed)) {
    return `location_region='${escPdl(lower)}'`;
  }
  // City, ST
  if (/,\s*[A-Za-z]{2}$/.test(trimmed)) {
    return `location_name='${escPdl(lower)}'`;
  }
  // Try as country first
  return `(location_country='${escPdl(lower)}' OR location_name='${escPdl(lower)}' OR location_region='${escPdl(lower)}')`;
}

async function searchPDL(input: PeopleSearchInput, apiKey: string): Promise<PersonResult[] | null> {
  const clauses: string[] = [];

  if (input.person_titles?.length) {
    const titleClauses = input.person_titles.map((t) => `job_title LIKE '%${escPdl(t.toLowerCase())}%'`).join(" OR ");
    clauses.push(`(${titleClauses})`);
  }
  if (input.person_locations?.length) {
    const locClauses = input.person_locations.map((l) => pdlLocationClause(l)).join(" OR ");
    clauses.push(`(${locClauses})`);
  }
  if (input.organization_industry_tag_ids?.length) {
    const ind = mapPdlIndustry(input.organization_industry_tag_ids[0]);
    clauses.push(`industry='${escPdl(ind)}'`);
  }
  if (input.q_organization_name) {
    clauses.push(`job_company_name='${escPdl(input.q_organization_name.toLowerCase())}'`);
  }

  if (clauses.length === 0) {
    console.log("[People PDL] No filters");
    return null;
  }

  const sqlQuery = clauses.join(" AND ");
  console.log(`[People PDL] Query: ${sqlQuery}`);

  try {
    const params = new URLSearchParams({
      sql: `SELECT * FROM person WHERE ${sqlQuery}`,
      size: String(Math.min(input.limit || 25, 100)),
      dataset: "all",
    });

    const response = await fetch(`https://api.peopledatalabs.com/v5/person/search?${params}`, {
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`[People PDL] Error ${response.status}:`, data);
      return null;
    }

    const people = data.data || [];
    if (people.length === 0) return null;
    console.log(`[People PDL] Found ${people.length} people`);

    return people.map((p: any) => ({
      id: p.id || "",
      name: p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "",
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      title: p.job_title || null,
      headline: p.headline || null,
      seniority: p.job_title_levels?.[0] || null,
      departments: p.job_title_sub_role ? [p.job_title_sub_role] : [],
      organization_name: firstString(p.job_company_name),
      organization_domain: firstString(p.job_company_website)?.replace(/^https?:\/\//, "").replace(/\/$/, "") || null,
      organization_industry: p.industry || null,
      organization_employee_count: p.job_company_size || null,
      city: firstString(p.location_locality),
      state: firstString(p.location_region),
      country: firstString(p.location_country),
      linkedin_url: normalizeLinkedInUrl(p.linkedin_url),
      email_status: null,
      photo_url: null,
      email: firstString(p.work_email) || firstString(p.personal_emails),
      phone: firstString(p.mobile_phone) || firstString(p.phone_numbers),
      source_provider: "pdl",
    }));
  } catch (e) {
    console.error("[People PDL] Exception:", e);
    return null;
  }
}

// ── Provider 3: RocketReach ─────────────────────────────────────────
async function searchRocketReach(input: PeopleSearchInput, apiKey: string): Promise<PersonResult[] | null> {
  const query: Record<string, unknown> = {
    page_size: Math.min(input.limit || 25, 100),
    start: ((input.page || 1) - 1) * Math.min(input.limit || 25, 100) + 1,
  };

  if (input.person_titles?.length) query.current_title = input.person_titles;
  if (input.person_locations?.length) query.location = input.person_locations;
  if (input.q_organization_name) query.current_employer = input.q_organization_name;
  if (input.organization_industry_tag_ids?.length) query.keyword = input.organization_industry_tag_ids;

  if (input.person_seniorities?.length) {
    const seniorityMap: Record<string, string> = {
      c_suite: "c_level",
      c_level: "c_level",
      vp: "vp",
      director: "director",
      manager: "manager",
      senior: "senior",
      owner: "owner",
      founder: "founder",
      partner: "partner",
    };
    query.management_levels = input.person_seniorities.map((s) => seniorityMap[s] || s);
  }

  if (!input.person_titles?.length && !input.q_organization_name && !input.organization_industry_tag_ids?.length) {
    console.log("[People RocketReach] No search criteria");
    return null;
  }

  console.log("[People RocketReach] Params:", JSON.stringify(query));

  try {
    const response = await fetch("https://api.rocketreach.co/api/v2/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Api-Key": apiKey },
      body: JSON.stringify(query),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`[People RocketReach] Error ${response.status}:`, data?.detail || data);
      return null;
    }

    const profiles = data.profiles || data.people || data.results || [];
    console.log(`[People RocketReach] Found ${profiles.length} people`);
    if (profiles.length === 0) return null;

    return profiles.map((p: any) => ({
      id: String(p.id || ""),
      name: p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "",
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      title: p.current_title || p.title || null,
      headline: p.headline || null,
      seniority: p.management_level || null,
      departments: p.department ? [p.department] : [],
      organization_name: p.current_employer || p.company_name || null,
      organization_domain: p.employer_website?.replace(/^https?:\/\//, "").replace(/\/.*$/, "") || null,
      organization_industry: p.industry || null,
      organization_employee_count: null,
      city: p.city || p.location?.city || null,
      state: p.state || p.region || p.location?.state || null,
      country: p.country || p.country_code || null,
      linkedin_url: p.linkedin_url || null,
      email_status: p.email_status || null,
      photo_url: p.profile_pic || null,
      email: p.current_work_email || p.emails?.[0] || null,
      phone: p.phones?.[0]?.number || p.phone || null,
      source_provider: "rocketreach",
    }));
  } catch (e) {
    console.error("[People RocketReach] Exception:", e);
    return null;
  }
}

// ── Provider 4: Lusha ───────────────────────────────────────────────
async function searchLusha(input: PeopleSearchInput, apiKey: string): Promise<PersonResult[] | null> {
  const filters: Record<string, unknown>[] = [];

  if (input.person_titles?.length) {
    filters.push({ type: "job_title", values: input.person_titles });
  }
  if (input.person_locations?.length) {
    filters.push({ type: "location", values: input.person_locations });
  }
  if (input.person_seniorities?.length) {
    filters.push({ type: "seniority", values: input.person_seniorities });
  }
  if (input.organization_industry_tag_ids?.length) {
    filters.push({ type: "industry", values: input.organization_industry_tag_ids });
  }
  if (input.q_organization_name) {
    filters.push({ type: "company_name", values: [input.q_organization_name] });
  }

  if (filters.length === 0) {
    console.log("[People Lusha] No filters");
    return null;
  }

  const requestBody = { contacts: filters, limit: Math.min(input.limit || 25, 100) };
  console.log("[People Lusha] Params:", JSON.stringify(requestBody));

  try {
    const response = await fetch("https://api.lusha.com/prospecting/api/v2/person/search", {
      method: "POST",
      headers: { "Content-Type": "application/json", api_key: apiKey },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error(`[People Lusha] Error ${response.status}:`, JSON.stringify(data).slice(0, 200));
      return null;
    }

    const people = data.data || data.contacts || data.results || [];
    console.log(`[People Lusha] Found ${people.length} people`);
    if (people.length === 0) return null;

    return people.map((p: any) => ({
      id: String(p.id || ""),
      name: [p.first_name || p.firstName, p.last_name || p.lastName].filter(Boolean).join(" ") || p.full_name || "",
      first_name: p.first_name || p.firstName || null,
      last_name: p.last_name || p.lastName || null,
      title: p.job_title || p.title || null,
      headline: null,
      seniority: p.seniority || p.management_level || null,
      departments: p.department ? [p.department] : [],
      organization_name: p.company_name || p.company?.name || null,
      organization_domain: p.company_domain || p.company?.domain || null,
      organization_industry: p.industry || p.company?.industry || null,
      organization_employee_count: p.company?.employees_count || null,
      city: p.city || p.location?.city || null,
      state: p.state || p.location?.state || null,
      country: p.country || p.country_code || null,
      linkedin_url: p.linkedin_url || p.linkedin || null,
      email_status: null,
      photo_url: p.photo_url || null,
      email: p.email || p.work_email || p.emails?.[0]?.email || null,
      phone: p.phone || p.direct_phone || p.phones?.[0]?.number || null,
      source_provider: "lusha",
    }));
  } catch (e) {
    console.error("[People Lusha] Exception:", e);
    return null;
  }
}

// ── Provider 5: ContactOut ──────────────────────────────────────────
const CONTACTOUT_INDUSTRY_MAP: Record<string, string> = {
  software: "Computer Software",
  technology: "Information Technology and Services",
  information_technology_services: "Information Technology and Services",
  "information technology & services": "Information Technology and Services",
  financial_services: "Financial Services",
  healthcare: "Hospital & Health Care",
  real_estate: "Real Estate",
  construction: "Construction",
  manufacturing: "Manufacturing",
  retail: "Retail",
  restaurants: "Restaurants",
  hospitality: "Hospitality",
  education: "Education Management",
  legal: "Law Practice",
  marketing: "Marketing and Advertising",
  consulting: "Management Consulting",
  insurance: "Insurance",
  telecommunications: "Telecommunications",
  transportation: "Transportation/Trucking/Railroad",
  energy: "Oil & Energy",
  agriculture: "Farming",
  entertainment: "Entertainment",
  nonprofit: "Nonprofit Organization Management",
};

function mapContactOutIndustry(value: string): string {
  const trimmed = value.trim();
  const key = trimmed.toLowerCase().replace(/[\s-]+/g, "_");
  return CONTACTOUT_INDUSTRY_MAP[key] || CONTACTOUT_INDUSTRY_MAP[trimmed.toLowerCase()] || trimmed.replace(/&/g, "and");
}

function firstString(value: unknown): string | null {
  if (typeof value === "boolean") return null;
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value)) {
    for (const entry of value) {
      if (typeof entry === "string" && entry.trim()) return entry.trim();
      if (entry && typeof entry === "object") {
        const obj = entry as Record<string, unknown>;
        for (const key of ["email", "value", "number", "internationalNumber", "nationalNumber"]) {
          if (typeof obj[key] === "string" && String(obj[key]).trim()) return String(obj[key]).trim();
        }
      }
    }
  }
  return null;
}

function normalizeLinkedInUrl(value: unknown): string | null {
  const raw = firstString(value);
  if (!raw) return null;
  const cleaned = raw.trim().replace(/^https?:\/\//i, "").replace(/^www\./i, "").replace(/\/+$/, "");
  if (!cleaned.includes("linkedin.com/in/")) return null;
  return `https://${cleaned}`;
}

function linkedinFromContactOut(key: string, p: Record<string, unknown>): string | null {
  for (const raw of [p.linkedin_url, p.url, key]) {
    const normalized = normalizeLinkedInUrl(raw);
    if (normalized) return normalized;
  }
  const vanity = typeof p.li_vanity === "string" ? p.li_vanity.trim().replace(/^\/+|\/+$/g, "") : "";
  return vanity ? `https://www.linkedin.com/in/${vanity}` : null;
}

async function searchContactOut(input: PeopleSearchInput, apiKey: string): Promise<PersonResult[] | null> {
  const body: Record<string, unknown> = {
    page: input.page || 1,
    page_size: Math.min(input.limit || 25, 100),
    current_titles_only: true,
    include_related_job_titles: true,
    match_experience: "current",
    data_types: ["work_email", "personal_email", "phone"],
    reveal_info: true,
    detailed_experience: true,
  };

  if (input.person_titles?.length) body.job_title = input.person_titles;
  if (input.person_locations?.length) body.location = input.person_locations;
  if (input.q_organization_name) body.company = [input.q_organization_name];
  if (input.organization_industry_tag_ids?.length) {
    body.industry = input.organization_industry_tag_ids.map(mapContactOutIndustry);
  }

  if (!input.person_titles?.length && !input.person_locations?.length && !input.organization_industry_tag_ids?.length) {
    console.log("[People ContactOut] No title/location/industry filters");
    return null;
  }

  console.log("[People ContactOut] Params:", JSON.stringify(body));

  try {
    const response = await fetch("https://api.contactout.com/v1/people/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        token: apiKey,
      },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || (typeof data.status_code === "number" && data.status_code >= 400)) {
      console.error(`[People ContactOut] Error ${response.status}:`, JSON.stringify(data).slice(0, 300));
      return null;
    }

    const rawProfiles = data.profiles;
    const entries: [string, Record<string, unknown>][] = Array.isArray(rawProfiles)
      ? rawProfiles.map((p: Record<string, unknown>, i: number) => [String(p.linkedin_url || p.url || i), p])
      : rawProfiles && typeof rawProfiles === "object"
        ? Object.entries(rawProfiles as Record<string, Record<string, unknown>>)
        : [];
    if (entries.length === 0) return null;
    console.log(`[People ContactOut] Found ${entries.length} people`);

    return entries.map(([key, p]) => {
      const company = (p.company && typeof p.company === "object" ? p.company : {}) as Record<string, unknown>;
      const contact = (p.contact_info && typeof p.contact_info === "object" ? p.contact_info : {}) as Record<string, unknown>;
      const exp = Array.isArray(p.experience) ? p.experience.find((e) => e && typeof e === "object" && (e as Record<string, unknown>).is_current) as Record<string, unknown> | undefined : undefined;
      const linkedin = linkedinFromContactOut(key, p);
      const orgDomain = firstString(company.domain) || firstString(company.email_domain) || firstString(company.website) || firstString(exp?.domain);
      return {
        id: String(p.li_vanity || linkedin || key || ""),
        name: firstString(p.full_name) || firstString(p.name) || "",
        first_name: null,
        last_name: null,
        title: firstString(p.title) || firstString(exp?.title),
        headline: firstString(p.headline),
        seniority: firstString(p.seniority),
        departments: firstString(p.job_function) ? [firstString(p.job_function)!] : [],
        organization_name: firstString(company.name) || firstString(exp?.company_name),
        organization_domain: orgDomain ? orgDomain.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null,
        organization_industry: firstString(company.industry) || firstString(p.industry),
        organization_employee_count: typeof company.size === "number" ? company.size : typeof company.employees === "number" ? company.employees : null,
        city: firstString(p.location),
        state: null,
        country: firstString(p.country) || firstString(company.country),
        linkedin_url: linkedin,
        email_status: null,
        photo_url: firstString(p.profile_picture_url),
        email: firstString(contact.work_emails) || firstString(contact.emails) || firstString(contact.personal_emails),
        phone: firstString(contact.phones),
        source_provider: "contactout",
      };
    });
  } catch (e) {
    console.error("[People ContactOut] Exception:", e);
    return null;
  }
}

// ── Provider 6: Hunter.io ───────────────────────────────────────────
async function searchHunter(input: PeopleSearchInput, apiKey: string): Promise<PersonResult[] | null> {
  // Hunter works best with a company domain or name
  const companyName = input.q_organization_name;
  if (!companyName) {
    console.log("[People Hunter] No company name to search");
    return null;
  }

  console.log(`[People Hunter] Searching for people at: ${companyName}`);

  try {
    const params = new URLSearchParams({
      company: companyName,
      api_key: apiKey,
      limit: String(Math.min(input.limit || 25, 100)),
    });

    // Filter by seniority if provided
    if (input.person_seniorities?.length) {
      params.set("seniority", input.person_seniorities[0]);
    }
    // Filter by department
    if (input.person_departments?.length) {
      params.set("department", input.person_departments[0]);
    }

    const response = await fetch(`https://api.hunter.io/v2/domain-search?${params}`);
    const data = await response.json();

    if (!response.ok) {
      console.error(`[People Hunter] Error ${response.status}:`, data?.errors || data);
      return null;
    }

    const result = data.data;
    if (!result?.emails?.length) {
      console.log("[People Hunter] No results");
      return null;
    }

    const orgName = result.organization || result.domain || companyName;
    const orgDomain = result.domain || null;
    console.log(`[People Hunter] Found ${result.emails.length} people`);

    return result.emails.map((e: any) => ({
      id: "",
      name: [e.first_name, e.last_name].filter(Boolean).join(" ") || "",
      first_name: e.first_name || null,
      last_name: e.last_name || null,
      title: e.position || null,
      headline: null,
      seniority: e.seniority || null,
      departments: e.department ? [e.department] : [],
      organization_name: orgName,
      organization_domain: orgDomain,
      organization_industry: null,
      organization_employee_count: null,
      city: null,
      state: null,
      country: null,
      linkedin_url: e.linkedin || null,
      email_status: e.verification?.status || null,
      photo_url: null,
      email: e.value || null,
      phone: e.phone_number || null,
      source_provider: "hunter",
    }));
  } catch (e) {
    console.error("[People Hunter] Exception:", e);
    return null;
  }
}

// ── Provider 6: Clay ────────────────────────────────────────────────
async function searchClay(input: PeopleSearchInput, apiKey: string): Promise<PersonResult[] | null> {
  const queryParts: string[] = [];
  if (input.person_titles?.length) queryParts.push(...input.person_titles);
  if (input.q_organization_name) queryParts.push(input.q_organization_name);
  if (input.organization_industry_tag_ids?.length) queryParts.push(...input.organization_industry_tag_ids);
  if (input.person_locations?.length) queryParts.push(...input.person_locations);

  if (queryParts.length === 0) {
    console.log("[People Clay] No search criteria");
    return null;
  }

  console.log(`[People Clay] Searching: ${queryParts.join(", ")}`);

  try {
    const response = await fetch("https://api.clay.com/v3/people/search", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        query: queryParts.join(" "),
        limit: Math.min(input.limit || 25, 50),
        filters: {
          ...(input.person_titles?.length ? { titles: input.person_titles } : {}),
          ...(input.person_locations?.length ? { locations: input.person_locations } : {}),
          ...(input.q_organization_name ? { company: input.q_organization_name } : {}),
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[People Clay] Error ${response.status}:`, errorText.slice(0, 200));
      return null;
    }

    const data = await response.json();
    const people = data.results || data.people || data.data || [];
    console.log(`[People Clay] Found ${people.length} people`);
    if (people.length === 0) return null;

    return people.map((p: any) => ({
      id: String(p.id || ""),
      name: p.name || p.full_name || [p.first_name, p.last_name].filter(Boolean).join(" ") || "",
      first_name: p.first_name || null,
      last_name: p.last_name || null,
      title: p.title || p.job_title || null,
      headline: p.headline || null,
      seniority: p.seniority || null,
      departments: p.department ? [p.department] : [],
      organization_name: p.company_name || p.organization || null,
      organization_domain: p.company_domain || p.domain || null,
      organization_industry: p.industry || null,
      organization_employee_count: p.company_size || null,
      city: p.city || p.location?.city || null,
      state: p.state || p.location?.state || null,
      country: p.country || null,
      linkedin_url: p.linkedin_url || p.linkedin || null,
      email_status: null,
      photo_url: p.photo_url || null,
      email: p.email || p.work_email || null,
      phone: p.phone || p.direct_phone || null,
      source_provider: "clay",
    }));
  } catch (e) {
    console.error("[People Clay] Exception:", e);
    return null;
  }
}

// ── Merge helper ────────────────────────────────────────────────────
function normalizeKey(person: PersonResult): string {
  // Key by linkedin URL first (most unique), then by name+company
  if (person.linkedin_url) {
    return person.linkedin_url
      .replace(/^https?:\/\//, "")
      .replace(/\/$/, "")
      .toLowerCase();
  }
  const name = (person.name || "").toLowerCase().trim();
  const org = (person.organization_name || person.organization_domain || "").toLowerCase().trim();
  return `${name}@${org}`;
}

function mergePerson(primary: PersonResult, secondary: PersonResult): PersonResult {
  return {
    id: primary.id || secondary.id,
    name: primary.name || secondary.name,
    first_name: primary.first_name || secondary.first_name,
    last_name: primary.last_name || secondary.last_name,
    title: primary.title || secondary.title,
    headline: primary.headline || secondary.headline,
    seniority: primary.seniority || secondary.seniority,
    departments: primary.departments.length > 0 ? primary.departments : secondary.departments,
    organization_name: primary.organization_name || secondary.organization_name,
    organization_domain: primary.organization_domain || secondary.organization_domain,
    organization_industry: primary.organization_industry || secondary.organization_industry,
    organization_employee_count: primary.organization_employee_count ?? secondary.organization_employee_count,
    city: primary.city || secondary.city,
    state: primary.state || secondary.state,
    country: primary.country || secondary.country,
    linkedin_url: primary.linkedin_url || secondary.linkedin_url,
    email_status: primary.email_status || secondary.email_status,
    photo_url: primary.photo_url || secondary.photo_url,
    email: primary.email || secondary.email,
    phone: primary.phone || secondary.phone,
    source_provider: primary.source_provider,
  };
}

// ── Main Handler ────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    const requestedHeaders = req.headers.get("access-control-request-headers");
    return new Response(null, {
      headers: {
        ...corsHeaders,
        ...(requestedHeaders ? { "Access-Control-Allow-Headers": requestedHeaders } : {}),
      },
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body: PeopleSearchInput = await req.json();
    const v = validatePeopleSearchRequest(body as unknown as Record<string, unknown>);
    if (!v.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Missing required fields",
          missing: v.missingFields,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const limit = body.limit || 25;
    console.log("People search request:", JSON.stringify(body));

    // Build provider list
    const providers: { name: string; fn: () => Promise<PersonResult[] | null> }[] = [];

    const apolloKey = Deno.env.get("APOLLO_API_KEY");
    if (apolloKey) providers.push({ name: "Apollo", fn: () => searchApollo(body, apolloKey) });

    const pdlKey = Deno.env.get("PDL_API_KEY");
    if (pdlKey) providers.push({ name: "PDL", fn: () => searchPDL(body, pdlKey) });

    const contactOutKey = Deno.env.get("CONTACTOUT_API_KEY");
    if (contactOutKey) providers.push({ name: "ContactOut", fn: () => searchContactOut(body, contactOutKey) });

    const rocketReachKey = Deno.env.get("ROCKETREACH_API_KEY");
    if (rocketReachKey) providers.push({ name: "RocketReach", fn: () => searchRocketReach(body, rocketReachKey) });

    const lushaKey = Deno.env.get("LUSHA_API_KEY");
    if (lushaKey) providers.push({ name: "Lusha", fn: () => searchLusha(body, lushaKey) });

    const hunterKey = Deno.env.get("HUNTER_API_KEY");
    if (hunterKey) providers.push({ name: "Hunter", fn: () => searchHunter(body, hunterKey) });

    const clayKey = Deno.env.get("CLAY_API_KEY");
    if (clayKey) providers.push({ name: "Clay", fn: () => searchClay(body, clayKey) });

    if (providers.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error:
            "No B2B search API keys configured. Add APOLLO_API_KEY (and optionally PDL, RocketReach, etc.) in Supabase → Edge Functions → Secrets.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Run ALL providers in parallel
    console.log(`[Merge] Running ${providers.length} providers in parallel...`);
    const allResults = await Promise.allSettled(
      providers.map(async (p) => {
        console.log(`[Merge] Starting ${p.name}...`);
        const result = await p.fn();
        if (result && result.length > 0) {
          console.log(`[Merge] ✓ ${p.name} returned ${result.length} people`);
          return { name: p.name, people: result };
        }
        console.log(`[Merge] ✗ ${p.name} returned no results`);
        return { name: p.name, people: [] as PersonResult[] };
      }),
    );

    // Build merged map keyed by normalized identity
    const mergedMap = new Map<string, PersonResult>();
    const usedProviders: string[] = [];

    for (const settled of allResults) {
      if (settled.status !== "fulfilled") continue;
      const { name, people } = settled.value;
      if (people.length === 0) continue;
      usedProviders.push(name);

      for (const person of people) {
        const key = normalizeKey(person);
        if (!key || key === "@") continue;
        const existing = mergedMap.get(key);
        if (existing) {
          mergedMap.set(key, mergePerson(existing, person));
        } else {
          mergedMap.set(key, person);
        }
      }
    }

    const mergedPeople = Array.from(mergedMap.values()).slice(0, limit);
    console.log(`[Merge] Final: ${mergedPeople.length} merged people from [${usedProviders.join(", ")}]`);

    return new Response(
      JSON.stringify({
        success: true,
        people: mergedPeople,
        total: mergedPeople.length,
        providers: usedProviders.map((p) => p.toLowerCase()),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("People search error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Search failed" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
