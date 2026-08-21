/**
 * Owner intel for FRBO / FSBO listings.
 *
 * Scraped listing feeds rarely expose a price history, so we keep a local
 * snapshot per listing URL. Every time a listing is seen we record its price
 * and days-on-market; comparing against the previous snapshot yields price
 * drops and re-listed flags that the raw feed does not provide.
 */

const STORE_KEY = "brivano.listing_intel_snapshots.v1";
const MAX_SNAPSHOTS = 4000;

export type ListingSnapshot = {
  /** Numeric price at the time of the observation. */
  price: number | null;
  /** Days on market at the time of the observation. */
  dom: number | null;
  /** ISO timestamp of the observation. */
  seen: string;
};

export type ListingIntelInput = {
  listing_url?: string | null;
  source_url?: string | null;
  address?: string | null;
  price?: string | number | null;
  days_on_market?: string | number | null;
};

export type ListingIntel = {
  /** Days on market (parsed), when the source provides it. */
  daysOnMarket: number | null;
  /** "fresh" | "active" | "aging" | "stale" */
  freshness: "fresh" | "active" | "aging" | "stale" | null;
  /** Absolute price drop in dollars since the first snapshot we hold. */
  priceDrop: number | null;
  /** Percentage drop since the first snapshot we hold. */
  priceDropPct: number | null;
  /** Listing reappeared with a reset days-on-market counter. */
  relisted: boolean;
  /** 0-100 opportunity score — higher means call first. */
  score: number;
  /** Short human reasons behind the score. */
  reasons: string[];
};

export function listingIntelKey(listing: ListingIntelInput): string | null {
  const url = (listing.listing_url || listing.source_url || "").trim().toLowerCase();
  if (url) return url.replace(/[?#].*$/, "");
  const addr = (listing.address || "").trim().toLowerCase();
  return addr || null;
}

export function parsePriceValue(price: string | number | null | undefined): number | null {
  if (typeof price === "number") return Number.isFinite(price) && price > 0 ? price : null;
  if (!price) return null;
  const digits = String(price).replace(/[^0-9.]/g, "");
  const n = Number.parseFloat(digits);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function parseDom(dom: string | number | null | undefined): number | null {
  if (typeof dom === "number") return Number.isFinite(dom) ? dom : null;
  if (!dom) return null;
  const n = Number.parseInt(String(dom).replace(/[^0-9]/g, ""), 10);
  return Number.isFinite(n) ? n : null;
}

type SnapshotStore = Record<string, ListingSnapshot[]>;

function readStore(): SnapshotStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? (parsed as SnapshotStore) : {};
  } catch {
    return {};
  }
}

function writeStore(store: SnapshotStore) {
  if (typeof window === "undefined") return;
  try {
    const keys = Object.keys(store);
    if (keys.length > MAX_SNAPSHOTS) {
      // Drop the oldest half so the store never grows without bound.
      keys
        .sort((a, b) => ((store[a][store[a].length - 1]?.seen) || "").localeCompare((store[b][store[b].length - 1]?.seen) || ""))
        .slice(0, keys.length - MAX_SNAPSHOTS / 2)
        .forEach((k) => delete store[k]);
    }
    window.localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full / disabled — intel degrades to source fields only */
  }
}

/** Record the current state of a batch of listings and return the updated store. */
export function recordListingSnapshots(listings: ListingIntelInput[]): SnapshotStore {
  const store = readStore();
  const now = new Date().toISOString();
  let changed = false;

  for (const listing of listings) {
    const key = listingIntelKey(listing);
    if (!key) continue;
    const price = parsePriceValue(listing.price);
    const dom = parseDom(listing.days_on_market);
    if (price === null && dom === null) continue;

    const history = store[key] || [];
    const last = history[history.length - 1];
    if (last && last.price === price && last.dom === dom) continue;
    history.push({ price, dom, seen: now });
    store[key] = history.slice(-6);
    changed = true;
  }

  if (changed) writeStore(store);
  return store;
}

export type IntelThresholds = {
  freshThresholdDays: number;
  agingThresholdDays: number;
  staleThresholdDays: number;
  relistDomDropDays: number;
  priceDropWindowDays: number;
  priceDropMinPct: number;
};

const DEFAULT_THRESHOLDS: IntelThresholds = {
  freshThresholdDays: 7,
  agingThresholdDays: 30,
  staleThresholdDays: 60,
  relistDomDropDays: 7,
  priceDropWindowDays: 30,
  priceDropMinPct: 1,
};

function freshnessFor(dom: number | null, t: IntelThresholds): ListingIntel["freshness"] {
  if (dom === null) return null;
  if (dom <= t.freshThresholdDays) return "fresh";
  if (dom < t.agingThresholdDays) return "active";
  if (dom < t.staleThresholdDays) return "aging";
  return "stale";
}

/** Compute owner intel for one listing against the local snapshot history. */
export function computeListingIntel(
  listing: ListingIntelInput,
  store: SnapshotStore = readStore(),
  thresholds: Partial<IntelThresholds> = {},
): ListingIntel {
  const t = { ...DEFAULT_THRESHOLDS, ...thresholds };
  const key = listingIntelKey(listing);
  const history = (key && store[key]) || [];
  const dom = parseDom(listing.days_on_market);
  const price = parsePriceValue(listing.price);

  let priceDrop: number | null = null;
  let priceDropPct: number | null = null;
  const windowStart = Date.now() - t.priceDropWindowDays * 86_400_000;
  const priced = history.filter(
    (h) => h.price !== null && new Date(h.seen).getTime() >= windowStart,
  );
  const firstPrice = priced[0]?.price ?? null;
  if (price !== null && firstPrice !== null && firstPrice > price) {
    const pct = Math.round(((firstPrice - price) / firstPrice) * 1000) / 10;
    if (pct >= t.priceDropMinPct) {
      priceDrop = Math.round(firstPrice - price);
      priceDropPct = pct;
    }
  }

  // Re-listed: days-on-market dropped meaningfully versus a previous sighting.
  const domHistory = history.filter((h) => h.dom !== null).map((h) => h.dom as number);
  const maxPrevDom = domHistory.length > 1 ? Math.max(...domHistory.slice(0, -1)) : null;
  const relisted = dom !== null && maxPrevDom !== null && maxPrevDom - dom >= t.relistDomDropDays;

  const freshness = freshnessFor(dom, t);
  const reasons: string[] = [];
  let score = 40;

  if (freshness === "stale") {
    score += 25;
    reasons.push(`On market ${t.staleThresholdDays}+ days — owner likely motivated`);
  } else if (freshness === "aging") {
    score += 15;
    reasons.push(`Aging listing (${t.agingThresholdDays}-${t.staleThresholdDays - 1} days)`);
  } else if (freshness === "fresh") {
    score += 10;
    reasons.push("Just listed — be first to call");
  }

  if (priceDropPct !== null) {
    score += priceDropPct >= 5 ? 25 : 15;
    reasons.push(`Price cut ${priceDropPct}% since first seen`);
  }
  if (relisted) {
    score += 10;
    reasons.push("Re-listed after coming off market");
  }

  return {
    daysOnMarket: dom,
    freshness,
    priceDrop,
    priceDropPct,
    relisted,
    score: Math.max(0, Math.min(100, score)),
    reasons,
  };
}


export function readSnapshotStore(): SnapshotStore {
  return readStore();
}

export const FRESHNESS_LABEL: Record<NonNullable<ListingIntel["freshness"]>, string> = {
  fresh: "New",
  active: "Active",
  aging: "Aging",
  stale: "Stale",
};
