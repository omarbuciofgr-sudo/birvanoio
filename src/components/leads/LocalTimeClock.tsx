import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { TzSource } from "@/lib/leadTimezone";

interface Props {
  tz: string | null;
  source: TzSource | null;
}

function format(tz: string) {
  try {
    const now = new Date();
    const time = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone: tz,
      hour12: true,
    }).format(now);
    const day = new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      timeZone: tz,
    }).format(now);
    const hour = Number(
      new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now),
    );
    const businessHours = hour >= 9 && hour < 17;
    return { time, day, businessHours };
  } catch {
    return { time: "—", day: "", businessHours: false };
  }
}

export default function LocalTimeClock({ tz, source }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!tz) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="h-3.5 w-3.5" /> Unknown timezone
      </div>
    );
  }
  const { time, day, businessHours } = format(tz);
  const sourceLabel =
    source === "state" ? "US state" :
    source === "phone" ? "phone country code" :
    source === "country" ? "country" : "unknown";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div className="inline-flex items-center gap-1.5 text-xs cursor-help">
          <Clock className={`h-3.5 w-3.5 ${businessHours ? "text-green-600" : "text-muted-foreground"}`} />
          <span className="font-semibold tabular-nums">{time}</span>
          <span className="text-muted-foreground">{day} local</span>
          {businessHours && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-700 dark:text-green-400">
              in hours
            </span>
          )}
        </div>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        <div className="text-xs">
          <div><span className="font-semibold">Timezone:</span> {tz}</div>
          <div className="text-muted-foreground">Detected from {sourceLabel}</div>
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
