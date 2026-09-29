import { ExternalLink } from "lucide-react";
import { listingLink } from "@/lib/listingLink";
import type { RentCastListing } from "@/lib/api/rentcastApi";

/** Small "View listing" link that never triggers the row's own click. */
export function ListingLinkButton({ row, className = "" }: { row: RentCastListing; className?: string }) {
  const link = listingLink(row);
  if (!link) return null;
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
      title={link.exact ? "Open the original listing" : "No direct listing link from the data source; searches Zillow for this address"}
      className={`inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline ${className}`}
    >
      <ExternalLink className="h-3 w-3" /> {link.label}
    </a>
  );
}
