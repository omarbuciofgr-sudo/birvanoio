import { Link } from "react-router-dom";
import { useState } from "react";
import { PlanStepDialog, type PlanTask } from "@/components/plans/PlanStepDialog";
import type { PlanChannel } from "@/lib/followUpPlans";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { CalendarClock, Check, Mail, MessageSquare, Phone, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { localDate, markFollowUpDone, prettyDate } from "@/lib/followUps";

type Row = {
  id: string;
  due_date: string;
  note: string | null;
  lead_id: string;
  channel: PlanChannel | null;
  enrollment_id: string | null;
  draft_subject: string | null;
  draft_body: string | null;
  leads: { business_name: string; contact_name: string | null; phone: string | null; email: string | null; industry: string | null; do_not_contact: boolean | null } | null;
};

export function TodaysFollowUps({ userId }: { userId: string }) {
  const qc = useQueryClient();
  const today = localDate();
  const [review, setReview] = useState<PlanTask | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["follow-ups-today", userId, today],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("lead_follow_ups")
        .select("id, due_date, note, lead_id, channel, enrollment_id, draft_subject, draft_body, leads(business_name, contact_name, phone, email, industry, do_not_contact)")
        .eq("user_id", userId).is("done_at", null).lte("due_date", today).order("due_date").limit(50);
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  const done = async (id: string) => {
    const { error } = await markFollowUpDone(id);
    if (error) return toast.error(error);
    toast.success("Marked done");
    qc.invalidateQueries({ queryKey: ["follow-ups-today"] });
  };

  if (!isLoading && (!data || data.length === 0)) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <CalendarClock className="h-4 w-4 text-primary" /> Today's follow-ups
          {data && <span className="text-xs font-normal text-muted-foreground">({data.length})</span>}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-full" /></div>
        ) : (
          <ul className="divide-y divide-border">
            {data!.map((f) => {
              const l = f.leads;
              const overdue = f.due_date < today;
              const href = l?.industry === "Real Estate"
                ? `/dashboard/owners/${encodeURIComponent(`lead:${f.lead_id}`)}`
                : `/dashboard/leads/${f.lead_id}`;
              return (
                <li key={f.id} className="flex flex-wrap items-center gap-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <Link to={href} className="text-sm font-medium hover:underline">
                      {l?.contact_name || l?.business_name || "Lead"}
                    </Link>
                    <div className="text-xs text-muted-foreground truncate">
                      <span className={overdue ? "text-destructive font-medium" : ""}>
                        {overdue ? `Overdue · ${prettyDate(f.due_date)}` : "Due today"}
                      </span>
                      {l?.contact_name && l.business_name ? ` · ${l.business_name}` : ""}
                      {f.note ? ` · ${f.note}` : ""}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {f.enrollment_id && f.channel && (
                      <Button size="sm" variant="secondary" className="h-8 gap-1 px-2 text-xs" onClick={() => setReview({
                        id: f.id, lead_id: f.lead_id, channel: f.channel!, note: f.note, draft_subject: f.draft_subject, draft_body: f.draft_body,
                        lead: { name: l?.contact_name || l?.business_name || "Owner", phone: l?.phone ?? null, email: l?.email ?? null, do_not_contact: l?.do_not_contact },
                      })}>
                        <Sparkles className="h-3.5 w-3.5" /> Review draft
                      </Button>
                    )}
                    <Button asChild={!!l?.phone} size="sm" variant="outline" className="h-8 px-2" disabled={!l?.phone} title={l?.phone ? "Call" : "No phone saved"}>
                      {l?.phone ? <a href={`tel:${l.phone}`} aria-label="Call"><Phone className="h-3.5 w-3.5" /></a> : <Phone className="h-3.5 w-3.5" />}
                    </Button>
                    <Button asChild={!!l?.phone} size="sm" variant="outline" className="h-8 px-2" disabled={!l?.phone} title={l?.phone ? "Text" : "No phone saved"}>
                      {l?.phone ? <a href={`sms:${l.phone}`} aria-label="Text"><MessageSquare className="h-3.5 w-3.5" /></a> : <MessageSquare className="h-3.5 w-3.5" />}
                    </Button>
                    <Button asChild={!!l?.email} size="sm" variant="outline" className="h-8 px-2" disabled={!l?.email} title={l?.email ? "Email" : "No email saved"}>
                      {l?.email ? <a href={`mailto:${l.email}`} aria-label="Email"><Mail className="h-3.5 w-3.5" /></a> : <Mail className="h-3.5 w-3.5" />}
                    </Button>
                    <Button size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => done(f.id)}>
                      <Check className="h-3.5 w-3.5" /> Mark done
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
      <PlanStepDialog task={review} onClose={(changed) => { setReview(null); qc.invalidateQueries({ queryKey: ["follow-ups-today"] }); if (changed) window.dispatchEvent(new Event("brivano:plans-changed")); }} />
    </Card>
  );
}
