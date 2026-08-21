/**
 * Turns owner intel signals (price drop, stale listing, re-listed, fresh) into
 * concrete follow-up tasks on the matching realtor deal. Tasks are inserted as
 * `realtor_deal_events` rows and deduped by their generated key so a repeated
 * signal never creates the same step twice.
 */
import { supabase } from "@/integrations/supabase/client";
import { computeListingIntel, listingIntelKey, type ListingIntel, type ListingIntelInput } from "./realEstateOwnerIntel";

export type IntelTask = {
  /** Stable dedupe key stored in the task notes. */
  key: string;
  title: string;
  kind: string;
  notes: string;
  /** Days from now the step should be worked. */
  dueInDays: number;
};

const KEY_PREFIX = "[intel:";

function tag(key: string) {
  return `${KEY_PREFIX}${key}]`;
}

/** Follow-up steps implied by a listing's current intel. */
export function suggestIntelTasks(intel: ListingIntel, address: string): IntelTask[] {
  const tasks: IntelTask[] = [];
  const where = address || "this listing";

  if (intel.priceDrop && intel.priceDrop > 0) {
    const pct = intel.priceDropPct ? ` (${intel.priceDropPct}%)` : "";
    tasks.push({
      key: `price_drop_${Math.round(intel.priceDrop)}`,
      title: `Call owner about the price drop on ${where}`,
      kind: "call",
      notes: `Asking price dropped $${intel.priceDrop.toLocaleString()}${pct}. Motivation is rising — reach out today with a comp-backed pitch.`,
      dueInDays: 0,
    });
  }

  if (intel.relisted) {
    tasks.push({
      key: "relisted",
      title: `Re-engage the owner — ${where} was re-listed`,
      kind: "call",
      notes: "The listing came back with a reset days-on-market counter, which usually means a failed deal or an expired agreement.",
      dueInDays: 0,
    });
  }

  if (intel.freshness === "stale") {
    tasks.push({
      key: "stale",
      title: `Send a market-update touch for ${where}`,
      kind: "email",
      notes: "On market 60+ days. Share recent comps and days-on-market data, then offer a pricing conversation.",
      dueInDays: 1,
    });
  } else if (intel.freshness === "aging") {
    tasks.push({
      key: "aging",
      title: `Check in on ${where} before it goes stale`,
      kind: "task",
      notes: "Aging listing (30-59 days). A soft check-in now often lands the conversation before the owner cuts price.",
      dueInDays: 3,
    });
  } else if (intel.freshness === "fresh") {
    tasks.push({
      key: "fresh",
      title: `Be first to call on ${where}`,
      kind: "call",
      notes: "Just listed — speed to lead wins FRBO/FSBO conversations.",
      dueInDays: 0,
    });
  }

  return tasks;
}

function normalizeAddress(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

type DealLike = { id: string; property_address: string | null };

/**
 * Matches deals to listings by address, then creates any missing intel task.
 * Returns the number of tasks created.
 */
export async function syncIntelTasksForDeals(
  userId: string,
  deals: DealLike[],
  listings: ListingIntelInput[],
): Promise<number> {
  const withAddress = deals.filter((d) => normalizeAddress(d.property_address));
  if (!withAddress.length) return 0;

  const byAddress = new Map<string, ListingIntelInput>();
  for (const l of listings) {
    const addr = normalizeAddress(l.address ?? null);
    if (addr && !byAddress.has(addr)) byAddress.set(addr, l);
  }

  const pending: { deal_id: string; task: IntelTask }[] = [];
  for (const deal of withAddress) {
    const listing = byAddress.get(normalizeAddress(deal.property_address)) ?? null;
    if (!listing) continue;
    if (!listingIntelKey(listing)) continue;
    const intel = computeListingIntel(listing);
    for (const task of suggestIntelTasks(intel, deal.property_address || "")) {
      pending.push({ deal_id: deal.id, task });
    }
  }
  if (!pending.length) return 0;

  const dealIds = [...new Set(pending.map((p) => p.deal_id))];
  const { data: existing } = await supabase
    .from("realtor_deal_events" as any)
    .select("deal_id, notes")
    .in("deal_id", dealIds);

  const seen = new Set(
    ((existing as unknown as { deal_id: string; notes: string | null }[]) || []).map(
      (e) => `${e.deal_id}::${(e.notes || "").match(/\[intel:[^\]]+\]/)?.[0] ?? ""}`,
    ),
  );

  const rows = pending
    .filter((p) => !seen.has(`${p.deal_id}::${tag(p.task.key)}`))
    .map((p) => ({
      user_id: userId,
      deal_id: p.deal_id,
      kind: p.task.kind,
      title: p.task.title,
      notes: `${p.task.notes} ${tag(p.task.key)}`,
      scheduled_at: new Date(Date.now() + p.task.dueInDays * 86_400_000).toISOString(),
    }));

  if (!rows.length) return 0;
  const { error } = await supabase.from("realtor_deal_events" as any).insert(rows as any);
  if (error) throw error;
  return rows.length;
}

/** Listings seen in the scraper, cached so Deals can match against them. */
const LISTING_CACHE_KEY = "brivano.recent_listings.v1";

export function cacheRecentListings(listings: ListingIntelInput[]) {
  if (typeof window === "undefined" || !listings.length) return;
  try {
    const slim = listings
      .filter((l) => l.address)
      .slice(0, 400)
      .map((l) => ({
        address: l.address,
        price: l.price ?? null,
        days_on_market: l.days_on_market ?? null,
        listing_url: l.listing_url ?? null,
        source_url: l.source_url ?? null,
      }));
    window.localStorage.setItem(LISTING_CACHE_KEY, JSON.stringify(slim));
  } catch {
    /* storage disabled — matching simply finds nothing */
  }
}

export function readRecentListings(): ListingIntelInput[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(LISTING_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? (parsed as ListingIntelInput[]) : [];
  } catch {
    return [];
  }
}
