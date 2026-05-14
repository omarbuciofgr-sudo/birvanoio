/**
 * Google Jobs via SerpApi — mirrors Omar_bucio_backend_Scraper/utils/google_jobs_serpapi.py
 * Secret: SERPAPI_API_KEY (Supabase Dashboard -> Edge Functions -> Secrets).
 */

/** Supabase Edge runs on Deno; TS in the repo does not load Deno lib by default. */
declare const Deno: {
  env: { get(key: string): string | undefined };
  serve: (handler: (req: Request) => Response | Promise<Response>) => void;
};

const SERPAPI_SEARCH_URL = "https://serpapi.com/search";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
};

const MERGE_KEYS = new Set(["q", "job_title", "keywords", "company", "exclude_keywords"]);
const LOCATION_KEYS = new Set(["location", "uule"]);
const PASSTHROUGH_KEYS = new Set([
  "google_domain",
  "gl",
  "hl",
  "lrad",
  "ltype",
  "chips",
  "next_page_token",
]);

function stringifyFragment(val: unknown): string {
  if (val == null) return "";
  if (Array.isArray(val)) {
    return val.map((x) => String(x).trim()).filter(Boolean).join(" ");
  }
  return String(val).trim();
}

function mergeGoogleJobsQ(body: Record<string, unknown>): string {
  const parts: string[] = [];
  const q0 = body["q"];
  if (q0 != null) {
    const s = String(q0).trim();
    if (s) parts.push(s);
  }
  for (const key of ["job_title", "keywords", "company"] as const) {
    if (!(key in body)) continue;
    const s = stringifyFragment(body[key]);
    if (s) parts.push(s);
  }
  const ex = body["exclude_keywords"];
  if (ex == null) return parts.join(" ").trim();
  if (Array.isArray(ex)) {
    for (const item of ex) {
      const t = String(item).trim();
      if (t) parts.push(`-${t}`);
    }
  } else {
    for (const t of String(ex).split(/\s+/)) {
      if (t.trim()) parts.push(`-${t.trim()}`);
    }
  }
  return parts.join(" ").trim();
}

function paramString(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "boolean") return v ? "true" : "false";
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  const s = String(v).trim();
  return s || null;
}

function buildSerpapiGoogleJobsParams(
  body: Record<string, unknown>,
  apiKey: string,
): Record<string, string> {
  const mergedQ = mergeGoogleJobsQ(body);
  const params: Record<string, string> = {
    engine: "google_jobs",
    api_key: apiKey,
  };
  if (mergedQ) params.q = mergedQ;

  const uuleS = body["uule"] != null ? String(body["uule"]).trim() : "";
  const locS = body["location"] != null ? String(body["location"]).trim() : "";
  if (uuleS) params.uule = uuleS;
  else if (locS) params.location = locS;

  for (const key of PASSTHROUGH_KEYS) {
    if (!(key in body)) continue;
    const s = paramString(body[key]);
    if (s != null) params[key] = s;
  }

  const skipExtra = new Set([
    ...MERGE_KEYS,
    ...LOCATION_KEYS,
    ...PASSTHROUGH_KEYS,
    "api_key",
    "engine",
  ]);
  for (const [k, v] of Object.entries(body)) {
    if (skipExtra.has(k) || v == null) continue;
    if (typeof v === "object") continue;
    const s = paramString(v);
    if (s != null) params[k] = s;
  }

  return params;
}

function mapJobsResultItem(raw: Record<string, unknown>): Record<string, unknown> {
  const extIn = raw["detected_extensions"];
  let posted_at: unknown = null;
  let schedule_type: unknown = null;
  if (extIn != null && typeof extIn === "object" && !Array.isArray(extIn)) {
    const d = extIn as Record<string, unknown>;
    posted_at = d["posted_at"];
    schedule_type = d["schedule_type"];
  }
  const de: Record<string, unknown> = {};
  if (posted_at != null) de["posted_at"] = posted_at;
  if (schedule_type != null) de["schedule_type"] = schedule_type;
  const detected_extensions = Object.keys(de).length > 0 ? de : null;

  return {
    title: raw["title"],
    company_name: raw["company_name"],
    location: raw["location"],
    description: raw["description"],
    detected_extensions,
    apply_options: raw["apply_options"],
    job_id: raw["job_id"],
  };
}

async function callGoogleJobsSerpapi(
  body: Record<string, unknown>,
  apiKey: string,
): Promise<{
  jobs: Record<string, unknown>[];
  next_page_token: string | null;
  meta: Record<string, unknown>;
}> {
  const params = buildSerpapiGoogleJobsParams(body, apiKey);
  const qs = new URLSearchParams(params).toString();
  const url = `${SERPAPI_SEARCH_URL}?${qs}`;

  const controller = new AbortController();
  const tid = setTimeout(() => controller.abort(), 90_000);
  let resp: Response;
  try {
    resp = await fetch(url, {
      method: "GET",
      headers: { "User-Agent": "BrivanoGoogleJobs/1.0 (supabase-edge)" },
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(tid);
    const msg = e instanceof Error ? e.message : String(e);
    return { jobs: [], next_page_token: null, meta: { error: msg } };
  }
  clearTimeout(tid);

  const text = await resp.text();
  if (!resp.ok) {
    return {
      jobs: [],
      next_page_token: null,
      meta: { error: `HTTP ${resp.status}`, error_body: text.slice(0, 2000) },
    };
  }

  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch (e) {
    return {
      jobs: [],
      next_page_token: null,
      meta: { error: `Invalid JSON from SerpApi: ${e instanceof Error ? e.message : String(e)}` },
    };
  }

  if (data == null || typeof data !== "object" || Array.isArray(data)) {
    return { jobs: [], next_page_token: null, meta: { error: "Unexpected SerpApi response shape" } };
  }

  const d = data as Record<string, unknown>;
  const meta: Record<string, unknown> = {};
  if (d["error"]) meta["error"] = d["error"];
  const sm = d["search_metadata"];
  if (sm != null && typeof sm === "object" && !Array.isArray(sm)) {
    const smObj = sm as Record<string, unknown>;
    const pick: Record<string, unknown> = {};
    for (const k of ["id", "status", "google_jobs_url"] as const) {
      if (k in smObj) pick[k] = smObj[k];
    }
    if (Object.keys(pick).length) meta["search_metadata"] = pick;
  }

  let next_tok: string | null = null;
  const pag = d["serpapi_pagination"];
  if (pag != null && typeof pag === "object" && !Array.isArray(pag)) {
    const npt = (pag as Record<string, unknown>)["next_page_token"];
    if (npt != null && String(npt).trim()) next_tok = String(npt);
  }

  const jobs_raw = d["jobs_results"];
  const jobs: Record<string, unknown>[] = [];
  if (Array.isArray(jobs_raw)) {
    for (const row of jobs_raw) {
      if (row != null && typeof row === "object" && !Array.isArray(row)) {
        jobs.push(mapJobsResultItem(row as Record<string, unknown>));
      }
    }
  }

  return { jobs, next_page_token: next_tok, meta };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "GET" && req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const apiKey = (Deno.env.get("SERPAPI_API_KEY") ?? "").trim();
  if (!apiKey) {
    return new Response(
      JSON.stringify({
        jobs: [],
        next_page_token: null,
        serpapi_pagination: { next_page_token: null },
        error:
          "SERPAPI_API_KEY is not set. Add it under Supabase Project Settings -> Edge Functions -> Secrets, then redeploy.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: Record<string, unknown> = {};
  try {
    if (req.method === "GET") {
      const u = new URL(req.url);
      for (const key of u.searchParams.keys()) {
        const vals = u.searchParams.getAll(key);
        if (vals.length === 1) body[key] = vals[0]!;
        else body[key] = vals;
      }
    } else {
      const parsed = await req.json().catch(() => null);
      body = parsed != null && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};
    }
  } catch {
    body = {};
  }

  try {
    const { jobs, next_page_token, meta } = await callGoogleJobsSerpapi(body, apiKey);
    const payload: Record<string, unknown> = {
      jobs,
      next_page_token,
      serpapi_pagination: { next_page_token },
    };
    if (meta["error"]) payload["error"] = meta["error"];
    if (meta["search_metadata"]) payload["search_metadata"] = meta["search_metadata"];
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(
      JSON.stringify({
        jobs: [],
        next_page_token: null,
        serpapi_pagination: { next_page_token: null },
        error: msg,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
