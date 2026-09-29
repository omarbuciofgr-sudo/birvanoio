import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Pencil, Trash2, Workflow } from "lucide-react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { AskAssistantButton } from "@/components/assistant/AssistantPanel";

type Automation = { id: string; name: string; instructions: string; days: number[]; run_time: string; timezone: string; credit_cap: number; enabled: boolean; last_run_at: string | null };
type Run = { automation_id: string; run_date: string; status: string; credits_spent: number; summary: string | null };

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const db = supabase as any;
const hourLabel = (t: string) => { const h = Number(t.slice(0, 2)); return `${h % 12 || 12}${h < 12 ? "am" : "pm"}`; };

export default function Automations() {
  const [items, setItems] = useState<Automation[] | null>(null);
  const [runs, setRuns] = useState<Record<string, Run>>({});
  const [editing, setEditing] = useState<Automation | null>(null);
  const [deleting, setDeleting] = useState<Automation | null>(null);

  const load = useCallback(async () => {
    const [{ data }, { data: r }] = await Promise.all([
      db.from("automations").select("*").order("created_at"),
      db.from("automation_runs").select("automation_id, run_date, status, credits_spent, summary").order("created_at", { ascending: false }).limit(100),
    ]);
    setItems(data ?? []);
    const latest: Record<string, Run> = {};
    for (const x of (r ?? []) as Run[]) if (!latest[x.automation_id]) latest[x.automation_id] = x;
    setRuns(latest);
  }, []);
  useEffect(() => { load(); }, [load]);

  const patch = async (id: string, p: Partial<Automation>) => {
    const { error } = await db.from("automations").update(p).eq("id", id);
    if (error) toast.error("Couldn't save. Please try again."); else load();
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Automations</h1>
            <p className="text-sm text-muted-foreground">Tasks Brivano Assistant runs for you on a schedule. They can search, save owners and set follow-ups, but never send messages.</p>
          </div>
          <AskAssistantButton className="min-h-11 md:min-h-8" label="Create with Assistant" />
        </div>

        {items === null ? (
          <div className="space-y-3"><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /></div>
        ) : items.length === 0 ? (
          <Card><CardContent className="flex flex-col items-center gap-2 py-10 text-center">
            <Workflow className="h-8 w-8 text-muted-foreground" />
            <p className="font-medium">No automations yet</p>
            <p className="max-w-sm text-sm text-muted-foreground">Try asking the Assistant: "Every weekday at 8am, find new FSBOs in Naperville and add the best ones to My Leads with a follow-up for today."</p>
          </CardContent></Card>
        ) : items.map((a) => {
          const run = runs[a.id];
          return (
            <Card key={a.id}><CardContent className="space-y-2 p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="font-medium">{a.name}</p>
                  <p className="text-xs text-muted-foreground">{a.days.map((d) => DAYS[d]).join(", ")} at {hourLabel(a.run_time)} · up to {a.credit_cap} credits per run</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <Switch checked={a.enabled} onCheckedChange={(v) => patch(a.id, { enabled: v })} aria-label={a.enabled ? "Pause" : "Resume"} />
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setEditing(a)} aria-label="Edit"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => setDeleting(a)} aria-label="Delete"><Trash2 className="h-4 w-4" /></Button>
                </div>
              </div>
              <p className="whitespace-pre-wrap text-sm">{a.instructions}</p>
              {run && <p className="rounded-md bg-muted/50 p-2 text-xs text-muted-foreground">Last run {run.run_date}{run.credits_spent ? ` · ${run.credits_spent} credits` : ""}: {run.summary ?? (run.status === "running" ? "Running…" : "No summary")}</p>}
              {!a.enabled && <p className="text-xs text-muted-foreground">Paused</p>}
            </CardContent></Card>
          );
        })}
      </div>

      {editing && <EditDialog a={editing} onClose={() => setEditing(null)} onSave={async (p) => { await patch(editing.id, p); setEditing(null); }} />}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleting?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>It won't run again. Past chat summaries stay in your Assistant history.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep</AlertDialogCancel>
            <AlertDialogAction onClick={async () => { await db.from("automations").delete().eq("id", deleting!.id); setDeleting(null); load(); }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </DashboardLayout>
  );
}

function EditDialog({ a, onClose, onSave }: { a: Automation; onClose: () => void; onSave: (p: Partial<Automation>) => Promise<void> }) {
  const [name, setName] = useState(a.name);
  const [instructions, setInstructions] = useState(a.instructions);
  const [days, setDays] = useState<number[]>(a.days);
  const [hour, setHour] = useState(a.run_time.slice(0, 2));
  const [cap, setCap] = useState(String(a.credit_cap));
  const valid = name.trim() && instructions.trim() && days.length;
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader><DialogTitle>Edit automation</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label htmlFor="an">Name</Label><Input id="an" value={name} maxLength={80} onChange={(e) => setName(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ai">Instructions</Label><Textarea id="ai" value={instructions} maxLength={2000} rows={4} onChange={(e) => setInstructions(e.target.value)} /></div>
          <div className="space-y-1">
            <Label>Days</Label>
            <div className="flex flex-wrap gap-1">
              {DAYS.map((d, i) => (
                <Button key={d} type="button" size="sm" variant={days.includes(i) ? "default" : "outline"} className="min-h-11 min-w-11 md:min-h-8"
                  onClick={() => setDays((p) => p.includes(i) ? p.filter((x) => x !== i) : [...p, i].sort())}>{d}</Button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Time ({a.timezone})</Label>
              <Select value={hour} onValueChange={setHour}>
                <SelectTrigger className="min-h-11 md:min-h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{Array.from({ length: 24 }, (_, h) => String(h).padStart(2, "0")).map((h) => <SelectItem key={h} value={h}>{hourLabel(`${h}:00`)}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label htmlFor="ac">Credit cap per run</Label><Input id="ac" type="number" min={0} max={1000} value={cap} onChange={(e) => setCap(e.target.value)} /></div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button disabled={!valid} onClick={() => onSave({ name: name.trim(), instructions: instructions.trim(), days, run_time: `${hour}:00`, credit_cap: Math.min(1000, Math.max(0, Number(cap) || 0)) })}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
