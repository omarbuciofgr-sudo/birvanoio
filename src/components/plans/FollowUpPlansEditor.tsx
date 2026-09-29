import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { loadPlans, savePlan, type Plan, type PlanChannel } from "@/lib/followUpPlans";

export function FollowUpPlansEditor() {
  const [plans, setPlans] = useState<Plan[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => { loadPlans().then(setPlans).catch(() => setPlans([])); }, []);

  const update = (id: string, fn: (p: Plan) => Plan) => setPlans((ps) => ps?.map((p) => (p.id === id ? fn(p) : p)) ?? null);

  if (!plans) return <div className="space-y-3"><Skeleton className="h-40 w-full" /><Skeleton className="h-40 w-full" /></div>;

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Start a plan from any owner's page. Each step becomes a follow-up on its day with a draft to review. Nothing sends by itself. Changes here apply to plans you start from now on.</p>
      {plans.map((plan) => (
        <Card key={plan.id}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              <Input value={plan.name} onChange={(e) => update(plan.id, (p) => ({ ...p, name: e.target.value }))} maxLength={120} className="h-9 font-semibold" aria-label="Plan name" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {plan.steps.map((s, i) => (
              <div key={i} className="grid grid-cols-[4.5rem_6.5rem_1fr_auto] items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  Day
                  <Input type="number" min={1} max={365} value={s.day} className="h-9 px-2"
                    onChange={(e) => update(plan.id, (p) => ({ ...p, steps: p.steps.map((x, j) => (j === i ? { ...x, day: Number(e.target.value) || 1 } : x)) }))} />
                </div>
                <Select value={s.channel} onValueChange={(v) => update(plan.id, (p) => ({ ...p, steps: p.steps.map((x, j) => (j === i ? { ...x, channel: v as PlanChannel } : x)) }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="text">Text</SelectItem>
                    <SelectItem value="call">Call</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                  </SelectContent>
                </Select>
                <div className="min-w-0 space-y-1">
                  <Input value={s.instruction ?? ""} placeholder="What this step is for" className="h-9" maxLength={500}
                    onChange={(e) => update(plan.id, (p) => ({ ...p, steps: p.steps.map((x, j) => (j === i ? { ...x, instruction: e.target.value } : x)) }))} />
                  {s.channel === "email" && (
                    <label className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Checkbox checked={s.market_report} onCheckedChange={(v) => update(plan.id, (p) => ({ ...p, steps: p.steps.map((x, j) => (j === i ? { ...x, market_report: v === true } : x)) }))} />
                      Include market report
                    </label>
                  )}
                </div>
                <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Remove step"
                  onClick={() => update(plan.id, (p) => ({ ...p, steps: p.steps.filter((_, j) => j !== i) }))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap justify-between gap-2 pt-2">
              <Button size="sm" variant="outline" className="gap-1" onClick={() => update(plan.id, (p) => ({ ...p, steps: [...p.steps, { day: (p.steps.at(-1)?.day ?? 0) + 7, channel: "text", instruction: "", market_report: false }] }))}>
                <Plus className="h-4 w-4" /> Add step
              </Button>
              <Button size="sm" disabled={saving === plan.id} onClick={async () => {
                setSaving(plan.id);
                try {
                  const sorted = { ...plan, steps: [...plan.steps].sort((a, b) => a.day - b.day) };
                  await savePlan(sorted);
                  update(plan.id, () => sorted);
                  toast.success("Plan saved");
                } catch { toast.error("Couldn't save the plan"); }
                setSaving(null);
              }}>{saving === plan.id ? "Saving…" : "Save plan"}</Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
