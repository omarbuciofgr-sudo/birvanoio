import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { Loader2, Phone, RefreshCw, Send, Copy, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { InsertBookingLink } from "@/components/booking/InsertBookingLink";
import { AIWritingError, splitEmailDraft, writeForOwner, type AIWritingTask } from "@/lib/ai/claudeWriter";
import { useCommunicationCompliance } from "@/hooks/useCommunicationCompliance";
import { markFollowUpDone } from "@/lib/followUps";
import type { PlanChannel } from "@/lib/followUpPlans";

export type PlanTask = {
  id: string; lead_id: string; channel: PlanChannel; note: string | null;
  draft_subject: string | null; draft_body: string | null;
  lead: { name: string; phone: string | null; email: string | null; do_not_contact?: boolean | null };
};

const TASK: Record<PlanChannel, AIWritingTask> = { call: "call_script", text: "text_message", email: "email" };
const db = supabase as any;

export function PlanStepDialog({ task, onClose }: { task: PlanTask | null; onClose: (changed: boolean) => void }) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [writing, setWriting] = useState(false);
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<{ message: string; limit: boolean } | null>(null);
  const { requireAcceptance, complianceDialog } = useCommunicationCompliance();

  const draft = async () => {
    if (!task) return;
    setWriting(true); setErr(null);
    try {
      const out = await writeForOwner(TASK[task.channel], { leadId: task.lead_id, listingId: null }, "friendly");
      const parts = task.channel === "email" ? splitEmailDraft(out) : { subject: "", body: out };
      setSubject(parts.subject); setBody(parts.body);
      await db.from("lead_follow_ups").update({ draft_subject: parts.subject || null, draft_body: parts.body }).eq("id", task.id);
    } catch (e) {
      const x = e instanceof AIWritingError ? e : new AIWritingError("Something went wrong writing that. Please try again.");
      setErr({ message: x.message, limit: x.code === "ai_limit" });
    } finally { setWriting(false); }
  };

  useEffect(() => {
    if (!task) return;
    setSubject(task.draft_subject ?? ""); setBody(task.draft_body ?? ""); setErr(null);
    if (!task.draft_body) void draft();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task?.id]);

  if (!task) return null;
  const saveEdits = () => db.from("lead_follow_ups").update({ draft_subject: subject || null, draft_body: body }).eq("id", task.id);

  const finish = async (msg: string) => {
    await markFollowUpDone(task.id);
    toast.success(msg);
    onClose(true);
  };

  const sendNow = async () => {
    setSending(true);
    try {
      await saveEdits();
      const { error } = task.channel === "text"
        ? await supabase.functions.invoke("send-sms", { body: { to: task.lead.phone, message: body.trim(), leadId: task.lead_id } })
        : await supabase.functions.invoke("send-email", { body: { to: task.lead.email, subject: subject.trim() || "Hello", body: body.trim(), leadId: task.lead_id } });
      if (error) {
        let msg = "Couldn't send right now. Please try again.";
        try { const b = await (error as any).context?.json?.(); if (typeof b?.error === "string") msg = b.error; } catch { /* keep */ }
        throw new Error(msg);
      }
      await finish(task.channel === "text" ? "Text sent · 1 credit used" : "Email sent");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't send right now.");
    } finally { setSending(false); }
  };

  const blocked = task.lead.do_not_contact ? "This owner asked not to be contacted."
    : task.channel === "text" && !task.lead.phone ? "No phone number yet. Get contact info first."
    : task.channel === "email" && !task.lead.email ? "No email yet. Get contact info first." : null;

  return (
    <Dialog open onOpenChange={(o) => { if (!o) { void saveEdits(); onClose(false); } }}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-base">{task.lead.name}</DialogTitle>
          <DialogDescription>{task.note ?? "Plan step"}. Review the draft, then {task.channel === "call" ? "call" : "send"}. Nothing goes out until you do.</DialogDescription>
        </DialogHeader>

        {task.note?.includes("market report") && (
          <p className="flex items-start gap-2 rounded-md bg-muted/50 p-2 text-xs">
            <FileText className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            This step includes a market report. Open the owner page and use "Create market report" to email it.
          </p>
        )}
        {err && <p className="text-sm text-destructive">{err.message} {err.limit && <Link to="/dashboard/billing" className="underline">Upgrade</Link>}</p>}

        {writing ? (
          <div className="space-y-2"><Skeleton className="h-9 w-full" /><Skeleton className="h-40 w-full" /></div>
        ) : (
          <div className="space-y-2">
            {task.channel === "email" && <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject" maxLength={200} />}
            <Textarea value={body} onChange={(e) => setBody(e.target.value)} rows={task.channel === "text" ? 5 : 10} className="text-sm" />
            <div className="flex flex-wrap items-center gap-2">
              {task.channel !== "call" && <InsertBookingLink value={body} onChange={setBody} />}
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={() => { navigator.clipboard.writeText(body); toast.success("Copied"); }}><Copy className="h-3.5 w-3.5" /> Copy</Button>
              <Button size="sm" variant="outline" className="h-8 gap-1 text-xs" onClick={draft} disabled={writing}><RefreshCw className="h-3.5 w-3.5" /> Regenerate</Button>
            </div>
          </div>
        )}

        {blocked && <p className="text-xs text-muted-foreground">{blocked}</p>}
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          <Button variant="ghost" className="min-h-11 sm:min-h-9" onClick={() => finish("Marked done")}>Mark done</Button>
          {task.channel === "call" ? (
            <Button asChild={!!task.lead.phone && !task.lead.do_not_contact} disabled={!task.lead.phone || !!task.lead.do_not_contact} className="min-h-11 gap-1 sm:min-h-9">
              {task.lead.phone ? <a href={`tel:${task.lead.phone}`}><Phone className="h-4 w-4" /> Call</a> : <span><Phone className="h-4 w-4" /> Call</span>}
            </Button>
          ) : (
            <Button className="min-h-11 gap-1 sm:min-h-9" disabled={!!blocked || !body.trim() || sending || writing}
              onClick={() => (task.channel === "text" ? requireAcceptance(() => { void sendNow(); }) : void sendNow())}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Send {task.channel}
            </Button>
          )}
        </div>
        {complianceDialog}
      </DialogContent>
    </Dialog>
  );
}
