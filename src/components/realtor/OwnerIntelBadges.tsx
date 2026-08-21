import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { FRESHNESS_LABEL, type ListingIntel } from "@/lib/realEstateOwnerIntel";
import { ArrowDownRight, Flame, RotateCcw, Timer } from "lucide-react";

const FRESHNESS_CLASS: Record<string, string> = {
  fresh: "text-emerald-700 dark:text-emerald-400 border-emerald-500/50",
  active: "text-muted-foreground border-border",
  aging: "text-amber-700 dark:text-amber-400 border-amber-500/50",
  stale: "text-orange-700 dark:text-orange-400 border-orange-500/50",
};

/** Days-on-market, price-drop and re-listed signals for an FRBO/FSBO listing. */
export function OwnerIntelBadges({ intel }: { intel: ListingIntel }) {
  const hasSignal = intel.freshness || intel.priceDropPct !== null || intel.relisted;
  if (!hasSignal) return null;

  const summary = intel.reasons.join(" · ") || "Owner intel";

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="flex flex-wrap items-center gap-1.5">
            {intel.freshness && (
              <Badge
                variant="outline"
                className={`text-[10px] h-4 font-normal gap-1 ${FRESHNESS_CLASS[intel.freshness]}`}
              >
                <Timer className="h-2.5 w-2.5" />
                {FRESHNESS_LABEL[intel.freshness]}
                {intel.daysOnMarket !== null ? ` · ${intel.daysOnMarket}d` : ""}
              </Badge>
            )}
            {intel.priceDropPct !== null && (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-0 text-[10px] h-4 font-normal gap-1">
                <ArrowDownRight className="h-2.5 w-2.5" />
                Price cut {intel.priceDropPct}%
              </Badge>
            )}
            {intel.relisted && (
              <Badge variant="outline" className="text-[10px] h-4 font-normal gap-1 border-violet-500/50 text-violet-700 dark:text-violet-400">
                <RotateCcw className="h-2.5 w-2.5" />
                Re-listed
              </Badge>
            )}
            {intel.score >= 70 && (
              <Badge className="bg-primary/10 text-primary border-0 text-[10px] h-4 font-normal gap-1">
                <Flame className="h-2.5 w-2.5" />
                Priority {intel.score}
              </Badge>
            )}
          </span>
        </TooltipTrigger>
        <TooltipContent className="max-w-xs text-xs">{summary}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default OwnerIntelBadges;
