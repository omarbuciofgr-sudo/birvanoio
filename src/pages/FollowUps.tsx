import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CalendarClock, Check, ChevronDown, ChevronUp, MessageSquare, Phone, PhoneCall, Plus, Save } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DataPageSkeleton from "@/components/dashboard/DataPageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CopyText } from "@/components/playbook/CopyText";
import { useAuth } from "@/hooks/useAuth";
import { leadsQueryKey, useLeadsData, type AppLead } from "@/hooks/useLeadsData";
import { useProspectingProfile } from "@/hooks/useProspectingProfile";
import { supabase } from "@/integrations/supabase/client";
import { notifyGoalsChanged } from "@/lib/dailyGoals";
import { daysFromNow, localDate, markFollowUpDone, nextWeek, prettyDate } from "@/lib/followUps";
import { OUTCOMES, scriptsFor, textsFor, toLeadType, tokenValues, type CallOutcome } from "@/lib/playbook";
import { fillTokens, textOptOutLine } from "@/data/playbookContent";
import { cn } from "@/lib/utils";

type FollowUpRow = {
  id: string;
  due_date: string;
  note: string | null;
  channel: string | null;
  draft_body: string | null;
  lead_id: string;
  leads: { business_name: string; contact_name: string | null; do_not_contact: boolean | null } | null;
};

type Channel = "call" | "text";

export default function FollowUps() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const leadsQuery = useLeadsData(user?.id);
  const { profile } = useProspectingProfile();
  const today = localDate();

  // Schedule form
  const [formOpen, setFormOpen] = useState(false);
  const [leadId, setLeadId] = useState("");
  const [leadSearch, setLeadSearch] = useState("");
  const [channel, setChannel] = useState<Channel>("call");
  const [dueDate, setDueDate] = useState(daysFromNow(1));
  const [nextStep, setNextStep] = useState("");
  const [templateId, setTemplateId] = useState("");
  const [script, setScript] = useState("");
  const [scriptTouched, setScriptTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  // Outcome dialog
  const [logging, setLogging] = useState<FollowUpRow | null>(null);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [outcomeNote, setOutcomeNote] = useState("");
  const [outcomeNext, setOutcomeNext] = useState("");
  const [outcomeFollowUp, setOutcomeFollowUp] = useState("");
  const [loggingSaving, setLoggingSaving] = useState(false);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const followUpsQuery = useQuery({
    queryKey: ["follow-ups-page", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("lead_follow_ups")
        .select("id, due_date, note, channel, draft_body, lead_id, leads(business_name, contact_name, do_not_contact)")
        .eq("user_id", user!.id).is("done_at", null).order("due_date").limit(200);
      if (error) throw error;
      return (data ?? []) as FollowUpRow[];
    },
  });

  const leads = leadsQuery.data ?? [];
  const leadMap = useMemo(() => new Map(leads.map((l) => [l.id, l])), [leads]);
  const selectedLead = leads.find((l) => l.id === leadId);
  const filteredLeads = leads.filter((l) => `${l.business_name} ${l.contact_name ?? ""} ${l.city ?? ""}`.toLowerCase().includes(leadSearch.toLowerCase()));

  const tokens = tokenValues(selectedLead ?? null, profile);
  const leadType = toLeadType((selectedLead as any)?.listing_type);
  const callScript = selectedLead ? scriptsFor(leadType, profile?.prospecting_role ?? null)[0] : null;
  const templates = selectedLead ? textsFor(leadType) : [];

  /** Default script for the current lead/channel, before the user edits it. */
  const defaultScript = () => {
    if (!selectedLead) return "";
    if (channel === "call") {
      const s = callScript ? `${callScript.opener}${callScript.ask ? `\n\n${callScript.ask}` : ""}` : "";
      return fillTokens(s, tokens);
    }
    const t = templates.find((x) => x.id === templateId) ?? templates[0];
    return t ? `${fillTokens(t.text, tokens)}\n\n${textOptOutLine}` : "";
  };

  const shownScript = scriptTouched ? script : defaultScript();

  const resetForm = () => {
    setLeadId(""); setLeadSearch(""); setChannel("call"); setDueDate(daysFromNow(1));
    setNextStep(""); setTemplateId(""); setScript(""); setScriptTouched(false);
  };

  const schedule = async () => {
    if (!user || !leadId || saving) return;
    if (dueDate < today) return toast.error("Pick today or a future date.");
    setSaving(true);
    const body = shownScript.trim().slice(0, 4000);
    const { error } = await (supabase as any).from("lead_follow_ups").insert({
      user_id: user.id,
      lead_id: leadId,
      due_date: dueDate,
      channel,
      note: nextStep.trim().slice(0, 1000) || null,
      draft_body: body || null,
    });
    setSaving(false);
    if (error) return toast.error("Couldn't schedule the follow-up. Please try again.");
    toast.success(`Follow-up scheduled for ${prettyDate(dueDate)}`);
    resetForm();
    setFormOpen(false);
    queryClient.invalidateQueries({ queryKey: ["follow-ups-page", user.id] });
    queryClient.invalidateQueries({ queryKey: ["follow-ups-today"] });
  };

  const done = async (id: string) => {
    const { error } = await markFollowUpDone(id);
    if (error) return toast.error(error);
    toast.success("Marked done");
    queryClient.invalidateQueries({ queryKey: ["follow-ups-page", user?.id] });
    queryClient.invalidateQueries({ queryKey: ["follow-ups-today"] });
  };

  const openLogging = (f: FollowUpRow) => {
    setLogging(f);
    setOutcome(null); setOutcomeNote(""); setOutcomeNext(f.note ?? ""); setOutcomeFollowUp("");
  };

  const saveOutcome = async () => {
    if (!logging || !outcome || loggingSaving) return;
    setLoggingSaving(true);
    try {
      const blocked = outcome === "do_not_call";
      const { error } = await supabase.rpc("log_tracked_call", {
        p_lead_id: logging.lead_id,
        p_outcome: outcome,
        p_call_date: today,
        p_note: outcomeNote.trim() || undefined,
        p_next_step: blocked ? undefined : outcomeNext.trim() || undefined,
        p_follow_up_date: blocked ? undefined : outcomeFollowUp || undefined,
      });
      if (error) throw error;
      await markFollowUpDone(logging.id);
      notifyGoalsChanged();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["follow-ups-page", user?.id] }),
        queryClient.invalidateQueries({ queryKey: ["follow-ups-today"] }),
        queryClient.invalidateQueries({ queryKey: ["call-tracking", user?.id] }),
        queryClient.invalidateQueries({ queryKey: leadsQueryKey(user?.id) }),
      ]);
      toast.success(blocked ? "Logged. This owner is marked do not contact." : "Outcome logged in Call Tracking.");
      setLogging(null);
    } catch {
      toast.error("Couldn't log the outcome. Please try again.");
    } finally { setLoggingSaving(false); }
  };

  if (leadsQuery.isLoading || followUpsQuery.isLoading) return <DataPageSkeleton />;
  if (leadsQuery.isError || followUpsQuery.isError) return (
    <DashboardLayout><h1 className="text-2xl font-semibold">Follow-Ups</h1><p className="my-4 text-sm text-destructive">Couldn't load your follow-ups.</p>
      <Button variant="outline" onClick={() => { leadsQuery.refetch(); followUpsQuery.refetch(); }}>Try again</Button>
    </DashboardLayout>
  );

  const rows = followUpsQuery.data ?? [];
  const overdue = rows.filter((r) => r.due_date < today);
  const dueToday = rows.filter((r) => r.due_date === today);
  const upcoming = rows.filter((r) => r.due_date > today);

  const renderRow = (f: FollowUpRow) => {
    const lead = f.leads ?? leadMap.get(f.lead_id);
    const isOpen = expanded[f.id];
    const ch: Channel = f.channel === "text" ? "text" : "call";
    return (
      <article key={f.id} className="space-y-3 py-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0 flex-1">
            <Link to={`/dashboard/leads/${f.lead_id}`} className="font-medium text-primary hover:underline break-words">
              {lead?.contact_name || lead?.business_name || "Lead"}
            </Link>
            <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className={cn("inline-flex items-center gap-1", f.due_date < today && "font-medium text-destructive")}>
                <CalendarClock className="h-3.5 w-3.5" />
                {f.due_date < today ? `Overdue · ${prettyDate(f.due_date)}` : f.due_date === today ? "Due today" : prettyDate(f.due_date)}
              </span>
              <Badge variant="secondary" className="gap-1">
                {ch === "text" ? <MessageSquare className="h-3 w-3" /> : <Phone className="h-3 w-3" />}
                {ch === "text" ? "Text" : "Call"}
              </Badge>
              {lead?.do_not_contact && <Badge variant="destructive">Do not contact</Badge>}
            </div>
            {f.note && <p className="mt-1 text-sm text-muted-foreground break-words"><span className="font-medium text-foreground">Next step: </span>{f.note}</p>}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" className="min-h-11 gap-1.5 md:min-h-8" onClick={() => openLogging(f)}>
              <PhoneCall className="h-3.5 w-3.5" /> Log outcome
            </Button>
            <Button size="sm" variant="outline" className="min-h-11 gap-1.5 md:min-h-8" onClick={() => done(f.id)}>
              <Check className="h-3.5 w-3.5" /> Mark done
            </Button>
          </div>
        </div>
        {f.draft_body && (
          <div>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1 px-2 text-xs" onClick={() => setExpanded((e) => ({ ...e, [f.id]: !e[f.id] }))}>
              {isOpen ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {isOpen ? "Hide script" : `Show ${ch === "text" ? "text" : "call"} script`}
            </Button>
            {isOpen && <div className="mt-2"><CopyText text={f.draft_body} label={ch === "text" ? "Text message" : "Call script"} /></div>}
          </div>
        )}
      </article>
    );
  };

  const group = (title: string, items: FollowUpRow[], destructive = false) => (
    items.length > 0 && (
      <section aria-label={title} className="space-y-1">
        <h2 className={cn("text-sm font-semibold uppercase tracking-wide", destructive ? "text-destructive" : "text-muted-foreground")}>{title} ({items.length})</h2>
        <div className="divide-y divide-border">{items.map(renderRow)}</div>
      </section>
    )
  );

  return (
    <DashboardLayout>
      <div className="space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><CalendarClock className="h-6 w-6 text-primary" />Follow-Ups</h1>
          <div className="flex gap-2">
            <Button variant="outline" className="min-h-11" asChild><Link to="/dashboard/call-tracking">Call Tracking<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button className="min-h-11" onClick={() => setFormOpen((v) => !v)} disabled={leads.length === 0}>
              <Plus className="mr-2 h-4 w-4" />Schedule follow-up
            </Button>
          </div>
        </header>

        {leads.length === 0 ? (
          <div className="space-y-3 py-4">
            <p className="text-sm text-muted-foreground">No saved leads yet. Save an owner first, then schedule follow-ups here.</p>
            <Button asChild className="min-h-11"><Link to="/dashboard/scraper?tab=real-estate">Find Owners</Link></Button>
          </div>
        ) : (
          <>
            {formOpen && (
              <section aria-labelledby="schedule-title" className="space-y-4 rounded-lg border border-border p-4">
                <h2 id="schedule-title" className="text-lg font-semibold">Schedule a follow-up</h2>
                <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); schedule(); }}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fu-lead-search">Lead</Label>
                      <Input id="fu-lead-search" className="h-11" placeholder="Search address or owner" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
                      <Select value={leadId} onValueChange={(v) => { setLeadId(v); setScriptTouched(false); setScript(""); setTemplateId(""); }}>
                        <SelectTrigger aria-label="Select lead" className="h-11"><SelectValue placeholder="Select a lead" /></SelectTrigger>
                        <SelectContent position="popper">
                          {filteredLeads.map((lead) => <SelectItem className="min-h-11" value={lead.id} key={lead.id}>{lead.business_name}{lead.contact_name ? ` · ${lead.contact_name}` : ""}</SelectItem>)}
                          {filteredLeads.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching leads</p>}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Call or text</Label>
                      <div className="grid grid-cols-2 gap-2">
                        {(["call", "text"] as Channel[]).map((c) => (
                          <Button key={c} type="button" variant={channel === c ? "default" : "outline"} className="min-h-11 gap-1.5" aria-pressed={channel === c}
                            onClick={() => { setChannel(c); setScriptTouched(false); setScript(""); }}>
                            {c === "call" ? <Phone className="h-4 w-4" /> : <MessageSquare className="h-4 w-4" />}{c === "call" ? "Call" : "Text"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="fu-date">Follow-up date</Label>
                      <div className="flex flex-wrap gap-2">
                        {[{ label: "Tomorrow", v: daysFromNow(1) }, { label: "In 3 days", v: daysFromNow(3) }, { label: "Next week", v: nextWeek() }].map((q) => (
                          <Button key={q.label} type="button" size="sm" variant={dueDate === q.v ? "default" : "outline"} className="min-h-11 md:min-h-8" onClick={() => setDueDate(q.v)}>{q.label}</Button>
                        ))}
                      </div>
                      <Input id="fu-date" type="date" required min={today} className="h-11" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="fu-next">Next step</Label>
                      <Input id="fu-next" className="h-11" placeholder="e.g. Ask about their timeline" value={nextStep} onChange={(e) => setNextStep(e.target.value)} maxLength={1000} />
                    </div>
                  </div>

                  {selectedLead && channel === "text" && templates.length > 0 && (
                    <div className="space-y-2">
                      <Label>Text template</Label>
                      <Select value={templateId || templates[0]?.id} onValueChange={(v) => { setTemplateId(v); setScriptTouched(false); setScript(""); }}>
                        <SelectTrigger aria-label="Text template" className="h-11"><SelectValue /></SelectTrigger>
                        <SelectContent position="popper">{templates.map((t) => <SelectItem className="min-h-11" key={t.id} value={t.id}>{t.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  )}

                  {selectedLead && (
                    <div className="space-y-2">
                      <Label htmlFor="fu-script">{channel === "call" ? "Call script" : "Text message"} (editable, filled with this lead's details)</Label>
                      <Textarea id="fu-script" rows={6} value={shownScript} onChange={(e) => { setScript(e.target.value); setScriptTouched(true); }} placeholder={channel === "call" ? "Your opener and key questions" : "Your text message"} />
                      {channel === "text" && <p className="text-xs text-muted-foreground">The opt-out line is included so owners can reply STOP.</p>}
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button type="submit" className="min-h-11" disabled={!leadId || saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Schedule"}</Button>
                    <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setFormOpen(false); resetForm(); }}>Cancel</Button>
                  </div>
                </form>
              </section>
            )}

            {rows.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No follow-ups scheduled. Schedule one above, or log a call in Call Tracking with a follow-up date.</p>
            ) : (
              <div className="space-y-6">
                {group("Overdue", overdue, true)}
                {group("Today", dueToday)}
                {group("Upcoming", upcoming)}
              </div>
            )}
          </>
        )}
      </div>

      <Dialog open={Boolean(logging)} onOpenChange={(open) => !open && setLogging(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Log outcome · {logging?.leads?.contact_name || logging?.leads?.business_name || "Lead"}</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Saved to Call Tracking for today, and this follow-up is marked done.</p>
            <fieldset className="space-y-2">
              <legend className="mb-2 text-sm font-medium">Outcome</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OUTCOMES.map((o) => (
                  <Button type="button" key={o.key} variant={outcome === o.key ? "default" : "outline"} className="min-h-11 whitespace-normal" aria-pressed={outcome === o.key} onClick={() => setOutcome(o.key)}>{o.label}</Button>
                ))}
              </div>
            </fieldset>
            {outcome === "do_not_call" && <p className="text-sm text-destructive">Call and text actions will be hidden for this lead and any follow-up plan stops.</p>}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="fu-out-next">Next step</Label>
                <Input id="fu-out-next" className="h-11" value={outcome === "do_not_call" ? "Do not contact" : outcomeNext} disabled={outcome === "do_not_call"} onChange={(e) => setOutcomeNext(e.target.value)} maxLength={1000} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fu-out-date">Next follow-up date (optional)</Label>
                <Input id="fu-out-date" type="date" min={today} className="h-11" disabled={outcome === "do_not_call"} value={outcome === "do_not_call" ? "" : outcomeFollowUp} onChange={(e) => setOutcomeFollowUp(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="fu-out-note">Notes (optional)</Label>
              <Textarea id="fu-out-note" rows={2} value={outcomeNote} onChange={(e) => setOutcomeNote(e.target.value)} maxLength={500} />
            </div>
            <Button className="min-h-11 w-full" disabled={!outcome || loggingSaving} onClick={saveOutcome}>{loggingSaving ? "Saving…" : "Save outcome"}</Button>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
