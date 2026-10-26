import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Check, PhoneCall, Save } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DataPageSkeleton from "@/components/dashboard/DataPageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { leadsQueryKey, useLeadsData } from "@/hooks/useLeadsData";
import { supabase } from "@/integrations/supabase/client";
import { browserTimeZone, DEFAULT_GOALS, notifyGoalsChanged } from "@/lib/dailyGoals";
import { dailyCallSummary, dateInTimeZone, trackedCallDate, validateTrackedCall } from "@/lib/callTracking";
import { OUTCOMES, type CallOutcome } from "@/lib/playbook";
import { prettyDate } from "@/lib/followUps";

export default function CallTracking() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [params] = useSearchParams();
  const linkedLeadId = params.get("lead") || "";
  const leadsQuery = useLeadsData(user?.id);
  const [day, setDay] = useState("");
  const [leadId, setLeadId] = useState(linkedLeadId);
  const [leadSearch, setLeadSearch] = useState("");
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [callDate, setCallDate] = useState("");
  const [note, setNote] = useState("");
  const [nextStep, setNextStep] = useState("");
  const [followUpDate, setFollowUpDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [historySearch, setHistorySearch] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("all");
  const [allDates, setAllDates] = useState(Boolean(linkedLeadId));
  const [leadHistoryFilter, setLeadHistoryFilter] = useState(linkedLeadId);

  const tracking = useQuery({
    queryKey: ["call-tracking", user?.id],
    enabled: Boolean(user?.id),
    queryFn: async () => {
      if (!user) throw new Error("Please sign in.");
      const { data: profile, error: profileError } = await supabase.from("profiles")
        .select("timezone, daily_contact_goal, daily_followup_goal, streak_counts_weekends").eq("user_id", user.id).maybeSingle();
      if (profileError) throw profileError;
      const settings = {
        contactGoal: profile?.daily_contact_goal ?? DEFAULT_GOALS.contactGoal,
        followupGoal: profile?.daily_followup_goal ?? DEFAULT_GOALS.followupGoal,
        weekendsCount: profile?.streak_counts_weekends ?? DEFAULT_GOALS.weekendsCount,
      };
      const timeZone = profile?.timezone || browserTimeZone();
      // Read all pages so long histories are not silently limited to 1,000 records.
      const calls: import("@/integrations/supabase/types").Database["public"]["Tables"]["conversation_logs"]["Row"][] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("conversation_logs").select("*")
          .eq("client_id", user.id).eq("type", "call").eq("direction", "outbound")
          .order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
        if (error) throw error;
        calls.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      const { data: days, error: daysError } = await supabase.rpc("my_goal_day_counts", { p_tz: timeZone, p_days: 120 });
      if (daysError) throw daysError;
      return { calls, settings, timeZone, days: days ?? [] };
    },
  });

  const timeZone = tracking.data?.timeZone || browserTimeZone();
  const today = dateInTimeZone(new Date().toISOString(), timeZone);
  const selectedDay = day || today;
  const selectedCallDate = callDate || today;
  const leads = leadsQuery.data ?? [];
  const selectedLead = leads.find((lead) => lead.id === leadId);
  const blocked = outcome === "do_not_call" || Boolean(selectedLead?.do_not_contact);
  const leadMap = useMemo(() => new Map(leads.map((lead) => [lead.id, lead])), [leads]);
  const calls = tracking.data?.calls ?? [];
  const summary = dailyCallSummary(calls, selectedDay, timeZone);
  const progress = tracking.data?.days.find((d) => d.day === selectedDay);
  const visibleCalls = calls.filter((call) => {
    const lead = leadMap.get(call.lead_id);
    const text = `${lead?.business_name ?? ""} ${lead?.contact_name ?? ""} ${call.content ?? ""} ${call.next_step ?? ""}`.toLowerCase();
    return (!leadHistoryFilter || call.lead_id === leadHistoryFilter) && (allDates || trackedCallDate(call, timeZone) === selectedDay) && (outcomeFilter === "all" || call.outcome === outcomeFilter) && text.includes(historySearch.toLowerCase());
  }).sort((a, b) => trackedCallDate(b, timeZone).localeCompare(trackedCallDate(a, timeZone)) || b.created_at.localeCompare(a.created_at));
  const filteredLeads = leads.filter((lead) => `${lead.business_name} ${lead.contact_name ?? ""} ${lead.city ?? ""}`.toLowerCase().includes(leadSearch.toLowerCase()));

  const shiftDay = (offset: number) => {
    const date = new Date(`${selectedDay}T12:00:00Z`);
    date.setUTCDate(date.getUTCDate() + offset);
    setDay(date.toISOString().slice(0, 10));
  };

  const save = async () => {
    if (!outcome || !leadId || saving) return;
    const validation = validateTrackedCall(selectedCallDate, today, followUpDate, blocked);
    if (validation) return toast.error(validation);
    setSaving(true);
    try {
      const { error } = await supabase.rpc("log_tracked_call", {
        p_lead_id: leadId, p_outcome: outcome, p_call_date: selectedCallDate,
        p_note: note.trim() || undefined, p_next_step: nextStep.trim() || undefined,
        p_follow_up_date: blocked ? undefined : followUpDate || undefined,
      });
      if (error) throw error;
      setDay(selectedCallDate);
      setAllDates(false);
      setNote(""); setNextStep(""); setFollowUpDate(""); setOutcome(null);
      notifyGoalsChanged();
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["call-tracking", user?.id] }),
        queryClient.invalidateQueries({ queryKey: leadsQueryKey(user?.id) }),
      ]);
      toast.success(blocked ? "Call logged. No follow-up scheduled." : followUpDate ? "Call logged and follow-up scheduled." : "Call logged.");
    } catch {
      toast.error("Couldn't save the call. Please try again.");
    } finally { setSaving(false); }
  };

  if (leadsQuery.isLoading || tracking.isLoading) return <DataPageSkeleton />;
  if (leadsQuery.isError || tracking.isError) return (
    <DashboardLayout><h1 className="text-2xl font-semibold">Call Tracking</h1><p className="my-4 text-sm text-destructive">Couldn't load your calls and daily progress.</p>
      <Button variant="outline" onClick={() => { leadsQuery.refetch(); tracking.refetch(); }}>Try again</Button>
    </DashboardLayout>
  );

  return (
    <DashboardLayout>
      <div className="space-y-7">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="flex items-center gap-2 text-2xl font-semibold"><PhoneCall className="h-6 w-6 text-primary" />Call Tracking</h1>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="min-h-11"><Link to="/dashboard/pipeline">Lead Pipeline<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" className="min-h-11"><Link to="/dashboard/follow-ups">Follow-Ups<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
            <Button asChild variant="outline" className="min-h-11"><Link to="/dashboard/leads">My Leads<ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </header>

        <section className="space-y-4 border-b border-border pb-6" aria-labelledby="daily-progress-title">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div><h2 id="daily-progress-title" className="text-lg font-semibold">Daily progress</h2><p className="text-xs text-muted-foreground">{timeZone.replace(/_/g, " ")}</p></div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" className="h-11 w-11" onClick={() => shiftDay(-1)} aria-label="Previous day"><ArrowLeft className="h-4 w-4" /></Button>
              <Input aria-label="Progress date" type="date" className="h-11 w-40" value={selectedDay} max={today} onChange={(e) => setDay(e.target.value)} />
              <Button variant="ghost" size="icon" className="h-11 w-11" disabled={selectedDay >= today} onClick={() => shiftDay(1)} aria-label="Next day"><ArrowRight className="h-4 w-4" /></Button>
              <Button variant="outline" className="min-h-11" onClick={() => setDay(today)}>Today</Button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[{ label: "Calls logged", n: summary.calls }, { label: "Leads called", n: summary.leads }, { label: "Conversations", n: summary.conversations }, { label: "Appointments set", n: summary.appointments }].map((stat) => (
              <div key={stat.label} className="border-l-2 border-border pl-3"><p className="text-xs text-muted-foreground">{stat.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{stat.n}</p></div>
            ))}
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {[
              { label: "Daily contacted goal", value: progress?.contacted ?? summary.leads, goal: tracking.data?.settings.contactGoal ?? 10 },
              { label: "Follow-ups completed", value: progress?.followups ?? 0, goal: tracking.data?.settings.followupGoal ?? 5 },
            ].map((item) => <div key={item.label} className="space-y-2"><div className="flex justify-between gap-2 text-sm"><span>{item.label}</span><span className="flex items-center gap-1 tabular-nums">{item.value} / {item.goal}{item.value >= item.goal && <Check className="h-4 w-4 text-primary" />}</span></div><Progress value={Math.min(100, item.goal > 0 ? item.value / item.goal * 100 : 0)} /></div>)}
          </div>
        </section>

        <section aria-labelledby="log-call-title" className="space-y-4">
          <h2 id="log-call-title" className="text-lg font-semibold">Log a call</h2>
          {leads.length === 0 ? <div className="space-y-3 py-4"><p className="text-sm text-muted-foreground">No saved leads yet.</p><Button asChild className="min-h-11"><Link to="/dashboard/scraper?tab=real-estate">Find Owners</Link></Button></div> : (
            <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); save(); }}>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="lead-search">Lead</Label><Input id="lead-search" className="h-11" placeholder="Search address or owner" value={leadSearch} onChange={(e) => setLeadSearch(e.target.value)} />
                  <Select value={leadId} onValueChange={setLeadId}><SelectTrigger aria-label="Select lead" className="h-11"><SelectValue placeholder="Select a lead" /></SelectTrigger><SelectContent position="popper">{filteredLeads.map((lead) => <SelectItem className="min-h-11" value={lead.id} key={lead.id}>{lead.business_name}{lead.contact_name ? ` · ${lead.contact_name}` : ""}</SelectItem>)}{filteredLeads.length === 0 && <p className="p-3 text-sm text-muted-foreground">No matching leads</p>}</SelectContent></Select>
                </div>
                <div className="space-y-2"><Label htmlFor="call-date">Call date</Label><Input id="call-date" type="date" required max={today} className="h-11" value={selectedCallDate} onChange={(e) => setCallDate(e.target.value)} /></div>
              </div>
              <fieldset className="space-y-2"><legend className="mb-2 text-sm font-medium">Outcome</legend><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">{OUTCOMES.map((item) => <Button type="button" key={item.key} variant={outcome === item.key ? "default" : "outline"} className="min-h-11 whitespace-normal" aria-pressed={outcome === item.key} onClick={() => setOutcome(item.key)}>{item.label}</Button>)}</div></fieldset>
              {blocked && <p className="text-sm text-destructive">Do not contact. No follow-up will be scheduled.</p>}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2"><Label htmlFor="next-step">Next step</Label><Input id="next-step" placeholder="e.g. Call about their timeline" className="h-11" value={blocked ? "Do not contact" : nextStep} disabled={blocked} onChange={(e) => setNextStep(e.target.value)} maxLength={1000} /></div>
                <div className="space-y-2"><Label htmlFor="follow-up-date">Follow-up date (optional)</Label><Input id="follow-up-date" className="h-11" type="date" min={selectedCallDate} disabled={blocked} value={blocked ? "" : followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} /></div>
              </div>
              <div className="space-y-2"><Label htmlFor="call-notes">Notes (optional)</Label><Textarea id="call-notes" rows={2} value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
              <Button type="submit" className="min-h-11" disabled={!leadId || !outcome || saving}><Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save call"}</Button>
            </form>
          )}
        </section>

        <section aria-labelledby="call-history-title" className="space-y-4 border-t border-border pt-6">
          {leadHistoryFilter && <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{leadMap.get(leadHistoryFilter)?.business_name || "Selected lead"}</Badge><Button variant="ghost" className="min-h-11" onClick={() => setLeadHistoryFilter("")}>Show all leads</Button></div>}
          <div className="flex flex-wrap items-center justify-between gap-3"><h2 id="call-history-title" className="text-lg font-semibold">Call history <span className="ml-1 text-sm font-normal text-muted-foreground">{visibleCalls.length}</span></h2><Button variant="outline" className="min-h-11" onClick={() => setAllDates(!allDates)}>{allDates ? "Selected day" : "All dates"}</Button></div>
          <div className="grid gap-2 sm:grid-cols-[1fr_200px]"><Input aria-label="Search call history" className="h-11" placeholder="Search calls" value={historySearch} onChange={(e) => setHistorySearch(e.target.value)} /><Select value={outcomeFilter} onValueChange={setOutcomeFilter}><SelectTrigger aria-label="Filter outcomes" className="h-11"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All outcomes</SelectItem>{OUTCOMES.map((item) => <SelectItem key={item.key} value={item.key}>{item.label}</SelectItem>)}</SelectContent></Select></div>
          {visibleCalls.length === 0 ? <p className="py-8 text-center text-sm text-muted-foreground">{calls.length === 0 ? "No calls logged yet." : "No calls match these filters."}</p> : <div className="divide-y divide-border">{visibleCalls.map((call) => {
            const lead = leadMap.get(call.lead_id);
            const label = OUTCOMES.find((item) => item.key === call.outcome)?.label || call.outcome || "Call logged";
            return <article key={call.id} className="grid gap-3 py-4 md:grid-cols-[minmax(0,1fr)_160px_minmax(0,1fr)]">
              <div className="min-w-0"><Link to={`/dashboard/leads/${call.lead_id}`} className="font-medium text-primary hover:underline break-words">{lead?.business_name || "Lead unavailable"}</Link>{lead?.contact_name && <p className="text-sm text-muted-foreground">{lead.contact_name}</p>}<p className="mt-1 text-xs text-muted-foreground">{prettyDate(trackedCallDate(call, timeZone))} · {trackedCallDate(call, timeZone).slice(0, 4)}</p></div>
              <div><Badge variant={call.outcome === "do_not_call" ? "destructive" : "secondary"}>{label}</Badge></div>
              <div className="min-w-0 space-y-1 text-sm break-words">{call.next_step && <p><span className="font-medium">Next: </span>{call.next_step}</p>}{call.follow_up_date && <p className="text-xs text-muted-foreground">Follow-up: {prettyDate(call.follow_up_date)}</p>}{call.content && <p className="whitespace-pre-wrap text-muted-foreground">{call.content}</p>}{!call.next_step && !call.content && <p className="text-muted-foreground">No next step recorded</p>}</div>
            </article>;
          })}</div>}
        </section>
      </div>
    </DashboardLayout>
  );
}