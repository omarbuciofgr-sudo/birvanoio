import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mail } from "lucide-react";
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

interface EmailRow {
  lead_id: string;
  direction: string | null;
  created_at: string;
}

function formatHour(h: number) {
  const suffix = h < 12 ? "am" : "pm";
  const disp = h % 12 === 0 ? 12 : h % 12;
  return `${disp}${suffix}`;
}

const REPLY_WINDOW_MS = 48 * 60 * 60 * 1000;

export default function EmailHourWidget() {
  const [range, setRange] = useState<Range>(30);
  const [rows, setRows] = useState<EmailRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      const since = new Date();
      since.setDate(since.getDate() - range);
      const { data, error } = await supabase
        .from("conversation_logs")
        .select("lead_id,direction,created_at")
        .eq("type", "email")
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });
      if (!alive) return;
      if (error) setRows([]);
      else setRows((data ?? []) as EmailRow[]);
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [range]);

  const { chart, bestHour, replyRate, totalEmails } = useMemo(() => {
    const buckets = Array.from({ length: 24 }, (_, h) => ({
      hour: h,
      label: formatHour(h),
      sent: 0,
      replied: 0,
    }));

    // Group inbound emails per lead for reply lookup
    const inboundByLead = new Map<string, number[]>();
    for (const r of rows) {
      if (r.direction === "inbound") {
        const arr = inboundByLead.get(r.lead_id) ?? [];
        arr.push(new Date(r.created_at).getTime());
        inboundByLead.set(r.lead_id, arr);
      }
    }

    let totalSent = 0;
    let totalReplied = 0;

    for (const r of rows) {
      const dt = new Date(r.created_at);
      const h = dt.getHours();
      if (r.direction === "outbound" || r.direction == null) {
        buckets[h].sent += 1;
        totalSent += 1;
        const inbounds = inboundByLead.get(r.lead_id);
        if (inbounds) {
          const sentAt = dt.getTime();
          const replied = inbounds.some((t) => t > sentAt && t - sentAt <= REPLY_WINDOW_MS);
          if (replied) {
            buckets[h].replied += 1;
            totalReplied += 1;
          }
        }
      }
    }

    const chart = buckets.map((b) => ({
      label: b.label,
      sent: b.sent,
      replyRate: b.sent >= 1 ? Math.round((b.replied / b.sent) * 100) : 0,
    }));

    let best: { hour: number; rate: number } | null = null;
    for (const b of buckets) {
      if (b.sent >= 3) {
        const rate = b.replied / b.sent;
        if (!best || rate > best.rate) best = { hour: b.hour, rate };
      }
    }

    return {
      chart,
      bestHour: best ? `${formatHour(best.hour)} (${Math.round(best.rate * 100)}%)` : "—",
      replyRate: totalSent > 0 ? `${Math.round((totalReplied / totalSent) * 100)}%` : "—",
      totalEmails: totalSent,
    };
  }, [rows]);

  return (
    <Card className="border-border/40">
      <CardHeader className="pb-2 px-5 pt-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-md bg-purple-500/10 flex items-center justify-center">
              <Mail className="h-3.5 w-3.5 text-purple-500" />
            </div>
            <CardTitle className="text-sm font-medium">Email Performance by Hour</CardTitle>
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
        <div className="grid grid-cols-3 gap-2 mb-3">
          <Stat label="Best hour" value={bestHour} />
          <Stat label="Reply rate" value={replyRate} />
          <Stat label="Total emails" value={String(totalEmails)} />
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
                name === "replyRate" ? [`${value}%`, "Reply rate"] : [value, "Emails"]
              }
            />
            <Bar yAxisId="left" dataKey="sent" fill="hsl(280 100% 55%)" radius={[3, 3, 0, 0]} />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="replyRate"
              stroke="hsl(145 70% 45%)"
              strokeWidth={2}
              dot={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
        <p className="text-[10px] text-muted-foreground mt-2">
          Reply rate is estimated from inbound replies within 48h. Open &amp; click tracking coming soon.
          {!loading && rows.length === 0 && " No email activity in this window yet."}
        </p>
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
