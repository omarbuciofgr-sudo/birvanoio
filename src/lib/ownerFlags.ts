import { supabase } from "@/integrations/supabase/client";
import type { RentCastListing } from "@/lib/api/rentcastApi";

export type PropertyEstimate = {
  address_key: string;
  kind: "sale" | "rental";
  estimate: number | null;
  range_low: number | null;
  range_high: number | null;
  listed_date: string | null;
  days_on_market: number | null;
  price_history: { date: string; price: number | null; event: string }[];
  photos: string[];
  fetched_at: string;
};

export type OwnerFlag =
  | { type: "price_drop"; label: string; amount: number; date: string }
  | { type: "listed_30"; label: string; days: number }
  | { type: "above_market"; label: string; pct: number };

export const addressKey = (a?: string | null) => (a || "").trim().toLowerCase().replace(/\s+/g, " ");
export const listingKind = (r: RentCastListing): "sale" | "rental" => (r.listing_kind === "sale" ? "sale" : "rental");

const money = (n: number) => `$${Math.round(n).toLocaleString("en-US")}`;

export function daysListed(r: RentCastListing, est?: PropertyEstimate | null): number | null {
  if (r.days_on_market != null) return r.days_on_market;
  if (est?.days_on_market != null) return est.days_on_market;
  const d = r.listed_date || est?.listed_date;
  if (!d) return null;
  const t = Date.parse(d);
  return Number.isFinite(t) ? Math.max(0, Math.floor((Date.now() - t) / 864e5)) : null;
}

/** Most recent price reduction from price history, if any. */
export function latestPriceDrop(est?: PropertyEstimate | null) {
  const h = (est?.price_history ?? []).filter((p) => p.price != null);
  for (let i = h.length - 1; i > 0; i--) {
    const prev = h[i - 1].price!, cur = h[i].price!;
    if (cur < prev) return { amount: prev - cur, date: h[i].date };
  }
  return null;
}

export function marketComparison(r: RentCastListing, est?: PropertyEstimate | null) {
  if (!est?.estimate || !r.price) return null;
  const pct = ((r.price - est.estimate) / est.estimate) * 100;
  return { pct, asking: r.price, estimate: est.estimate };
}

export function computeFlags(r: RentCastListing, est?: PropertyEstimate | null): OwnerFlag[] {
  const flags: OwnerFlag[] = [];
  const drop = latestPriceDrop(est);
  if (drop) {
    const when = new Date(drop.date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
    flags.push({ type: "price_drop", label: `Price dropped ${money(drop.amount)} on ${when}`, ...drop });
  }
  const days = daysListed(r, est);
  if (days != null && days >= 30) flags.push({ type: "listed_30", label: "Listed 30+ days", days });
  const cmp = marketComparison(r, est);
  if (cmp && cmp.pct > 5) flags.push({ type: "above_market", label: "Priced above market", pct: cmp.pct });
  return flags;
}

/** Reads estimates already cached on the server (never calls the data provider). */
export async function loadCachedEstimates(rows: RentCastListing[]): Promise<Map<string, PropertyEstimate>> {
  const items = rows.filter((r) => r.address).slice(0, 200).map((r) => ({ address: r.address!, kind: listingKind(r) }));
  const out = new Map<string, PropertyEstimate>();
  if (!items.length) return out;
  const { data } = await supabase.functions.invoke("property-estimate", { body: { mode: "cached", items } });
  for (const e of (data?.estimates ?? []) as PropertyEstimate[]) out.set(`${e.address_key}|${e.kind}`, e);
  return out;
}

export const estimateFor = (m: Map<string, PropertyEstimate>, r: RentCastListing) =>
  m.get(`${addressKey(r.address)}|${listingKind(r)}`) ?? null;

export const ownerRef = (r: RentCastListing) => r.rentcast_id || addressKey(r.address);
