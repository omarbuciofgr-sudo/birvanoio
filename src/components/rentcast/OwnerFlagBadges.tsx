import { Badge } from "@/components/ui/badge";
import { TrendingDown, Clock, ArrowUpRight } from "lucide-react";
import type { OwnerFlag } from "@/lib/ownerFlags";

const ICON = { price_drop: TrendingDown, listed_30: Clock, above_market: ArrowUpRight } as const;

export function OwnerFlagBadges({ flags, className = "" }: { flags: OwnerFlag[]; className?: string }) {
  if (!flags.length) return null;
  return (
    <div className={`flex flex-wrap gap-1 ${className}`}>
      {flags.map((f) => {
        const Icon = ICON[f.type];
        return (
          <Badge key={f.type} variant="outline" className="gap-1 border-primary/30 bg-primary/5 text-[10px] font-medium">
            <Icon className="h-3 w-3" />
            {f.label}
          </Badge>
        );
      })}
    </div>
  );
}
