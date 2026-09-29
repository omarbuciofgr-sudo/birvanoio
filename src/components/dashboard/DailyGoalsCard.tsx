import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Flame, PartyPopper, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { computeStreak, GOALS_CHANGED, loadGoalDays, loadGoalSettings, type GoalDay, type GoalSettings } from "@/lib/dailyGoals";

export function DailyGoalsCard({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<GoalSettings | null>(null);
  const [days, setDays] = useState<GoalDay[] | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const prev = useRef<{ c: boolean; f: boolean } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const [s, d] = await Promise.all([loadGoalSettings(userId), loadGoalDays(90)]);
      setSettings(s); setDays(d);
    } catch { setDays([]); setSettings((s) => s ?? { contactGoal: 10, followupGoal: 5, weekendsCount: false }); }
  }, [userId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const onChange = () => refresh();
    window.addEventListener(GOALS_CHANGED, onChange);
    window.addEventListener("focus", onChange);
    const ch = supabase.channel(`goals-${userId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "conversation_logs", filter: `client_id=eq.${userId}` }, onChange)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "lead_follow_ups", filter: `user_id=eq.${userId}` }, onChange)
      .subscribe();
    return () => { window.removeEventListener(GOALS_CHANGED, onChange); window.removeEventListener("focus", onChange); supabase.removeChannel(ch); };
  }, [refresh, userId]);

  const today = days?.[days.length - 1] ?? { day: "", contacted: 0, followups: 0 };
  const cHit = !!settings && today.contacted >= settings.contactGoal;
  const fHit = !!settings && today.followups >= settings.followupGoal;

  // Celebrate only when a goal flips to done while the page is open.
  useEffect(() => {
    if (!settings || !days) return;
    const p = prev.current;
    prev.current = { c: cHit, f: fHit };
    if (!p) return;
    const newly = [!p.c && cHit && "owners contacted", !p.f && fHit && "follow-ups"].filter(Boolean);
    if (newly.length) {
      setCelebrate(true);
      toast.success(cHit && fHit ? "Both goals hit today. Nice work!" : `Goal hit: ${newly.join(" and ")}!`);
      const t = setTimeout(() => setCelebrate(false), 2500);
      return () => clearTimeout(t);
    }
  }, [cHit, fHit, settings, days]);

  if (!settings || !days) return <Skeleton className="h-40 w-full" />;
  const streak = computeStreak(days, settings);
  const pct = (n: number, g: number) => Math.min(100, Math.round((n / g) * 100));

  return (
    <Card className={`border-border/60 transition-shadow ${celebrate ? "ring-2 ring-primary shadow-lg" : ""}`}>
      <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base flex items-center gap-2">
          Today {celebrate && <PartyPopper className="h-4 w-4 text-primary animate-bounce" />}
        </CardTitle>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-sm font-medium">
            <Flame className={`h-4 w-4 ${streak ? "text-primary" : "text-muted-foreground"}`} />
            {streak}-day streak
          </span>
          <Link to="/dashboard/settings" aria-label="Edit daily goals" className="text-muted-foreground hover:text-foreground"><Settings2 className="h-4 w-4" /></Link>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {[
          { label: "Owners contacted", n: today.contacted, g: settings.contactGoal, hit: cHit },
          { label: "Follow-ups completed", n: today.followups, g: settings.followupGoal, hit: fHit },
        ].map((r) => (
          <div key={r.label} className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span>{r.label}</span>
              <span className={r.hit ? "text-primary font-medium" : "text-muted-foreground"}>{r.n} / {r.g}{r.hit ? " ✓" : ""}</span>
            </div>
            <Progress value={pct(r.n, r.g)} className="h-2" />
          </div>
        ))}
        <p className="text-xs text-muted-foreground">
          Calls, texts and emails sent from Brivano count automatically. Use "Log contact" on an owner for outside calls.
        </p>
      </CardContent>
    </Card>
  );
}
