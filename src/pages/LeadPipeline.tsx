import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Kanban, PhoneCall, Search } from "lucide-react";
import { toast } from "sonner";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import DataPageSkeleton from "@/components/dashboard/DataPageSkeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ListingSignedDialog } from "@/components/leads/ListingSignedDialog";
import { useAuth } from "@/hooks/useAuth";
import { leadsQueryKey, useLeadsData, type AppLead } from "@/hooks/useLeadsData";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { LEAD_STAGES, latestPipelineCall, nextPipelineFollowUp } from "@/lib/leadPipeline";
import { OUTCOMES } from "@/lib/playbook";
import { prettyDate } from "@/lib/followUps";

export default function LeadPipeline() {
  const { user } = useAuth();
  const client = useQueryClient();
  const leadsQuery = useLeadsData(user?.id);
  const [search, setSearch] = useState("");
  const [stage, setStage] = useState("all");
  const [saving, setSaving] = useState<string | null>(null);
  const [signedId, setSignedId] = useState<string | null>(null);
  const activity = useQuery({
    queryKey: ["lead-pipeline-activity", user?.id], enabled: Boolean(user),
    queryFn: async () => {
      if (!user) throw new Error("Please sign in.");
      const followUps: Database["public"]["Tables"]["lead_follow_ups"]["Row"][] = [];
      const calls: Database["public"]["Tables"]["conversation_logs"]["Row"][] = [];
      await Promise.all([
        (async () => { for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from("lead_follow_ups").select("*").eq("user_id", user.id).is("done_at", null).order("due_date").order("id").range(offset, offset + 999);
          if (error) throw error; followUps.push(...(data ?? [])); if (!data || data.length < 1000) break;
        } })(),
        (async () => { for (let offset = 0; ; offset += 1000) {
          const { data, error } = await supabase.from("conversation_logs").select("*").eq("client_id", user.id).eq("type", "call").eq("direction", "outbound").order("created_at", { ascending: false }).order("id").range(offset, offset + 999);
          if (error) throw error; calls.push(...(data ?? [])); if (!data || data.length < 1000) break;
        } })(),
      ]);
      return { followUps, calls };
    },
  });
  const leads = leadsQuery.data ?? [];
  const visible = leads.filter((lead) => (stage === "all" || lead.status === stage) && `${lead.business_name} ${lead.contact_name ?? ""} ${lead.city ?? ""}`.toLowerCase().includes(search.toLowerCase()));
  const stages = LEAD_STAGES.filter((s) => !["qualified", "converted"].includes(s.value) || leads.some((l) => l.status === s.value));
  const updateStatus = async (lead: AppLead, status: AppLead["status"]) => {
    if (saving || lead.status === status) return;
    setSaving(lead.id);
    const { error } = await supabase.from("leads").update({ status }).eq("id", lead.id);
    setSaving(null);
    if (error) return toast.error("Couldn't update the lead status.");
    await client.invalidateQueries({ queryKey: leadsQueryKey(user?.id) });
    if (status === "listing_signed") setSignedId(lead.id);
    toast.success("Lead status updated.");
  };
  if (leadsQuery.isLoading || activity.isLoading) return <DataPageSkeleton />;
  if (leadsQuery.isError || activity.isError) return <DashboardLayout><h1 className="text-2xl font-semibold">Lead Pipeline</h1><p className="my-4 text-destructive">Couldn't load your pipeline.</p><Button variant="outline" onClick={() => { void leadsQuery.refetch(); void activity.refetch(); }}>Try again</Button></DashboardLayout>;
  return <DashboardLayout fullWidth>
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="flex items-center gap-2 text-2xl font-semibold"><Kanban className="h-6 w-6 text-primary" />Lead Pipeline</h1>
        <div className="flex flex-wrap gap-2"><Button asChild variant="outline" className="min-h-11"><Link to="/dashboard/call-tracking"><PhoneCall className="mr-2 h-4 w-4" />Call Tracking</Link></Button><Button asChild variant="outline" className="min-h-11"><Link to="/dashboard/follow-ups"><CalendarClock className="mr-2 h-4 w-4" />Follow-Ups</Link></Button></div>
      </header>
      <section className="grid grid-cols-2 gap-4 border-b border-border pb-6 sm:grid-cols-3 lg:grid-cols-6" aria-label="Pipeline totals">
        <div><p className="text-xs text-muted-foreground">Total leads</p><p className="mt-1 text-3xl font-semibold tabular-nums">{leads.length}</p></div>
        {stages.map((s) => <div key={s.value}><p className="text-xs text-muted-foreground">{s.label}</p><p className="mt-1 text-3xl font-semibold tabular-nums">{leads.filter((l) => l.status === s.value).length}</p></div>)}
      </section>
      <div className="grid gap-3 sm:grid-cols-[1fr_220px]"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-muted-foreground" /><Input aria-label="Search pipeline" placeholder="Search address or owner" className="h-11 pl-9" value={search} onChange={(e) => setSearch(e.target.value)} /></div><Select value={stage} onValueChange={setStage}><SelectTrigger className="h-11" aria-label="Filter pipeline status"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All statuses</SelectItem>{stages.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select></div>
      {visible.length === 0 ? <div className="space-y-3 py-12 text-center"><p className="text-muted-foreground">{leads.length ? "No leads match these filters." : "No saved leads yet."}</p>{!leads.length && <Button asChild><Link to="/dashboard/scraper?tab=real-estate">Find Owners</Link></Button>}</div> : <section className="divide-y divide-border" aria-label="Lead pipeline">
        <div className="hidden gap-4 pb-3 text-xs font-medium text-muted-foreground lg:grid lg:grid-cols-[minmax(0,1.5fr)_180px_minmax(0,1fr)_minmax(0,1fr)_140px]"><span>Listing / lead</span><span>Status</span><span>Last call</span><span>Next follow-up</span><span>Call Tracking</span></div>
        {visible.map((lead) => {
          const followUp = nextPipelineFollowUp(activity.data?.followUps ?? [], lead.id);
          const call = latestPipelineCall(activity.data?.calls ?? [], lead.id);
          return <article key={lead.id} className="grid gap-4 py-5 lg:grid-cols-[minmax(0,1.5fr)_180px_minmax(0,1fr)_minmax(0,1fr)_140px]">
            <div className="min-w-0 space-y-1"><Link to={`/dashboard/leads/${lead.id}`} className="break-words font-medium text-primary hover:underline">{lead.business_name}</Link>{lead.contact_name && <p className="text-sm text-muted-foreground">{lead.contact_name}</p>}<div className="flex flex-wrap gap-1">{lead.listing_type && <Badge variant="outline">{lead.listing_type === "fsbo" ? "Selling" : "Renting"}</Badge>}{lead.do_not_contact && <Badge variant="destructive">Do not contact</Badge>}</div>{lead.list_price != null && <p className="text-sm">${lead.list_price.toLocaleString()}</p>}</div>
            <Select value={lead.status} disabled={saving !== null} onValueChange={(value) => { const s = LEAD_STAGES.find((item) => item.value === value); if (s) void updateStatus(lead, s.value); }}><SelectTrigger className="h-11" aria-label={`Status for ${lead.business_name}`}><SelectValue /></SelectTrigger><SelectContent>{LEAD_STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent></Select>
            <div className="min-w-0 space-y-1 text-sm"><p className="text-xs text-muted-foreground lg:hidden">Last call</p>{call ? <><p>{OUTCOMES.find((o) => o.key === call.outcome)?.label ?? "Call logged"}</p><p className="text-xs text-muted-foreground">{prettyDate(call.call_date || call.created_at.slice(0, 10))}</p>{call.next_step && <p className="break-words text-muted-foreground">Next: {call.next_step}</p>}</> : <p className="text-muted-foreground">Not called yet</p>}</div>
            <div className="min-w-0 space-y-1 text-sm"><p className="text-xs text-muted-foreground lg:hidden">Next follow-up</p>{lead.do_not_contact ? <p className="text-destructive">Contact blocked</p> : followUp ? <><Link to="/dashboard/follow-ups" className="text-primary hover:underline">{prettyDate(followUp.due_date)}{followUp.channel ? ` · ${followUp.channel}` : ""}</Link>{followUp.note && <p className="break-words text-muted-foreground">{followUp.note}</p>}</> : <p className="text-muted-foreground">None scheduled</p>}</div>
            <Button asChild variant="outline" className="min-h-11"><Link to={`/dashboard/call-tracking?lead=${encodeURIComponent(lead.id)}`}><PhoneCall className="mr-2 h-4 w-4" />View calls</Link></Button>
          </article>;
        })}
      </section>}
    </div>
    <ListingSignedDialog leadId={signedId} onClose={(saved) => { setSignedId(null); if (saved) void client.invalidateQueries({ queryKey: leadsQueryKey(user?.id) }); }} />
  </DashboardLayout>;
}