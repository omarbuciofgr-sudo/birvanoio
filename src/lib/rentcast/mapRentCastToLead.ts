/**
 * Map RentCast listing rows to CRM `leads` inserts.
 */
import type { RentCastListing } from "@/lib/api/rentcastApi";

export { buildLeadNotes, buildLeadFromRentCast, normalizeAddressKey } from "../../../supabase/functions/_shared/leadMapping";

export function listingExternalLinks(row: RentCastListing): { label: string; url: string }[] {
  const links: { label: string; url: string }[] = [];
  const fromZillow = row.source === "zillow_serpapi";
  if (fromZillow && row.listing_url) {
    // The exact Zillow property the row came from, so the user can verify it directly
    links.push({ label: "View original listing", url: row.listing_url });
  } else if (row.listing_url) {
    links.push({ label: "Live listing", url: row.listing_url });
  }
  const q = encodeURIComponent((row.address || "").trim());
  if (q) {
    if (!fromZillow) {
      links.push({ label: "Search this address", url: `https://www.zillow.com/homes/${q}_rb/` });
    }
    links.push({
      label: "Compare listing",
      url: `https://www.realtor.com/realestateandhomes-search/${q}`,
    });
  }
  return links;
}

export function confidenceBadgeClass(score?: number | null): string {
  const n = Number(score ?? 0);
  if (n >= 90) return "bg-emerald-600 hover:bg-emerald-600";
  if (n >= 70) return "bg-sky-600 hover:bg-sky-600";
  if (n >= 60) return "bg-amber-600 hover:bg-amber-600";
  return "bg-slate-500 hover:bg-slate-500";
}

export function hasContactInfo(row: RentCastListing): boolean {
  return !!(row.owner_phone?.trim() || row.owner_email?.trim());
}
