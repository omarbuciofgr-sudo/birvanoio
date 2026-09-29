import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { z } from "npm:zod@3";
import { serviceClient } from "../_shared/billing.ts";

const TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RC = "https://api.rentcast.io/v1";

const Item = z.object({ address: z.string().min(5).max(300), kind: z.enum(["sale", "rental"]) });
const Body = z.object({
  mode: z.enum(["fetch", "cached"]).default("fetch"),
  items: z.array(Item).min(1).max(200),
  withComps: z.boolean().optional(),
});

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
export const addressKey = (a: string) => a.trim().toLowerCase().replace(/\s+/g, " ");

type Estimate = {
  address_key: string; kind: "sale" | "rental"; estimate: number | null; range_low: number | null; range_high: number | null;
  listed_date: string | null; days_on_market: number | null; price_history: { date: string; price: number | null; event: string }[];
  photos: string[]; fetched_at: string;
  comparables: { address: string; price: number | null; bedrooms: number | null; bathrooms: number | null; square_footage: number | null; distance: number | null }[];
};

async function rc(path: string, key: string) {
  const res = await fetch(`${RC}${path}`, { headers: { "X-Api-Key": key, Accept: "application/json" } });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`rentcast ${res.status}`);
  return res.json();
}

async function fetchEstimate(address: string, kind: "sale" | "rental", key: string): Promise<Estimate> {
  const q = encodeURIComponent(address);
  const [avm, listings] = await Promise.all([
    rc(kind === "sale" ? `/avm/value?address=${q}` : `/avm/rent/long-term?address=${q}`, key),
    rc(kind === "sale" ? `/listings/sale?address=${q}&limit=1` : `/listings/rental/long-term?address=${q}&limit=1`, key).catch(() => null),
  ]);
  const listing = Array.isArray(listings) ? listings[0] : null;
  const history = listing?.history && typeof listing.history === "object"
    ? Object.entries(listing.history as Record<string, any>).map(([date, h]) => ({
        date: String(h?.listedDate ?? date).slice(0, 10), price: h?.price ?? null, event: String(h?.event ?? "Listing"),
      })).sort((a, b) => a.date.localeCompare(b.date))
    : [];
  return {
    address_key: addressKey(address), kind,
    estimate: (kind === "sale" ? avm?.price : avm?.rent) ?? null,
    range_low: (kind === "sale" ? avm?.priceRangeLow : avm?.rentRangeLow) ?? null,
    range_high: (kind === "sale" ? avm?.priceRangeHigh : avm?.rentRangeHigh) ?? null,
    listed_date: listing?.listedDate ? String(listing.listedDate).slice(0, 10) : null,
    days_on_market: listing?.daysOnMarket ?? null,
    price_history: history,
    photos: [],
    comparables: (Array.isArray(avm?.comparables) ? avm.comparables : [])
      .filter((c: any) => c?.formattedAddress && c?.price)
      .sort((a: any, b: any) => (a.distance ?? 99) - (b.distance ?? 99))
      .slice(0, 5)
      .map((c: any) => ({
        address: String(c.formattedAddress), price: c.price ?? null, bedrooms: c.bedrooms ?? null,
        bathrooms: c.bathrooms ?? null, square_footage: c.squareFootage ?? null,
        distance: typeof c.distance === "number" ? Math.round(c.distance * 100) / 100 : null,
      })),
    fetched_at: new Date().toISOString(),
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const auth = req.headers.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return json({ error: "Please sign in." }, 401);
  const uc = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: claims } = await uc.auth.getClaims(auth.replace("Bearer ", ""));
  if (!claims?.claims?.sub) return json({ error: "Please sign in." }, 401);

  let parsed;
  try { parsed = Body.safeParse(await req.json()); } catch { return json({ error: "Invalid request." }, 400); }
  if (!parsed.success) return json({ error: "Invalid request." }, 400);
  const { mode, items, withComps } = parsed.data;
  const db = serviceClient();

  const keys = [...new Set(items.map((i) => addressKey(i.address)))];
  const cutoff = new Date(Date.now() - TTL_MS).toISOString();
  const { data: cached } = await db.from("property_estimates").select("*").in("address_key", keys).gte("fetched_at", cutoff);
  const byKey = new Map((cached ?? []).map((c: Estimate) => [`${c.address_key}|${c.kind}`, c]));

  if (mode === "cached") return json({ estimates: [...byKey.values()] });

  // Fetch mode: one property at a time (the detail page).
  const item = items[0];
  const hit = byKey.get(`${addressKey(item.address)}|${item.kind}`);
  // Older cached rows have no comparables; refresh them when a report needs comps.
  if (hit && !(withComps && hit.comparables == null)) return json({ estimate: hit, cached: true });

  const key = Deno.env.get("RENTCAST_API_KEY");
  if (!key) return json({ estimate: null, unavailable: true });
  try {
    const est = await fetchEstimate(item.address, item.kind, key);
    await db.from("property_estimates").upsert(est);
    return json({ estimate: est, cached: false });
  } catch (e) {
    console.error("estimate fetch failed", e);
    return json({ estimate: null, error: "Market estimate isn't available right now." });
  }
});
