import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { AI_LIMIT_MESSAGE, getAiAllowance, recordAiMessage, serviceClient } from "../_shared/billing.ts";

const SYSTEM_PROMPT =
  "You write for real estate agents and property managers contacting homeowners who are selling or renting without an agent. Be friendly, short, and helpful, never pushy. Don't make claims about prices or market data that aren't in the provided data. Plain language, no em dashes.";

const TASKS = {
  call_script: "Write a short phone call script the agent can read when calling this owner. Include an opener, 2 or 3 questions, and a polite close.",
  text_message: "Write one text message to this owner. Keep it under 300 characters. Do not include opt-out wording; it is added separately.",
  email: "Write a short email to this owner. First line must be 'Subject: ...', then a blank line, then the body. Under 150 words.",
  talking_points: "Write exactly 3 short conversation openers the agent could use with this owner, as a numbered list. Base them on the property data (price, time on market, price changes, market estimate) when available.",
  reply_suggestion: "The owner sent the message below. Write one suggested reply the agent could send back. Keep it short and respectful. If the owner asks not to be contacted, write a brief polite acknowledgement only.",
  lead_summary: "Summarize this lead in 3 or 4 short sentences: the property, the situation, and a suggested next step.",
  market_report_summary: "Write a short plain-language summary (3 to 5 sentences, no headings or lists) of the property data provided, including how the asking price compares with the estimate and nearby comparables, suitable to share with the owner. Only use the numbers given. If data is missing, say so briefly instead of guessing.",
} as const;

const BodySchema = z.object({
  task: z.enum(Object.keys(TASKS) as [keyof typeof TASKS, ...Array<keyof typeof TASKS>]),
  leadId: z.string().uuid().optional(),
  listingId: z.string().min(1).max(300).optional(),
  ownerMessage: z.string().max(4000).optional(),
  tone: z.enum(["friendly", "direct", "brief"]).optional(),
});

const TONES = {
  friendly: "Tone: warm and friendly.",
  direct: "Tone: direct and to the point, still polite.",
  brief: "Tone: as brief as possible. Keep it very short.",
} as const;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Only these listing fields are ever sent to the AI. No phone numbers or emails.
const LISTING_FIELDS: Record<string, string[]> = {
  listing_type: ["listing_kind", "listing_type", "classification"],
  price: ["price", "list_price", "rent"],
  days_listed: ["days_on_market", "days_listed", "dom"],
  price_history: ["price_history", "priceHistory"],
  estimated_value: ["estimated_value", "zestimate", "value_estimate", "avm_value"],
  estimated_rent: ["estimated_rent", "rent_estimate", "rent_zestimate"],
  bedrooms: ["bedrooms", "beds"],
  bathrooms: ["bathrooms", "baths"],
  square_feet: ["square_footage", "sqft", "living_area"],
  property_type: ["property_type", "home_type"],
};

const stripContact = (s: string) =>
  s
    .replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, "[removed]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, (m) => (m.replace(/\D/g, "").length >= 10 ? "[removed]" : m));

function pickListing(data: Record<string, unknown> | null) {
  const out: Record<string, unknown> = {};
  if (!data) return out;
  for (const [label, keys] of Object.entries(LISTING_FIELDS)) {
    for (const k of keys) {
      const v = data[k];
      if (v !== undefined && v !== null && v !== "") { out[label] = v; break; }
    }
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Please sign in to use AI writing." }, 401);

  const userClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: claims, error: authErr } = await userClient.auth.getClaims(authHeader.replace("Bearer ", ""));
  const userId = claims?.claims?.sub as string | undefined;
  if (authErr || !userId) return json({ error: "Please sign in to use AI writing." }, 401);

  let parsed;
  try {
    parsed = BodySchema.safeParse(await req.json());
  } catch {
    return json({ error: "Something was wrong with that request. Please try again." }, 400);
  }
  if (!parsed.success) return json({ error: "Something was wrong with that request. Please try again." }, 400);
  const { task, leadId, listingId, ownerMessage, tone } = parsed.data;
  if (!leadId && !listingId) return json({ error: "Something was wrong with that request. Please try again." }, 400);
  if (task === "reply_suggestion" && !ownerMessage?.trim()) {
    return json({ error: "Paste the owner's message first." }, 400);
  }

  const admin = serviceClient();
  const log = (fields: Record<string, unknown>) =>
    admin.from("ai_usage_logs").insert({ user_id: userId, task, lead_id: leadId ?? null, ...fields }).then(() => {}, () => {});

  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    console.error("ANTHROPIC_API_KEY not configured");
    return json({ error: "AI writing is temporarily unavailable. Please try again later." }, 503);
  }

  try {
    const allowance = await getAiAllowance(userId);
    if (allowance.used >= allowance.limit) {
      return json({ error: AI_LIMIT_MESSAGE, code: "ai_limit", used: allowance.used, limit: allowance.limit }, 429);
    }

    // Access is checked with the user's own permissions.
    let lead: { business_name: string; contact_name: string | null; city: string | null; state: string | null; zip_code: string | null; notes: string | null } | null = null;
    let listingData: Record<string, unknown> | null = null;
    let listingKind: string | null = null;
    if (leadId) {
      const { data } = await userClient.from("leads")
        .select("business_name, contact_name, city, state, zip_code, notes").eq("id", leadId).maybeSingle();
      lead = data;
    } else {
      const { data } = await userClient.from("owner_search_results")
        .select("listing_data, listing_kind").eq("external_id", listingId!).maybeSingle();
      if (data) {
        const l = data.listing_data as Record<string, any>;
        listingData = l; listingKind = data.listing_kind;
        lead = { business_name: String(l.address ?? ""), contact_name: l.owner_name ?? null, city: l.city ?? null, state: l.state ?? null, zip_code: l.zip_code ?? null, notes: null };
      }
    }
    if (!lead) return json({ error: "We couldn't find that owner." }, 404);

    const addrKey = lead.business_name.trim().toLowerCase().replace(/\s+/g, " ");
    const [{ data: profile }, { data: listingRow }, { data: modelRow }, { data: estRows }] = await Promise.all([
      admin.from("profiles").select("first_name, last_name, company_name").eq("user_id", userId).maybeSingle(),
      listingData ? Promise.resolve({ data: { listing_data: listingData, listing_kind: listingKind } }) :
        admin.from("owner_search_results").select("listing_data, listing_kind")
          .eq("user_id", userId).ilike("listing_data->>address", lead.business_name).limit(1).maybeSingle(),
      admin.from("ai_settings").select("setting_value").eq("setting_key", "claude_model").maybeSingle(),
      admin.from("property_estimates").select("kind, estimate, range_low, range_high, days_on_market, price_history, comparables").eq("address_key", addrKey),
    ]);
    const model = modelRow?.setting_value || "claude-sonnet-4-5";

    const listing = pickListing((listingRow?.listing_data as Record<string, unknown>) ?? null);
    if (!listing.listing_type && listingRow?.listing_kind) listing.listing_type = listingRow.listing_kind;
    const lt = String(listing.listing_type ?? lead.notes ?? "").toLowerCase();
    const situation = /frbo|rent/.test(lt) ? "renting without an agent" : /fsbo|sale|sell/.test(lt) ? "selling without an agent" : "unknown";
    const est = (estRows ?? []).find((e: any) => e.kind === (situation.startsWith("renting") ? "rental" : "sale")) ?? (estRows ?? [])[0];
    if (est) {
      if (est.estimate != null) listing[situation.startsWith("renting") ? "estimated_rent" : "estimated_value"] = est.estimate;
      if (Array.isArray(est.price_history) && est.price_history.length && !listing.price_history) listing.price_history = est.price_history;
      if (est.days_on_market != null && listing.days_listed == null) listing.days_listed = est.days_on_market;
      if (Array.isArray(est.comparables) && est.comparables.length) listing.nearby_comparables = est.comparables;
    }

    const context = {
      property_address: [lead.business_name, lead.city, lead.state, lead.zip_code].filter(Boolean).join(", "),
      owner_situation: situation,
      owner_name: lead.contact_name || null,
      listing: listing,
      lead_notes: lead.notes ? stripContact(lead.notes).slice(0, 1500) : null,
      agent_name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || null,
      agent_brokerage: profile?.company_name || null,
    };

    let userContent = `${TASKS[task]}${tone ? ` ${TONES[tone]}` : ""}\n\nData (use only this):\n${JSON.stringify(context, null, 2)}`;
    if (task === "reply_suggestion") userContent += `\n\nOwner's message:\n${stripContact(ownerMessage!)}`;
    userContent += "\n\nReturn only the finished text, no preamble.";

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "x-api-key": apiKey, "anthropic-version": "2023-06-01", "content-type": "application/json" },
      body: JSON.stringify({ model, max_tokens: 1024, system: SYSTEM_PROMPT, messages: [{ role: "user", content: userContent }] }),
    });

    if (!res.ok) {
      const detail = await res.text();
      console.error("Anthropic error", res.status, detail.slice(0, 500));
      await log({ model, success: false, error_code: `http_${res.status}` });
      const msg = res.status === 429 || res.status === 529
        ? "The AI is busy right now. Please try again in a minute."
        : "AI writing is temporarily unavailable. Please try again later.";
      return json({ error: msg }, 502);
    }

    const data = await res.json();
    const text = (data.content ?? []).filter((c: any) => c.type === "text").map((c: any) => c.text).join("").replace(/\u2014/g, ", ").trim();
    await log({ model, input_tokens: data.usage?.input_tokens ?? 0, output_tokens: data.usage?.output_tokens ?? 0, success: true });

    const usage = await recordAiMessage(userId);
    return json({ text, task, ai_usage: { used: usage.used, limit: usage.limit } });
  } catch (e) {
    console.error("claude-ai failure", e);
    await log({ success: false, error_code: "exception" });
    return json({ error: "Something went wrong writing that. Please try again." }, 500);
  }
});
