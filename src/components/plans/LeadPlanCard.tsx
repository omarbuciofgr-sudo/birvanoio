import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { ListChecks, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { loadEnrollment, loadPlans, planProgress, startPlan, stopPlan, type Enrollment, type Plan } from "@/lib/followUpPlans";

export function LeadPlanCard({ leadId, selling }: { leadId: string | null; selling: boolean }) {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [enr, setEnr] = useState<Enrollment | null>(null);
  const [done, setDone] = useState<Set<number>>(new Set());
  const [choice, setChoice] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    if (!leadId) return;
    const [p, e] = await Promise.all([loadPlans().catch(() => []), loadEnrollment(leadId)]);
    setPlans(p);
    setEnr(e);
    setChoice((c) => c || p.find((x) => x.kind === (selling ? "fsbo" : "frbo"))?.id || p[0]?.id || "");
    if (e) {
      const { data } = await (supabase as any).from("lead_follow_ups").select("step_index").eq("enrollment_id", e.id).not("done_at", "is", null);
      setDone(new Set((data ?? []).map((r: { step_index: number }) => r.step_index)));
    }
  }, [leadId, selling]);

  useEffect(() => {
    void refresh();
    const h = () => void refresh();
    window.addEventListener("brivano:plans-changed", h);
    window.addEventListener("brivano:goals-changed", h);
    return () => { window.removeEventListener("brivano:plans-changed", h); window.removeEventListener("brivano:goals-changed", h); };
  }, [refresh]);

  if (!leadId) {
    return (
      <Card><CardContent className="pt-5 text-sm text-muted-foreground">Save this owner to My Leads to start a follow-up plan.</CardContent></Card>
    );
  }

  const active = enr?.status === "active" ? enr : null;
  const prog = enr ? planProgress(enr, done) : null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base"><ListChecks className="h-4 w-4 text-primary" /> Follow-up plan</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {plans === null ? <Skeleton className="h-10 w-full" /> : active && prog ? (
          <>
            <p className="text-sm font-medium">{active.plan_name}</p>
            <Progress value={(done.size / prog.total) * 100} />
            <p className="text-sm text-muted-foreground">{prog.label}</p>
            <p className="text-xs text-muted-foreground">Each step shows up in Today's follow-ups with a draft to review. Stops by itself if the owner replies, books, signs, is lost or opts out.</p>
            <Button variant="outline" size="sm" className="min-h-11 sm:min-h-8" disabled={busy}
              onClick={async () => { setBusy(true); try { await stopPlan(active.id); toast.success("Plan stopped"); } catch (e) { toast.error((e as Error).message); } setBusy(false); }}>
              Stop plan
            </Button>
          </>
        ) : (
          <>
            {enr && prog && <p className="text-xs text-muted-foreground">Last plan: {enr.plan_name}. {prog.label}.</p>}
            <div className="flex flex-col gap-2 sm:flex-row">
              <Select value={choice || undefined} onValueChange={setChoice}>
                <SelectTrigger className="min-h-11 sm:min-h-9"><SelectValue placeholder="Choose a plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => <SelectItem key={p.id} value={p.id}>{p.name} ({p.steps.length} steps)</SelectItem>)}
                </SelectContent>
              </Select>
              <Button className="min-h-11 sm:min-h-9" disabled={!choice || busy} onClick={async () => {
                const plan = plans.find((p) => p.id === choice);
                if (!plan) return;
                setBusy(true);
                try { await startPlan(leadId, plan); toast.success("Plan started. Step 1 is in Today's follow-ups."); }
                catch (e) { toast.error((e as Error).message); }
                setBusy(false);
              }}>
                {busy && <Loader2 className="mr-1 h-4 w-4 animate-spin" />} Start plan
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
