/**
 * Shows which listing-intel signals actually produce replies and closed deals,
 * broken out by signal and by step type, with average time-to-next-touch.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { SIGNAL_LABELS, type SignalId } from "@/lib/ownerIntelSettings";
import { BarChart3, MessageSquareReply, Timer, Trophy } from "lucide-react";

export type PerfTask = {
  id: string;
  deal_id: string;
  kind: string;
  signal_key: string | null;
  notes: string | null;
  created_at: string;
  scheduled_at: string | null;
  completed_at: string | null;
  outcome: string | null;
  outcome_at: string | null;
};

/** Normalises a stored signal key ("price_drop_15000") to its signal id. */
export function signalIdOf(task: Pick<PerfTask, "signal_key" | "notes">): SignalId | null {
  const raw =
    task.signal_key ?? (task.notes || "").match(/\[intel:([^\]]+)\]/)?.[1] ?? null;
  if (!raw) return null;
  if (raw.startsWith("price_drop")) return "price_drop";
  if (raw === "relisted" || raw === "stale" || raw === "aging" || raw === "fresh") return raw;
  return null;
}

type Row = {
  id: string;
  label: string;
  total: number;
  worked: number;
  replies: number;
  conversions: number;
  avgTouchHours: number | null;
};

function summarize(id: string, label: string, tasks: PerfTask[]): Row {
  const worked = tasks.filter((t) => t.completed_at).length;
  const replies = tasks.filter((t) => t.outcome === "replied" || t.outcome === "converted").length;
  const conversions = tasks.filter((t) => t.outcome === "converted").length;
  const spans = tasks
    .filter((t) => t.completed_at)
    .map((t) => new Date(t.completed_at as string).getTime() - new Date(t.created_at).getTime())
    .filter((ms) => Number.isFinite(ms) && ms >= 0);
  return {
    id,
    label,
    total: tasks.length,
    worked,
    replies,
    conversions,
    avgTouchHours: spans.length
      ? Math.round((spans.reduce((a, b) => a + b, 0) / spans.length / 3_600_000) * 10) / 10
      : null,
  };
}

const pct = (num: number, den: number) => (den > 0 ? Math.round((num / den) * 100) : 0);

const duration = (hours: number | null) => {
  if (hours === null) return "—";
  if (hours < 24) return `${hours}h`;
  return `${Math.round((hours / 24) * 10) / 10}d`;
};

function RowTable({ title, rows }: { title: string; rows: Row[] }) {
  if (!rows.length) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">{title}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          No follow-ups yet. Steps appear here as intel signals create them.
        </CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => (
          <div key={r.id} className="space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-medium">{r.label}</span>
              <div className="flex items-center gap-1.5">
                <Badge variant="outline" className="text-[10px]">{r.total} steps</Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {pct(r.replies, r.total)}% replied
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {pct(r.conversions, r.total)}% converted
                </Badge>
                <Badge variant="outline" className="text-[10px]">
                  {duration(r.avgTouchHours)} to touch
                </Badge>
              </div>
            </div>
            <Progress value={pct(r.replies, r.total)} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">
              {r.worked} worked · {r.replies} replies · {r.conversions} conversions
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export default function IntelSignalPerformance({ tasks }: { tasks: PerfTask[] }) {
  const intelTasks = useMemo(() => tasks.filter((t) => signalIdOf(t)), [tasks]);

  const bySignal = useMemo(() => {
    const ids = Object.keys(SIGNAL_LABELS) as SignalId[];
    return ids
      .map((id) => summarize(id, SIGNAL_LABELS[id], intelTasks.filter((t) => signalIdOf(t) === id)))
      .filter((r) => r.total > 0)
      .sort((a, b) => pct(b.replies, b.total) - pct(a.replies, a.total));
  }, [intelTasks]);

  const byKind = useMemo(() => {
    const kinds = [...new Set(intelTasks.map((t) => t.kind))];
    return kinds
      .map((k) => summarize(k, k.charAt(0).toUpperCase() + k.slice(1), intelTasks.filter((t) => t.kind === k)))
      .sort((a, b) => pct(b.replies, b.total) - pct(a.replies, a.total));
  }, [intelTasks]);

  const overall = useMemo(() => summarize("all", "All signals", intelTasks), [intelTasks]);
  const best = bySignal[0];

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-3 w-3" /> Steps created
            </p>
            <p className="text-2xl font-semibold">{overall.total}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <MessageSquareReply className="h-3 w-3" /> Response rate
            </p>
            <p className="text-2xl font-semibold">{pct(overall.replies, overall.total)}%</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Trophy className="h-3 w-3" /> Conversions
            </p>
            <p className="text-2xl font-semibold">{overall.conversions}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Timer className="h-3 w-3" /> Avg time to touch
            </p>
            <p className="text-2xl font-semibold">{duration(overall.avgTouchHours)}</p>
          </CardContent>
        </Card>
      </div>

      {best && (
        <p className="text-xs text-muted-foreground">
          Best performing signal right now: <span className="font-medium text-foreground">{best.label}</span> at{" "}
          {pct(best.replies, best.total)}% reply rate across {best.total} steps.
        </p>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <RowTable title="By intel signal" rows={bySignal} />
        <RowTable title="By step type" rows={byKind} />
      </div>
    </div>
  );
}
