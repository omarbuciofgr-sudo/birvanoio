import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Phone } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";

type Range = 7 | 30 | 90;

interface CallRow {
  status: string;
  started_at: string | null;
  created_at: string;
  duration_seconds: number | null;
}

function formatHour(h: number) {
  const suffix = h < 12 ? "am" : "pm";
  const disp = h % 12 === 0 ? 12 : h % 12;
  return `${disp}${suffix}`;
}

export default function CallHourWidget() {
  const [range, setRange] = useState<Range>(30);
  const [rows, setRows] = useState<CallRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - range);
      const { data, error } = await supabase
        .from("voice_agent_calls")
        .select("status,started_at,created_at,duration_seconds")
        .gte("created_at", since.toISOString());
      if (!alive) return;
      if (error) setRows([]);
      else setRows((data ?? []) as CallRow[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range]);

  const { chart, bestHour, connectRate, totalCalls, avgDuration } = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: formatHour(h),
      calls: 0,
      connected: 0,
      attempts: 0,
    }));
    let totalConnected = 0;
    let totalAttempts = 0;
    let durationSum = 0;
    let durationCount = 0;

    for (const r of rows) {
      const dt = new Date(r.started_at ?? r.created_at);
      const h = dt.getHours();
      const b = buckets[h];
      b.calls += 1;
      if (r.status === "completed" || r.status === "no_answer" || r.status === "failed") {
        b.attempts += 1;
        totalAttempts += 1;
        if (r.status === "completed") {
          b.connected += 1;
          totalConnected += 1;
        }
      }
      if (typeof r.duration_seconds === "number" && r.duration_seconds > 0) {
        durationSum += r.duration_seconds;
        durationCount += 1;
      }
    }

    const chart = buckets.map((b) => ({
      label: b.label,
      calls: b.calls,
      connectRate: b.attempts >= 1 ? Math.round((b.connected / b.attempts) * 100) : 0,
    }));

    // Best hour: highest connect rate with at least 3 attempts
    let best: { hour: number; rate: number } | null = null;
    for (const b of buckets) {
      if (b.attempts >= 3) {
        const rate = b.connected / b.attempts;
        if (!best || rate > best.rate) best = { hour: b.hour, rate };
      }
    }

    return {
      chart,
      bestHour: best ? `${formatHour(best.hour)} (${Math.round(best.rate * 100)}%)` : "—",
      connectRate: totalAttempts > 0 ? `${Math.round((totalConnected / totalAttempts) * 100)}%` : "—",
      totalCalls: rows.length,
      avgDuration: durationCount > 0 ? `${Math.round(durationSum / durationCount)}s` : "—",
    };
  }, [rows]);

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2 px-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-blue-500/10 flex items-center justify-center">
              <Phone className="h-3.5 w-3.5 text-blue-500" />
            </div>
            <CardTitle className="text-sm font-medium">Call Performance by Hour</CardTitle>
            <Badge variant="secondary" className="text-[10px] h-5 font-normal">Local time</Badge>
          </div>
          <div className="flex items-center gap-1">
            {([7, 30, 90] as Range[]).map((r) => (
              <Button
                key={r}
                variant={range === r ? "secondary" : "ghost"}
                size="sm"
                className="h-6 px-2 text-[10px]"
                onClick={() => setRange(r)}
              >
                {r}d
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-4">
        <div className="grid grid-cols-4 gap-2 mb-3">
          <Stat label="Best hour" value={bestHour} />
          <Stat label="Connect rate" value={connectRate} />
          <Stat label="Total calls" value={String(totalCalls)} />
          <Stat label="Avg duration" value={avgDuration} />
        </div>
        <ResponsiveContainer width="100%" height={200}>
          <ComposedChart data={chart} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} />
            <XAxis
              dataKey="label"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              interval={2}
            />
            <YAxis
              yAxisId="left"
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              domain={[0, 100]}
              tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
              axisLine={false}
              tickLine={false}
              unit="%"
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
                fontSize: "11px",
              }}
              formatter={(value: number, name: string) =>
                name === "connectRate" ? [`${value}%`, "Connect rate"] : [value, "Calls"]
              }
            />
            <Bar yAxisId="left" dataKey="calls" fill="hsl(210 100% 50%)" radius={[3, 3, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="connectRate"
              stroke="hsl(145 70% 45%)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        {!loading && rows.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center mt-2">
            No calls in this window yet. Start a Voice Agent campaign to populate this chart.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/40 bg-muted/20 px-2 py-1.5">
      <p className="text-[9px] uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="text-sm font-semibold tabular-nums truncate">{value}</p>
    </div>
  );
}
