// One provider fetch per city + type per day, shared across all users (morning alerts and Brivano Assistant).
// deno-lint-ignore no-explicit-any
export type Listing = Record<string, any>;
// deno-lint-ignore no-explicit-any
type Db = any;

export const listingExternalId = (r: Listing) =>
  String(r.rentcast_id || (r.address || "").trim().toLowerCase().replace(/\s+/g, " "));
export const listingScore = (r: Listing) => Number(r.confidence_score ?? r.fsbo_confidence ?? 0);

export function createCitySearch(db: Db) {
  const scraperBase = (Deno.env.get("SCRAPER_BACKEND_URL") ?? "").replace(/\/+$/, "");
  const mem = new Map<string, Listing[]>();
  const today = new Date().toISOString().slice(0, 10);
  return async function cityListings(location: string, type: "sale" | "rental"): Promise<Listing[] | null> {
    const loc = location.trim().toLowerCase();
    const key = `${loc}|${type}`;
    if (mem.has(key)) return mem.get(key)!;
    const { data: cached } = await db.from("city_search_cache").select("listings")
      .eq("location_key", loc).eq("listing_type", type).eq("fetched_on", today).maybeSingle();
    if (cached) { mem.set(key, cached.listings as Listing[]); return cached.listings as Listing[]; }
    if (!scraperBase) return null;
    try {
      const res = await fetch(`${scraperBase}/api/zillow/search`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location, type, save: true }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !Array.isArray(body?.listings)) { console.error("provider fetch failed", location, type, res.status); return null; }
      const rows = body.listings.map((r: Listing) => ({ ...r, listing_kind: r.listing_kind || type }));
      await db.from("city_search_cache").upsert({ location_key: loc, listing_type: type, fetched_on: today, listings: rows });
      mem.set(key, rows);
      return rows;
    } catch (e) {
      console.error("provider fetch error", location, type, e);
      return null;
    }
  };
}
