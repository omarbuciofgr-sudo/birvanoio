import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

type PlannerCatalogEntry = {
  id: string;
  label?: string;
  description?: string;
  order?: number;
  group?: string;
  iconHint?: string;
};

type PlannerSchemaField = {
  id: string;
  label?: string;
  type?: string;
  required?: boolean;
  enum?: string[];
  helpText?: string;
};

/** Remove any model-hallucinated planner_ui fences so they are never echoed into prompts. */
function stripEmbeddedPlannerFences(s: string): string {
  return s.replace(/```planner_ui\s*\n[\s\S]*?```/g, "").trim();
}

/** One-line question from schema — host-owned copy; never use long model prose for collect_field.prompt. */
function shortQuestionForField(fieldId: string, schemaFields: PlannerSchemaField[]): string {
  const f = schemaFields.find((x) => x.id === fieldId);
  if (!f) return "Please answer below.";
  const label = (f.label ?? f.id).trim();
  const ht = (f.helpText ?? "").trim();
  const req =
    f.required === false
      ? "(optional)"
      : "(required — needed to apply this plan)";
  const line = ht ? `${label} ${req} — ${ht}` : `${label} ${req}?`;
  return line.length > 320 ? `${line.slice(0, 317)}…` : line;
}

function buildPickFilterPlannerUi(
  context: string,
  catalog: PlannerCatalogEntry[],
): Record<string, unknown> {
  const sorted = [...catalog].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const options = sorted.map((e) => {
    const o: Record<string, string> = { id: e.id, label: e.label ?? e.id };
    if (e.group) o.group = e.group;
    if (e.description) o.description = e.description;
    if (e.iconHint) o.iconHint = e.iconHint;
    return o;
  });
  return {
    phase: "pick_filter",
    context,
    pick_filter: {
      prompt: "Choose what you want to do below.",
      options,
    },
  };
}

/** Order enum values: host suggestion order first (valid for enum), then remaining enum members. */
function orderedEnumPool(enumVals: string[], suggestions: string[], max: number): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  const sugIn = suggestions.filter((s) => enumVals.includes(s));
  for (const s of sugIn) {
    if (!seen.has(s)) {
      seen.add(s);
      out.push(s);
    }
  }
  for (const e of enumVals) {
    if (!seen.has(e)) {
      seen.add(e);
      out.push(e);
    }
  }
  return out.slice(0, max);
}

/**
 * Required fields: still “collect” until value is non-empty (by schema type).
 * Optional fields: must be asked once; after `field_id` exists in acc (even "" / []), we stop asking.
 */
function fieldNeedsCollection(f: PlannerSchemaField, acc: Record<string, unknown>): boolean {
  if (!(f.id in acc)) return true;
  if (f.required === false) return false;
  const v = acc[f.id];
  return (
    v === undefined ||
    v === null ||
    (typeof v === "string" && String(v).trim() === "") ||
    (Array.isArray(v) && v.length === 0)
  );
}

/** Next schema field to collect (order preserved). Used when tools omit ask_next_question or complete_plan is premature. */
function inferNextFieldId(
  schema: PlannerSchemaField[],
  acc: Record<string, unknown>,
): string | null {
  for (const f of schema) {
    if (fieldNeedsCollection(f, acc)) return f.id;
  }
  return null;
}

const MIN_COLLECT_CHOICES = 5;

/** Pad id/label options toward MIN_COLLECT_CHOICES using enum + suggestions (no invented values). */
function padCollectOptions(
  initial: { id: string; label: string }[],
  min: number,
  field: PlannerSchemaField | undefined,
  suggestions: string[],
): { id: string; label: string }[] {
  if (initial.length >= min) return initial;
  if (field?.enum?.length && field.enum.length < min) {
    return initial;
  }
  const out = [...initial];
  const ids = new Set(out.map((o) => o.id));
  if (field?.enum?.length) {
    const pool = orderedEnumPool(field.enum, suggestions, 96);
    for (const v of pool) {
      if (out.length >= min) break;
      if (!ids.has(v)) {
        ids.add(v);
        out.push({ id: v, label: v });
      }
    }
  }
  for (const s of suggestions) {
    if (out.length >= min) break;
    if (!ids.has(s)) {
      ids.add(s);
      out.push({ id: s, label: s });
    }
  }
  return out;
}

function buildCollectPlannerUi(
  context: string,
  fieldId: string,
  question: string,
  schemaFields: PlannerSchemaField[],
  suggestions: string[],
): Record<string, unknown> {
  const field = schemaFields.find((f) => f.id === fieldId);
  const TAB_LABELS: Record<string, string> = {
    "prospect-search": "Brivano Lens",
    search: "Search",
    "real-estate": "Real Estate",
    "ai-chat": "AI Assistant",
  };
  const LISTING_LABELS: Record<string, string> = {
    fsbo_sale: "FSBO / for-sale by owner",
    for_rent_by_owner: "For rent by owner",
    either: "Either",
  };
  let options: { id: string; label: string }[] = [];
  let input_kind: "single_choice" | "multi_choice" | "text" = "text";
  const maxEnum = 48;
  const maxSugString = 40;

  if (fieldId === "suggestedTab" && field?.enum?.length) {
    for (const id of field.enum) {
      options.push({ id, label: TAB_LABELS[id] ?? id });
    }
    input_kind = "single_choice";
  } else if (fieldId === "listingIntent" && field?.enum?.length) {
    const pool = orderedEnumPool(field.enum, suggestions, maxEnum);
    for (const v of pool) {
      options.push({ id: v, label: LISTING_LABELS[v] ?? v });
    }
    input_kind = "single_choice";
  } else if (field?.enum?.length) {
    const pool = orderedEnumPool(field.enum, suggestions, maxEnum);
    for (const v of pool) {
      options.push({ id: v, label: v });
    }
    input_kind = field.type === "string[]" ? "multi_choice" : "single_choice";
  } else if (field?.type === "string" && suggestions.length > 0 && !field.enum?.length) {
    for (const v of suggestions.slice(0, maxSugString)) {
      options.push({ id: v, label: v });
    }
    input_kind = "single_choice";
  } else if (field?.type === "string[]" && suggestions.length > 0 && !field.enum?.length) {
    for (const v of suggestions.slice(0, maxEnum)) {
      options.push({ id: v, label: v });
    }
    input_kind = "multi_choice";
  }

  if (input_kind !== "text" && options.length === 0) {
    input_kind = "text";
  }

  if (input_kind !== "text" && options.length > 0 && options.length < MIN_COLLECT_CHOICES) {
    options = padCollectOptions(options, MIN_COLLECT_CHOICES, field, suggestions);
  }

  if (input_kind !== "text" && options.length === 0) {
    input_kind = "text";
  }

  const requiredForApply = field?.required !== false;
  return {
    phase: "collect_field",
    context,
    collect_field: {
      field_id: fieldId,
      prompt: question,
      input_kind,
      options,
      allow_custom_text: true,
      required_for_apply: requiredForApply,
    },
  };
}

function buildReviewPlannerUi(
  context: string,
  fieldSummary: Record<string, unknown>,
): Record<string, unknown> {
  const summary = Object.entries(fieldSummary).map(([fid, value]) => {
    const disp =
      typeof value === "object" && value !== null ? JSON.stringify(value) : String(value ?? "");
    return { field_id: fid, value, display: disp };
  });
  return {
    phase: "review",
    context,
    review: { summary },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Invalid authentication" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;
    console.log(`[planner] Authenticated user: ${userId}`);

    const body = await req.json();
    const {
      messages,
      mode: rawMode,
      context: plannerContext,
      filterCatalog,
      selectedFilterId,
      schemaForSelectedFilter,
      suggestionsForField,
      accumulatedValues: incomingAccumulated,
    } = body as {
      messages?: { role: string; content: string }[];
      mode?: string;
      context?: string;
      filterCatalog?: PlannerCatalogEntry[];
      selectedFilterId?: string | null;
      schemaForSelectedFilter?: PlannerSchemaField[] | null;
      suggestionsForField?: Record<string, string[]> | null;
      accumulatedValues?: Record<string, unknown> | null;
    };

    const mode: "assistant" | "planner" = rawMode === "planner" ? "planner" : "assistant";
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "OpenAI is not configured: set secret OPENAI_API_KEY on this Edge Function." }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const chatModel =
      Deno.env.get("PLANNER_MODEL")?.trim() ||
      Deno.env.get("PROSPECT_SEARCH_CHAT_MODEL")?.trim() ||
      "gpt-4o-mini";

    const systemPrompt = `You are Brivano's prospect search assistant. Your PRIMARY job is to AUTO-APPLY filters when a user describes what they're looking for. You MUST call the apply_filters tool on EVERY user message that mentions any kind of company, industry, location, or prospect criteria.

CRITICAL RULES:
1. ALWAYS call apply_filters — even if the request is vague, make your best guess and apply filters
2. NEVER tell the user to "go to another tab" or "use the Prospect Search tab" — YOU are the search tool
3. NEVER give step-by-step instructions on how to use the UI — just DO IT by calling apply_filters
4. Keep your text response to 1-2 sentences max, confirming what filters you applied
5. If the user asks for "emails" or "contacts", that means they want to search for companies/people — apply the relevant industry/keyword filters

Examples of what to do:
- User: "property management companies" → call apply_filters with industries: ["property_management", "real_estate"], keywordsInclude: ["property management"]
- User: "tenant placement in Texas" → call apply_filters with industries: ["property_management"], citiesOrStates: ["Texas"], keywordsInclude: ["tenant placement"]
- User: "SaaS companies with 50-200 employees" → call apply_filters with industries: ["saas"], companySizes: ["51-200"]
- User: "restaurants in California" → call apply_filters with industries: ["restaurants"], citiesOrStates: ["California"]

Available filter values:
- Industries (use exact values): software_development, saas, information_technology, cybersecurity, cloud_computing, artificial_intelligence, data_analytics, fintech, edtech, healthtech, proptech, ecommerce, blockchain, gaming, telecommunications, internet_services, hardware, semiconductors, robotics, iot, banking, financial_services, insurance, investment_management, venture_capital, accounting, wealth_management, mortgage, credit_unions, payments, healthcare, hospitals, medical_devices, pharmaceuticals, biotechnology, dental, mental_health, veterinary, home_health, clinical_research, medical_practice, chiropractic, optometry, physical_therapy, real_estate, commercial_real_estate, property_management, construction, residential_construction, commercial_construction, architecture, civil_engineering, roofing, hvac, plumbing, electrical, landscaping, painting, flooring, home_improvement, solar, general_contracting, demolition, interior_design, legal, consulting, marketing_advertising, public_relations, staffing_recruiting, human_resources, business_consulting, it_consulting, graphic_design, web_design, seo, translation, photography, videography, event_planning, printing, security_services, janitorial, pest_control, moving_storage, manufacturing, automotive, aerospace, chemicals, plastics, metals, food_manufacturing, textiles, electronics_manufacturing, packaging, machinery, paper, glass, furniture_manufacturing, retail, wholesale, consumer_goods, luxury_goods, fashion, cosmetics, sporting_goods, pet_industry, wine_spirits, grocery, convenience_stores, auto_dealerships, restaurants, fast_food, bars_nightclubs, catering, food_trucks, bakeries, hotels, hospitality, travel_tourism, airlines, education, higher_education, k12, elearning, tutoring, vocational_training, childcare, driving_schools, oil_gas, renewable_energy, utilities, environmental_services, waste_management, water_treatment, transportation, trucking, shipping, logistics, warehousing, courier, railroads, towing, auto_repair, car_wash, media, publishing, music, film_production, animation, news, podcasting, advertising_tech, government, nonprofit, religious, political, military, philanthropy, agriculture, farming, dairy, fisheries, forestry, cannabis, gyms, yoga_pilates, spas, personal_training, martial_arts, sports_leagues, funeral_services, laundry, storage, vending, locksmith, staffing_agencies, coworking, franchise
- Company sizes: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+
- Revenue ranges: 0-1M, 1M-5M, 5M-10M, 10M-50M, 50M-100M, 100M-500M, 500M-1B, 1B+
- Countries (ISO codes): US, CA, GB, AU, DE, FR, NL, SE, NO, DK, FI, IE, ES, IT, PT, CH, AT, BE, PL, CZ, IN, JP, KR, SG, HK, NZ, IL, AE, SA, BR, MX, CO, AR, CL, ZA, NG, KE, EG, PH, TH, VN, ID, MY, TW, RO, UA, TR, RU, CN
- US States: Alabama, Alaska, Arizona, Arkansas, California, Colorado, Connecticut, Delaware, Florida, Georgia, Hawaii, Idaho, Illinois, Indiana, Iowa, Kansas, Kentucky, Louisiana, Maine, Maryland, Massachusetts, Michigan, Minnesota, Mississippi, Missouri, Montana, Nebraska, Nevada, New Hampshire, New Jersey, New Mexico, New York, North Carolina, North Dakota, Ohio, Oklahoma, Oregon, Pennsylvania, Rhode Island, South Carolina, South Dakota, Tennessee, Texas, Utah, Vermont, Virginia, Washington, West Virginia, Wisconsin, Wyoming

ALWAYS call apply_filters. No exceptions.`;

    const applyFiltersProps = {
      industries: {
        type: "array",
        items: { type: "string" },
        description: "Industry values to include",
      },
      companySizes: {
        type: "array",
        items: { type: "string" },
        description: "Company size ranges",
      },
      annualRevenue: {
        type: "string",
        description: "Revenue range value",
      },
      countries: {
        type: "array",
        items: { type: "string" },
        description: "Country ISO codes",
      },
      citiesOrStates: {
        type: "array",
        items: { type: "string" },
        description: "US state names or city names",
      },
      keywordsInclude: {
        type: "array",
        items: { type: "string" },
        description: "Keywords to include in description search",
      },
      limit: {
        type: "number",
        description: "Number of results to return",
      },
    };

    const applyFiltersDef = {
      name: "apply_filters",
      description: "Auto-apply search filters based on the user's request. Only include fields you want to change.",
      parameters: {
        type: "object" as const,
        properties: applyFiltersProps,
        additionalProperties: false,
      },
    };

    const recordFieldAnswerDef = {
      name: "record_field_answer",
      description:
        "Record one schema field value after the user's reply. Use exact enum values from schema when applicable. For optional fields, record \"\" or null if they skip after being asked.",
      parameters: {
        type: "object" as const,
        properties: {
          field_id: { type: "string", description: "Schema field id" },
          value: {
            description: "JSON value: string, string[], number, or boolean",
          },
        },
        required: ["field_id", "value"],
        additionalProperties: false,
      },
    };

    const askNextDef = {
      name: "ask_next_question",
      description:
        "Ask exactly one question about the given schema field. Only use field ids from schema_for_selected_filter.",
      parameters: {
        type: "object" as const,
        properties: {
          field_id: { type: "string", description: "Which schema field this question is about" },
          question: {
            type: "string",
            description:
              "One short sentence only; no JSON or code fences. The host displays the canonical schema question.",
          },
        },
        required: ["field_id", "question"],
        additionalProperties: false,
      },
    };

    const completePlanDef = {
      name: "complete_plan",
      description:
        "Finish this filter configuration: summary, field id → final value map, suggested tab, optional Lens filters. Call ONLY after EVERY field in schema_for_selected_filter has been addressed (required and optional). For optional fields, include them in fieldSummary even if empty/skipped.",
      parameters: {
        type: "object" as const,
        properties: {
          summary: {
            type: "string",
            description: "Short summary of configured filter for review (plain language)",
          },
          fieldSummary: {
            type: "object",
            description: "Map of schema field id → final human-readable or structured value",
            additionalProperties: true,
          },
          suggestedTab: {
            type: "string",
            enum: ["prospect-search", "search", "real-estate", "ai-chat"],
            description: "Which Brivano Scout tab fits next",
          },
          plannerSearchType: {
            type: "string",
            enum: ["people", "companies", "jobs", "local"],
            description:
              "When suggested_tab is prospect-search: Lens mode (must align with selected_filter_id: find_people→people, find_companies→companies, find_jobs→jobs, local_businesses→local).",
          },
          realEstateCity: {
            type: "string",
            description: "When suggested_tab is real-estate: city or area string for the scraper field.",
          },
          ...applyFiltersProps,
        },
        required: ["summary", "fieldSummary", "suggestedTab"],
        additionalProperties: false,
      },
    };

    if (mode === "planner") {
      if (!Array.isArray(filterCatalog) || filterCatalog.length === 0) {
        return new Response(
          JSON.stringify({
            error: "FILTER_CATALOG_REQUIRED",
            message: "Planner requires a non-empty filter_catalog from the host.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const plannerHostState = JSON.stringify(
      {
        context: plannerContext ?? null,
        filter_catalog: filterCatalog ?? null,
        selected_filter_id: selectedFilterId ?? null,
        schema_for_selected_filter: schemaForSelectedFilter ?? null,
        suggestions_for_field: suggestionsForField && typeof suggestionsForField === "object"
          ? suggestionsForField
          : {},
        accumulated_field_values: incomingAccumulated && typeof incomingAccumulated === "object"
          ? incomingAccumulated
          : {},
      },
      null,
      2
    );

    const plannerSystemPrompt = `You are the Planner configuration assistant for Brivano Scout. Flow: catalog → one selection → schema-only questions → review.

## Injected host state (authoritative — never invent rows, groups, or enum values)
${plannerHostState}

## 1 — pick_filter / Brivano Lens in the catalog (not only in copy)
When emitting planner_ui with phase "pick_filter", pick_filter.options[] must copy group from filter_catalog exactly per row (same order). Section titles in the UI come from distinct group strings per catalog row (often a single section such as "Brivano Lens"). Do not merge groups into one paragraph or hide section titles only inside a description. If the host omitted group on an item, do not invent groups — tell the host to supply them.

## 2 — collect_field / selectable answers when data exists
For phase "collect_field": if suggestions_for_field[field_id] is non-empty OR the schema field has enum/allowed values, you must fill collect_field.options (id + label; preserve host ordering for suggestions — the server merges this). Set input_kind to single_choice or multi_choice per schema (string[] enums → multi_choice). Set allow_custom_text true always. If there are no suggestions and no enum, input_kind "text", options []. Do not use only a prose paragraph when choices exist — the Edge Function fills plannerUi.options from schema + suggestions.

## 3 — Output shape
Keep your assistant message to one short sentence (no JSON, no markdown code fences, no nested planner_ui). The API returns structured plannerUi separately; never paste JSON or code blocks into your reply.

## 4 — Anti-regressions
No long numbered lists as the only way to pick when pick_filter.options is present. No questions for fields outside schema_for_selected_filter. Do not claim apply succeeded unless the host confirms.

## Startup / completion
If selected_filter_id is empty: short prose only; no domain/schema questions until one catalog item is chosen.
When selected_filter_id is set: walk schema_for_selected_filter **in order**. Ask **every** field id (both required and optional). Say whether each is optional in ask_next_question when helpful; the host labels required vs optional. One ask_next_question (+ record_field_answer) per user turn typically.

## complete_plan
Include fieldSummary covering **all** schema field ids for this filter (optional fields may be empty string or null if skipped). Map paths to plannerSearchType / realEstateCity / Lens filters as already specified. Do **not** call complete_plan until each schema field has been asked and recorded.

Tools — use only these:
- record_field_answer(field_id, value) — for optional fields, record \"\" or null if the user skips after you asked.
- ask_next_question(field_id, question)
- complete_plan(summary, fieldSummary, suggestedTab, optional plannerSearchType, realEstateCity, optional lens fields)`;

    const tools =
      mode === "planner"
        ? [
            { type: "function" as const, function: recordFieldAnswerDef },
            { type: "function" as const, function: askNextDef },
            { type: "function" as const, function: completePlanDef },
          ]
        : [{ type: "function" as const, function: applyFiltersDef }];

    const effectiveSystem = mode === "planner" ? plannerSystemPrompt : systemPrompt;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: chatModel,
        messages: [{ role: "system", content: effectiveSystem }, ...(messages ?? [])],
        tools,
        tool_choice: "auto",
        stream: false,
      }),
    });

    if (!response.ok) {
      const status = response.status;
      if (status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (status === 402) {
        return new Response(JSON.stringify({ error: "Payment required" }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const choice = data.choices?.[0];

    let textContent = choice?.message?.content || "";
    if (mode === "planner") {
      textContent = stripEmbeddedPlannerFences(String(textContent));
    }
    let filterSuggestion: Record<string, unknown> | null = null;
    let planComplete = false;
    let suggestedTab: string | null = null;
    let fieldSummary: Record<string, unknown> | null = null;
    let pendingApply = false;
    let fieldId: string | null = null;
    let suggestions: string[] = [];

    let accumulatedValues: Record<string, unknown> =
      incomingAccumulated && typeof incomingAccumulated === "object" ? { ...incomingAccumulated } : {};

    const toolCalls = choice?.message?.tool_calls as
      | { function?: { name?: string; arguments?: string } }[]
      | undefined;

    const sugMap = suggestionsForField && typeof suggestionsForField === "object" ? suggestionsForField : {};

    if (mode === "planner" && toolCalls?.length) {
      for (const tc of toolCalls) {
        const name = tc.function?.name;
        const argsRaw = tc.function?.arguments;
        if (!name || !argsRaw) continue;
        try {
          if (name === "record_field_answer") {
            const p = JSON.parse(argsRaw) as { field_id?: string; value?: unknown };
            if (p.field_id && p.value !== undefined) {
              accumulatedValues[p.field_id] = p.value;
            }
          }
        } catch (e) {
          console.error("planner record_field_answer parse error:", e);
        }
      }

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        const argsRaw = tc.function?.arguments;
        if (!name || !argsRaw) continue;
        try {
          if (name === "ask_next_question") {
            const p = JSON.parse(argsRaw) as { question?: string; field_id?: string };
            if (p.question) textContent = p.question;
            if (p.field_id) {
              fieldId = p.field_id;
              const sug = sugMap[p.field_id];
              suggestions = Array.isArray(sug) ? sug.map(String) : [];
            }
          }
        } catch (e) {
          console.error("planner ask_next_question parse error:", e);
        }
      }

      for (const tc of toolCalls) {
        const name = tc.function?.name;
        const argsRaw = tc.function?.arguments;
        if (!name || !argsRaw) continue;
        try {
          if (name === "complete_plan") {
            const p = JSON.parse(argsRaw) as Record<string, unknown>;
            const summary = p.summary;
            if (typeof summary === "string" && summary) textContent = summary;
            planComplete = true;
            pendingApply = true;
            if (typeof p.suggestedTab === "string") suggestedTab = p.suggestedTab;
            if (p.fieldSummary && typeof p.fieldSummary === "object" && p.fieldSummary !== null) {
              fieldSummary = p.fieldSummary as Record<string, unknown>;
              if (Array.isArray(schemaForSelectedFilter)) {
                const schemaIds = new Set(schemaForSelectedFilter.map((s) => s.id));
                for (const [k, v] of Object.entries(fieldSummary)) {
                  if (schemaIds.has(k)) accumulatedValues[k] = v;
                }
              }
            }
            const filterKeys = [
              "industries",
              "companySizes",
              "annualRevenue",
              "countries",
              "citiesOrStates",
              "keywordsInclude",
              "limit",
              "plannerSearchType",
              "realEstateCity",
            ];
            const rest: Record<string, unknown> = {};
            for (const k of filterKeys) {
              if (p[k] !== undefined && p[k] !== null) rest[k] = p[k];
            }
            if (Object.keys(rest).length) filterSuggestion = rest;
          }
        } catch (e) {
          console.error("planner complete_plan parse error:", e);
        }
      }
    } else if (toolCalls?.length) {
      for (const tc of toolCalls) {
        if (tc.function?.name === "apply_filters" && tc.function?.arguments) {
          try {
            filterSuggestion = JSON.parse(tc.function.arguments) as Record<string, unknown>;
          } catch (e) {
            console.error("Failed to parse filter suggestion:", e);
          }
        }
      }
    }

    const sidPlanner = selectedFilterId && String(selectedFilterId).trim() !== ""
      ? selectedFilterId
      : null;

    if (
      mode === "planner" &&
      planComplete &&
      sidPlanner &&
      Array.isArray(schemaForSelectedFilter) &&
      schemaForSelectedFilter.length > 0
    ) {
      const stillMissing = inferNextFieldId(schemaForSelectedFilter, accumulatedValues);
      if (stillMissing) {
        planComplete = false;
        pendingApply = false;
        suggestedTab = null;
        filterSuggestion = null;
        fieldSummary = null;
        textContent = "";
        fieldId = stillMissing;
        const sugInf = sugMap[stillMissing];
        suggestions = Array.isArray(sugInf) ? sugInf.map(String) : [];
      }
    }

    if (
      mode === "planner" &&
      sidPlanner &&
      !planComplete &&
      !fieldId &&
      Array.isArray(schemaForSelectedFilter) &&
      schemaForSelectedFilter.length > 0
    ) {
      const inferred = inferNextFieldId(schemaForSelectedFilter, accumulatedValues);
      if (inferred) {
        fieldId = inferred;
        const sugInf = sugMap[inferred];
        suggestions = Array.isArray(sugInf) ? sugInf.map(String) : [];
      }
    }

    if (
      mode === "planner" &&
      fieldId &&
      Array.isArray(schemaForSelectedFilter) &&
      !String(textContent ?? "").trim()
    ) {
      textContent = shortQuestionForField(fieldId, schemaForSelectedFilter);
    }

    let plannerUiOut: Record<string, unknown> | null = null;
    if (mode === "planner") {
      const ctx = plannerContext ?? "scout-planner-tab";
      const fc = filterCatalog ?? [];
      const sid = selectedFilterId && String(selectedFilterId).trim() !== "" ? selectedFilterId : null;

      if (!sid && fc.length > 0) {
        const ui = buildPickFilterPlannerUi(ctx, fc);
        textContent = "Choose what you want to do below.";
        plannerUiOut = ui;
      } else if (planComplete) {
        const ui = buildReviewPlannerUi(ctx, (fieldSummary ?? {}) as Record<string, unknown>);
        const cleaned = stripEmbeddedPlannerFences(String(textContent ?? ""));
        textContent =
          cleaned.length > 0 && cleaned.length <= 320 ? cleaned : "Review your plan below.";
        plannerUiOut = ui;
      } else if (fieldId && sid) {
        const sug = Array.isArray(sugMap[fieldId]) ? (sugMap[fieldId] as string[]) : [];
        const collectProse = shortQuestionForField(fieldId, schemaForSelectedFilter ?? []);
        const ui = buildCollectPlannerUi(
          ctx,
          fieldId,
          collectProse,
          schemaForSelectedFilter ?? [],
          sug,
        );
        textContent = collectProse;
        plannerUiOut = ui;
      }
    }

    return new Response(
      JSON.stringify({
        content: textContent,
        filters: filterSuggestion,
        planComplete: mode === "planner" ? planComplete : undefined,
        pendingApply: mode === "planner" ? pendingApply : undefined,
        suggestedTab: mode === "planner" ? suggestedTab : undefined,
        fieldSummary: mode === "planner" ? fieldSummary : undefined,
        fieldId: mode === "planner" ? fieldId : undefined,
        suggestions: mode === "planner" ? suggestions : undefined,
        accumulatedValues: mode === "planner" ? accumulatedValues : undefined,
        plannerUi: mode === "planner" ? plannerUiOut : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("planner error:", e);
    return new Response(
      JSON.stringify({ error: "An error occurred processing your request" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
