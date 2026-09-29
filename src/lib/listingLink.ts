import type { RentCastListing } from "@/lib/api/rentcastApi";

/** Best link to the real listing: the original listing page, the Zillow page, or a Zillow search for the address. */
export function listingLink(r: Pick<RentCastListing, "listing_url" | "zpid" | "address">): { url: string; label: string; exact: boolean } | null {
  const u = r.listing_url?.trim();
  if (u && /^https?:\/\//i.test(u)) return { url: u, label: "View listing", exact: true };
  if (r.zpid) return { url: `https://www.zillow.com/homedetails/${encodeURIComponent(r.zpid)}_zpid/`, label: "View listing", exact: true };
  const a = r.address?.trim();
  if (a) return { url: `https://www.zillow.com/homes/${encodeURIComponent(a)}_rb/`, label: "Find listing", exact: false };
  return null;
}
