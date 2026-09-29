import { ExternalLink } from "lucide-react";
import { listingExternalLinks } from "@/lib/rentcast/mapRentCastToLead";
import type { RentCastListing } from "@/lib/api/rentcastApi";

/** The original always-visible listing links; clicks never open the owner page. */
export function ListingLinkButton({ row, className = "" }: { row: RentCastListing; className?: string }) {
  const links = listingExternalLinks(row);
  if (!links.length) return null;
  return (
    <div className={`flex flex-wrap gap-x-3 gap-y-1 ${className}`}>
      {links.map((link) => (
        <a
          key={link.label}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          {link.label} <ExternalLink className="h-3 w-3" />
        </a>
      ))}
    </div>
  );
}
