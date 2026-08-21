/**
 * Turns owner intel signals (price drop, stale listing, re-listed, fresh) into
 * concrete follow-up tasks on the matching realtor deal. Tasks are inserted as
 * `realtor_deal_events` rows and deduped by their signal key so a repeated
 * signal never creates the same step twice.
 */
import { supabase } from "@/integrations/supabase/client";
import { computeListingIntel, listingIntelKey, type ListingIntel, type ListingIntelInput } from "./realEstateOwnerIntel";
import {
  loadIntelSettings,
  renderScript,
  type IntelSettings,
  type SignalId,
} from "./ownerIntelSettings";

export type IntelTask = {
  /** Stable dedupe key stored on the row. */
  key: string;
  signal: SignalId;
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

/** Follow-up steps implied by a listing's current intel, using the user's scripts. */
export function suggestIntelTasks(
  intel: ListingIntel,
  address: string,
  settings: IntelSettings = loadIntelSettings(),
  ctx: { ownerName?: string | null; agentName?: string | null; price?: string | number | null } = {},
): IntelTask[] {
  const tasks: IntelTask[] = [];
  const merge = {
    address,
    owner_name: ctx.ownerName ?? null,
    agent_name: ctx.agentName ?? null,
    price: ctx.price ?? null,
    price_drop: intel.priceDrop,
    price_drop_pct: intel.priceDropPct,
    days_on_market: intel.daysOnMarket,
  };

  const push = (signal: SignalId, key: string) => {
    const script = settings.signals[signal];
    if (!script?.enabled) return;
    tasks.push({
      key,
      signal,
      kind: script.kind,
      dueInDays: script.dueInDays,
      title: renderScript(script.title, merge),
      notes: renderScript(script.body, merge),
    });
  };

  if (intel.priceDrop && intel.priceDrop > 0) {
    push("price_drop", `price_drop_${Math.round(intel.priceDrop)}`);
  }
  if (intel.relisted) push("relisted", "relisted");

  if (intel.freshness === "stale") push("stale", "stale");
  else if (intel.freshness === "aging") push("aging", "aging");
  else if (intel.freshness === "fresh") push("fresh", "fresh");

  return tasks;
}

function normalizeAddress(v: string | null | undefined) {
  return (v || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

type DealLike = { id: string; property_address: string | null; client_name?: string | null };

/**
 * Matches deals to listings by address, then creates any missing intel task.
 * Returns the number of tasks created.
 */
export async function syncIntelTasksForDeals(
  userId: string,
  deals: DealLike[],
  listings: ListingIntelInput[],
  options: { settings?: IntelSettings; agentName?: string | null } = {},
): Promise<number> {
  const settings = options.settings ?? loadIntelSettings();
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
    const intel = computeListingIntel(listing, undefined, settings);
    const suggested = suggestIntelTasks(intel, deal.property_address || "", settings, {
      ownerName: deal.client_name ?? null,
      agentName: options.agentName ?? null,
      price: listing.price ?? null,
    });
    for (const task of suggested) pending.push({ deal_id: deal.id, task });
  }
  if (!pending.length) return 0;

  const dealIds = [...new Set(pending.map((p) => p.deal_id))];
  const { data: existing } = await supabase
    .from("realtor_deal_events" as any)
    .select("deal_id, notes, signal_key")
    .in("deal_id", dealIds);

  const seen = new Set<string>();
  for (const e of ((existing as unknown as { deal_id: string; notes: string | null; signal_key: string | null }[]) || [])) {
    if (e.signal_key) seen.add(`${e.deal_id}::${tag(e.signal_key)}`);
    const legacy = (e.notes || "").match(/\[intel:[^\]]+\]/)?.[0];
    if (legacy) seen.add(`${e.deal_id}::${legacy}`);
  }

  const rows = pending
    .filter((p) => !seen.has(`${p.deal_id}::${tag(p.task.key)}`))
    .map((p) => ({
      user_id: userId,
      deal_id: p.deal_id,
      kind: p.task.kind,
      title: p.task.title,
      signal_key: p.task.key,
      body: p.task.notes,
      notes: p.task.notes,
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
