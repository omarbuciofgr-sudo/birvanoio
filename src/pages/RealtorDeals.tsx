import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useGoogleCalendar, scheduleDealFollowUps, scheduleFollowUpTask } from "@/hooks/useGoogleCalendar";
import IntelTriggerSettings from "@/components/realtor/IntelTriggerSettings";
import IntelSignalPerformance from "@/components/realtor/IntelSignalPerformance";
import { loadIntelSettings } from "@/lib/ownerIntelSettings";
import GuardedContactButton from "@/components/contacts/GuardedContactButton";
import { syncIntelTasksForDeals, readRecentListings } from "@/lib/ownerIntelTasks";
import {
  CalendarPlus,
  CalendarCheck,
  RefreshCw,
  Home,
  Plus,
  Trophy,
  Clock,
  Trash2,
  DollarSign,
  MessageSquare,
  Phone,
  Mail,
  Gift,
  ClipboardCheck,
  Sparkles,
  Check,
  CalendarClock,
  FileText,
  MessageSquareReply,
} from "lucide-react";

export type RealtorDeal = {
  id: string;
  user_id: string;
  client_name: string;
  client_email: string | null;
  client_phone: string | null;
  property_address: string | null;
  stage: string;
  deal_type: string;
  deal_value: number | null;
  commission_pct: number | null;
  commission_flat: number | null;
  source: string | null;
  lease_end_date: string | null;
  tour_at: string | null;
  checklist: Record<string, boolean> | null;
  referral_requested_at: string | null;
  timeline_date: string | null;
  closed_at: string | null;
  calendar_synced_at?: string | null;
  follow_up_at: string | null;
  notes: string | null;
  created_at: string;
};

const STAGES = [
  { id: "new", label: "New client", tone: "bg-muted text-foreground" },
  { id: "touring", label: "Touring", tone: "bg-blue-500/10 text-blue-600 dark:text-blue-400" },
  { id: "timeline", label: "On a timeline", tone: "bg-amber-500/10 text-amber-600 dark:text-amber-400" },
  { id: "offer_sent", label: "Offer sent", tone: "bg-violet-500/10 text-violet-600 dark:text-violet-400" },
  { id: "offer_accepted", label: "Offer accepted", tone: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" },
  { id: "closed", label: "Closed / Leased", tone: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-300" },
  { id: "lost", label: "Lost", tone: "bg-destructive/10 text-destructive" },
] as const;

const ACTIVE_STAGES = STAGES.filter((s) => s.id !== "closed" && s.id !== "lost");

/** Documents that must be collected before a deal can move past each stage. */
const STAGE_DOCS: Record<string, string[]> = {
  new: ["Buyer/renter intake", "Budget confirmed", "Pre-approval or proof of funds"],
  touring: ["Showing agreement signed", "ID on file", "Tour feedback logged"],
  timeline: ["Revisit date set", "Nurture reminder scheduled"],
  offer_sent: ["Application submitted", "Credit / background check", "Earnest money or deposit"],
  offer_accepted: ["Lease or contract signed", "Deposit cleared", "Move-in date confirmed"],
};

const SOURCES = ["FRBO", "FSBO", "Referral", "Sphere", "Open house", "Zillow", "Other"];

const money = (v: number | null | undefined) =>
  typeof v === "number" && v > 0
    ? v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "—";

const addDays = (iso: string, days: number) => {
  const d = new Date(`${iso}T09:00:00`);
  d.setDate(d.getDate() + days);
  return d;
};
const addMonths = (iso: string, months: number) => {
  const d = new Date(`${iso}T09:00:00`);
  d.setMonth(d.getMonth() + months);
  return d;
};
const addYears = (iso: string, years: number) => addMonths(iso, years * 12);

/** Gross commission income for a single deal. */
export function dealGci(deal: Pick<RealtorDeal, "deal_value" | "commission_pct" | "commission_flat">) {
  const flat = Number(deal.commission_flat ?? 0);
  if (flat > 0) return flat;
  const pct = Number(deal.commission_pct ?? 0);
  const value = Number(deal.deal_value ?? 0);
  if (pct > 0 && value > 0) return (value * pct) / 100;
  return 0;
}

/** Build a Google Calendar event link (works with any Gmail account, no setup). */
function googleCalendarUrl(opts: {
  title: string;
  details: string;
  start: Date;
  durationMinutes?: number;
}) {
  const fmt = (d: Date) => d.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const end = new Date(opts.start.getTime() + (opts.durationMinutes ?? 30) * 60000);
  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: opts.title,
    details: opts.details,
    dates: `${fmt(opts.start)}/${fmt(end)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

const emptyForm = {
  client_name: "",
  client_email: "",
  client_phone: "",
  property_address: "",
  stage: "new",
  deal_type: "sale",
  deal_value: "",
  commission_pct: "",
  commission_flat: "",
  source: "FRBO",
  timeline_date: "",
  notes: "",
};

type DealTask = {
  id: string;
  deal_id: string;
  title: string;
  kind: string;
  notes: string | null;
  body?: string | null;
  signal_key?: string | null;
  scheduled_at: string | null;
  completed_at: string | null;
  calendar_event_id?: string | null;
  calendar_synced_at?: string | null;
  outcome?: string | null;
  outcome_at?: string | null;
  created_at: string;
};

const RealtorDeals = () => {
  const { user } = useAuth();
  const [deals, setDeals] = useState<RealtorDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const { status: calendarStatus, connect: connectCalendar } = useGoogleCalendar();
  const [syncingDealId, setSyncingDealId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<DealTask[]>([]);
  const [scanningIntel, setScanningIntel] = useState(false);
  const [schedulingTaskId, setSchedulingTaskId] = useState<string | null>(null);
  const [openScriptId, setOpenScriptId] = useState<string | null>(null);
  const [settingsVersion, setSettingsVersion] = useState(0);


  /** Create the 6-month + 1-year reminders on the user's own Google Calendar. */
  const syncDealToCalendar = useCallback(
    async (dealId: string, opts?: { silent?: boolean }) => {
      setSyncingDealId(dealId);
      try {
        const res = await scheduleDealFollowUps(dealId);
        if (!res?.connected) {
          if (!opts?.silent) {
            toast.info("Connect Google Calendar in Settings to add reminders automatically.");
          }
          return false;
        }
        toast.success("Check-in and anniversary reminders added to your Google Calendar");
        return true;
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Could not add calendar reminders");
        return false;
      } finally {
        setSyncingDealId(null);
      }
    },
    [],
  );

  const load = useCallback(async () => {
    if (!user?.id) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("realtor_deals" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast.error("Could not load deals");
    setDeals(((data as any) ?? []) as RealtorDeal[]);
    setLoading(false);
  }, [user?.id]);

  const loadTasks = useCallback(async () => {
    if (!user?.id) return;
    const { data } = await supabase
      .from("realtor_deal_events" as any)
      .select(
        "id, deal_id, title, kind, notes, body, signal_key, scheduled_at, completed_at, calendar_event_id, calendar_synced_at, outcome, outcome_at, created_at",
      )
      .order("scheduled_at", { ascending: true })
      .limit(300);
    setTasks(((data as any) ?? []) as DealTask[]);
  }, [user?.id]);

  /** Create follow-up steps from listing intel (price drop, stale, re-listed). */
  const scanIntel = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!user?.id || !deals.length) return;
      setScanningIntel(true);
      try {
        const created = await syncIntelTasksForDeals(user.id, deals, readRecentListings(), {
          settings: loadIntelSettings(),
          agentName:
            (user.user_metadata as Record<string, string> | undefined)?.first_name ||
            user.email?.split("@")[0] ||
            null,
        });
        if (created > 0) {
          await loadTasks();
          toast.success(`${created} follow-up step${created === 1 ? "" : "s"} created from listing intel`);
        } else if (!opts?.silent) {
          toast.info("No new listing signals since your last scan.");
        }
      } catch (e) {
        if (!opts?.silent) toast.error(e instanceof Error ? e.message : "Could not create follow-ups");
      } finally {
        setScanningIntel(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [user?.id, deals, loadTasks, settingsVersion],
  );

  const completeTask = async (id: string, outcome?: "replied" | "converted" | "no_reply") => {
    const now = new Date().toISOString();
    setTasks((t) =>
      t.map((x) =>
        x.id === id
          ? { ...x, completed_at: now, outcome: outcome ?? x.outcome ?? null, outcome_at: outcome ? now : x.outcome_at }
          : x,
      ),
    );
    await supabase
      .from("realtor_deal_events" as any)
      .update({
        completed_at: now,
        ...(outcome ? { outcome, outcome_at: now } : {}),
      } as any)
      .eq("id", id);
  };

  /** Put a follow-up on the calendar with reminders attached. */
  const scheduleTask = async (task: DealTask) => {
    setSchedulingTaskId(task.id);
    try {
      const startAt = task.scheduled_at ?? new Date(Date.now() + 3_600_000).toISOString();
      const res = await scheduleFollowUpTask(task.id, startAt);
      if (!res?.connected) {
        toast.error("Connect Google Calendar in Settings to schedule follow-ups.");
        return;
      }
      setTasks((t) =>
        t.map((x) =>
          x.id === task.id
            ? { ...x, calendar_event_id: res.eventId ?? x.calendar_event_id, calendar_synced_at: new Date().toISOString(), scheduled_at: res.startAt ?? x.scheduled_at }
            : x,
        ),
      );
      toast.success("Added to your calendar with reminders");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not schedule this follow-up");
    } finally {
      setSchedulingTaskId(null);
    }
  };


  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  // Auto-create follow-ups whenever the deal list changes — no manual work needed.
  useEffect(() => {
    if (!deals.length) return;
    scanIntel({ silent: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deals.length, user?.id]);

  const active = useMemo(
    () => deals.filter((d) => d.stage !== "closed" && d.stage !== "lost"),
    [deals],
  );
  const closed = useMemo(() => deals.filter((d) => d.stage === "closed"), [deals]);

  const createDeal = async () => {
    if (!user?.id) return;
    if (!form.client_name.trim()) {
      toast.error("Client name is required");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("realtor_deals" as any).insert({
      user_id: user.id,
      client_name: form.client_name.trim(),
      client_email: form.client_email.trim() || null,
      client_phone: form.client_phone.trim() || null,
      property_address: form.property_address.trim() || null,
      stage: form.stage,
      deal_type: form.deal_type,
      deal_value: form.deal_value ? Number(form.deal_value) : 0,
      commission_pct: form.commission_pct ? Number(form.commission_pct) : null,
      commission_flat: form.commission_flat ? Number(form.commission_flat) : null,
      source: form.source || null,
      timeline_date: form.timeline_date || null,
      notes: form.notes.trim() || null,
    } as any);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Deal added");
    setForm({ ...emptyForm });
    setDialogOpen(false);
    load();
  };

  const updateDeal = async (id: string, patch: Partial<RealtorDeal>) => {
    setDeals((prev) => prev.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    const { error } = await supabase
      .from("realtor_deals" as any)
      .update(patch as any)
      .eq("id", id);
    if (error) {
      toast.error(error.message);
      load();
    }
  };

  const removeDeal = async (id: string) => {
    const { error } = await supabase.from("realtor_deals" as any).delete().eq("id", id);
    if (error) return toast.error(error.message);
    setDeals((prev) => prev.filter((d) => d.id !== id));
    toast.success("Deal removed");
  };

  const markClosed = async (deal: RealtorDeal) => {
    const today = new Date().toISOString().slice(0, 10);
    updateDeal(deal.id, { stage: "closed", closed_at: today });
    toast.success(`${deal.client_name} marked as closed`);
    if (calendarStatus.connected) {
      await syncDealToCalendar(deal.id, { silent: true });
    }
  };

  const toggleDoc = (deal: RealtorDeal, doc: string, checked: boolean) => {
    const next = { ...(deal.checklist ?? {}), [doc]: checked };
    updateDeal(deal.id, { checklist: next });
  };

  const pipelineValue = active.reduce((sum, d) => sum + Number(d.deal_value ?? 0), 0);
  const closedValue = closed.reduce((sum, d) => sum + Number(d.deal_value ?? 0), 0);
  const pipelineGci = active.reduce((sum, d) => sum + dealGci(d), 0);
  const closedGci = closed.reduce((sum, d) => sum + dealGci(d), 0);

  /* ---------------- Reporting ---------------- */

  const report = useMemo(() => {
    const reached = (stages: string[]) =>
      deals.filter((d) => stages.includes(d.stage)).length;
    const toured = deals.filter((d) =>
      ["touring", "timeline", "offer_sent", "offer_accepted", "closed"].includes(d.stage),
    ).length;
    const offers = deals.filter((d) =>
      ["offer_sent", "offer_accepted", "closed"].includes(d.stage),
    ).length;
    const closes = closed.length;

    const daysToClose = closed
      .filter((d) => d.closed_at)
      .map((d) => {
        const start = new Date(d.created_at).getTime();
        const end = new Date(`${d.closed_at}T12:00:00`).getTime();
        return Math.max(0, Math.round((end - start) / 86400000));
      });
    const avgDays = daysToClose.length
      ? Math.round(daysToClose.reduce((a, b) => a + b, 0) / daysToClose.length)
      : null;

    const bySource = new Map<
      string,
      { source: string; total: number; closed: number; gci: number }
    >();
    for (const d of deals) {
      const key = d.source || "Unspecified";
      const row = bySource.get(key) ?? { source: key, total: 0, closed: 0, gci: 0 };
      row.total += 1;
      if (d.stage === "closed") {
        row.closed += 1;
        row.gci += dealGci(d);
      }
      bySource.set(key, row);
    }

    return {
      funnel: [
        { label: "Leads", value: deals.length },
        { label: "Toured", value: toured },
        { label: "Offers", value: offers },
        { label: "Closed", value: closes },
      ],
      lost: reached(["lost"]),
      avgDays,
      sources: [...bySource.values()].sort((a, b) => b.gci - a.gci || b.total - a.total),
    };
  }, [deals, closed]);

  /* ---------------- Deal card ---------------- */

  const DealCard = ({ deal }: { deal: RealtorDeal }) => {
    const docs = STAGE_DOCS[deal.stage] ?? [];
    const checked = deal.checklist ?? {};
    const doneCount = docs.filter((d) => checked[d]).length;
    const gci = dealGci(deal);

    return (
      <div className="rounded-lg border border-border/60 bg-card p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{deal.client_name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {deal.property_address || "No property yet"}
            </p>
          </div>
          <Badge variant="outline" className="text-[10px] capitalize shrink-0">
            {deal.deal_type}
          </Badge>
        </div>

        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {money(Number(deal.deal_value ?? 0))}
          </span>
          {gci > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              GCI {money(gci)}
            </Badge>
          )}
          {deal.source && (
            <Badge variant="outline" className="text-[10px]">
              {deal.source}
            </Badge>
          )}
          {deal.timeline_date && (
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {new Date(deal.timeline_date).toLocaleDateString()}
            </span>
          )}
        </div>

        {(() => {
          const open = tasks.filter((t) => t.deal_id === deal.id && !t.completed_at).slice(0, 3);
          if (!open.length) return null;
          return (
            <div className="rounded-md border border-primary/30 bg-primary/5 p-2 space-y-1.5">
              <p className="text-[10px] uppercase tracking-wide font-semibold text-primary flex items-center gap-1">
                <Sparkles className="h-3 w-3" /> Suggested follow-ups
              </p>
              {open.map((t) => (
                <div key={t.id} className="flex items-start gap-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-5 w-5 shrink-0 mt-0.5"
                    title="Mark done"
                    onClick={() => completeTask(t.id)}
                  >
                    <Check className="h-3 w-3" />
                  </Button>
                  <div className="min-w-0">
                    <p className="text-xs leading-snug">{t.title}</p>
                    {t.scheduled_at && (
                      <p className="text-[10px] text-muted-foreground">
                        Due {new Date(t.scheduled_at).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* Quick contact — realtors live on text and calls */}
        <div className="flex items-center gap-1">
          {deal.client_phone && (
            <>
              <GuardedContactButton
                value={deal.client_phone}
                type="phone"
                channel="call"
                href={`tel:${deal.client_phone}`}
                label="Call"
                contactName={deal.client_name}
                icon={<Phone className="h-3 w-3" />}
              />
              <GuardedContactButton
                value={deal.client_phone}
                type="phone"
                channel="text"
                href={`sms:${deal.client_phone}`}
                label="Text"
                contactName={deal.client_name}
                icon={<MessageSquare className="h-3 w-3" />}
              />
            </>
          )}
          {deal.client_email && (
            <GuardedContactButton
              value={deal.client_email}
              type="email"
              channel="email"
              href={`mailto:${deal.client_email}`}
              label="Email"
              contactName={deal.client_name}
              icon={<Mail className="h-3 w-3" />}
            />
          )}
        </div>

        <div className="flex items-center gap-2">
          <Select value={deal.stage} onValueChange={(v) => updateDeal(deal.id, { stage: v })}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent position="popper" className="z-[9999]">
              {STAGES.map((s) => (
                <SelectItem key={s.id} value={s.id} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={() => markClosed(deal)}>
            Close
          </Button>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-muted-foreground"
            onClick={() => removeDeal(deal.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Tour scheduler */}
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Showing / tour</Label>
          <Input
            type="datetime-local"
            className="h-8 text-xs"
            value={deal.tour_at ? deal.tour_at.slice(0, 16) : ""}
            onChange={(e) =>
              updateDeal(deal.id, {
                tour_at: e.target.value ? new Date(e.target.value).toISOString() : null,
              })
            }
          />
          {deal.tour_at && (
            <Button size="sm" variant="ghost" className="h-7 w-full text-[11px] gap-1" asChild>
              <a
                href={googleCalendarUrl({
                  title: `Showing — ${deal.client_name}`,
                  details: `Tour at ${deal.property_address || "TBD"}. ${
                    deal.client_phone ?? ""
                  }`.trim(),
                  start: new Date(deal.tour_at),
                  durationMinutes: 45,
                })}
                target="_blank"
                rel="noreferrer"
              >
                <CalendarPlus className="h-3 w-3" /> Add tour to calendar
              </a>
            </Button>
          )}
        </div>

        {deal.stage === "timeline" && (
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Revisit on</Label>
            <Input
              type="date"
              className="h-8 text-xs"
              value={deal.timeline_date ?? ""}
              onChange={(e) => updateDeal(deal.id, { timeline_date: e.target.value || null })}
            />
            {deal.timeline_date && (
              <Button size="sm" variant="ghost" className="h-7 w-full text-[11px] gap-1" asChild>
                <a
                  href={googleCalendarUrl({
                    title: `Reconnect with ${deal.client_name}`,
                    details: `They asked to revisit around this date. ${
                      deal.property_address ?? ""
                    }`.trim(),
                    start: addDays(deal.timeline_date, 0),
                  })}
                  target="_blank"
                  rel="noreferrer"
                >
                  <CalendarPlus className="h-3 w-3" /> Schedule nurture reminder
                </a>
              </Button>
            )}
          </div>
        )}

        {docs.length > 0 && (
          <div className="space-y-1 pt-1 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
              <ClipboardCheck className="h-3 w-3" />
              Required to advance ({doneCount}/{docs.length})
            </p>
            {docs.map((doc) => (
              <label key={doc} className="flex items-center gap-2 text-[11px] cursor-pointer">
                <Checkbox
                  checked={!!checked[doc]}
                  onCheckedChange={(v) => toggleDoc(deal, doc, v === true)}
                  className="h-3.5 w-3.5"
                />
                <span className={checked[doc] ? "line-through text-muted-foreground" : ""}>
                  {doc}
                </span>
              </label>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">Deals</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              Track buyers and renters from first tour to closing, then stay in touch after.
            </p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="h-8 text-xs gap-1.5">
                <Plus className="h-3.5 w-3.5" /> New deal
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>New deal</DialogTitle>
              </DialogHeader>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Client name</Label>
                  <Input
                    value={form.client_name}
                    onChange={(e) => setForm({ ...form, client_name: e.target.value })}
                    placeholder="Jane Doe"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Email</Label>
                  <Input
                    value={form.client_email}
                    onChange={(e) => setForm({ ...form, client_email: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Phone</Label>
                  <Input
                    value={form.client_phone}
                    onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Property / area</Label>
                  <Input
                    value={form.property_address}
                    onChange={(e) => setForm({ ...form, property_address: e.target.value })}
                    placeholder="1234 W Chicago Ave, Unit 2"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Stage</Label>
                  <Select value={form.stage} onValueChange={(v) => setForm({ ...form, stage: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]">
                      {STAGES.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Type</Label>
                  <Select
                    value={form.deal_type}
                    onValueChange={(v) => setForm({ ...form, deal_type: v })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]">
                      <SelectItem value="sale">Sale</SelectItem>
                      <SelectItem value="lease">Lease</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Value (price or annual rent)</Label>
                  <Input
                    type="number"
                    value={form.deal_value}
                    onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Commission %</Label>
                  <Input
                    type="number"
                    step="0.1"
                    placeholder="2.5"
                    value={form.commission_pct}
                    onChange={(e) => setForm({ ...form, commission_pct: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Flat fee (overrides %)</Label>
                  <Input
                    type="number"
                    value={form.commission_flat}
                    onChange={(e) => setForm({ ...form, commission_flat: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Source</Label>
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent position="popper" className="z-[9999]">
                      {SOURCES.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Timeline / revisit date</Label>
                  <Input
                    type="date"
                    value={form.timeline_date}
                    onChange={(e) => setForm({ ...form, timeline_date: e.target.value })}
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <Label className="text-xs">Notes</Label>
                  <Textarea
                    rows={3}
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={createDeal} disabled={saving}>
                  {saving ? "Saving…" : "Add deal"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {[
            { label: "Active deals", value: String(active.length), icon: Home },
            { label: "Pipeline value", value: money(pipelineValue), icon: DollarSign },
            { label: "Projected GCI", value: money(pipelineGci), icon: DollarSign },
            { label: "Closed clients", value: String(closed.length), icon: Trophy },
            { label: "Closed GCI", value: money(closedGci), icon: Trophy },
          ].map((s) => (
            <Card key={s.label} className="border-border/60">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <s.icon className="h-3.5 w-3.5" />
                  {s.label}
                </div>
                <p className="text-lg font-semibold mt-1">{s.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <Tabs defaultValue="board" className="space-y-4">
          <TabsList className="h-9">
            <TabsTrigger value="board" className="text-xs">
              Active deals
            </TabsTrigger>
            <TabsTrigger value="closed" className="text-xs">
              Closed clients
            </TabsTrigger>
            <TabsTrigger value="report" className="text-xs">
              Reporting
            </TabsTrigger>
          </TabsList>

          <TabsContent value="board" className="mt-0">
            {loading ? (
              <p className="text-sm text-muted-foreground">Loading deals…</p>
            ) : active.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center space-y-2">
                  <Home className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">No active deals yet</p>
                  <p className="text-xs text-muted-foreground">
                    Add a client you're touring with, or convert a lead from Brivano Scout.
                  </p>
                </CardContent>
              </Card>
            ) : (
              <div className="-mx-1 overflow-x-auto px-1 pb-2">
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 xl:min-w-[1100px]">
                  {ACTIVE_STAGES.map((stage) => {
                    const items = active.filter((d) => d.stage === stage.id);
                    const stageGci = items.reduce((sum, d) => sum + dealGci(d), 0);
                    return (
                      <div key={stage.id} className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span
                            className={`text-[11px] font-medium px-2 py-1 rounded-md ${stage.tone}`}
                          >
                            {stage.label}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {items.length}
                            {stageGci > 0 ? ` · ${money(stageGci)}` : ""}
                          </span>
                        </div>
                        <div className="space-y-2">
                          {items.map((deal) => (
                            <DealCard key={deal.id} deal={deal} />
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="closed" className="mt-0 space-y-3">
            {closed.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center space-y-2">
                  <Trophy className="h-6 w-6 mx-auto text-muted-foreground" />
                  <p className="text-sm font-medium">No closed clients yet</p>
                  <p className="text-xs text-muted-foreground">
                    Mark a deal as closed to start tracking anniversaries and referrals.
                  </p>
                </CardContent>
              </Card>
            ) : (
              closed.map((deal) => {
                const closedOn = deal.closed_at ?? deal.created_at.slice(0, 10);
                const touchpoints: { label: string; start: Date; details: string }[] = [
                  {
                    label: "Move-in check (14 days)",
                    start: addDays(closedOn, 14),
                    details: `Make sure ${deal.client_name} is settled in ${
                      deal.property_address || "their new place"
                    }.`,
                  },
                  {
                    label: "Referral ask (30 days)",
                    start: addDays(closedOn, 30),
                    details: `Ask ${deal.client_name} for a referral or review while the experience is fresh.`,
                  },
                  {
                    label: "6-month check-in",
                    start: addMonths(closedOn, 6),
                    details: `Follow-up check-in for ${deal.property_address || "their property"}.`,
                  },
                  {
                    label: "1-year anniversary gift",
                    start: addYears(closedOn, 1),
                    details: `Send a happy 1-year gift and ask for referrals. ${
                      deal.property_address ?? ""
                    }`.trim(),
                  },
                ];
                if (deal.lease_end_date) {
                  touchpoints.splice(3, 0, {
                    label: "Lease renewal window (60 days out)",
                    start: addDays(deal.lease_end_date, -60),
                    details: `Lease at ${
                      deal.property_address || "their unit"
                    } ends ${deal.lease_end_date}. Start the renewal or next-move conversation.`,
                  });
                }

                return (
                  <Card key={deal.id} className="border-border/60">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm flex items-center justify-between gap-2">
                        <span className="truncate">{deal.client_name}</span>
                        <div className="flex items-center gap-1.5">
                          {dealGci(deal) > 0 && (
                            <Badge variant="secondary" className="text-[10px]">
                              GCI {money(dealGci(deal))}
                            </Badge>
                          )}
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {deal.deal_type === "lease" ? "Leased" : "Closed"}
                          </Badge>
                        </div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-4 text-xs text-muted-foreground">
                        <div>
                          <p className="text-[10px] uppercase tracking-wide">Property</p>
                          <p className="text-foreground">{deal.property_address || "—"}</p>
                        </div>
                        <div>
                          <p className="text-[10px] uppercase tracking-wide">Value</p>
                          <p className="text-foreground">{money(Number(deal.deal_value ?? 0))}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide">Closed / leased on</p>
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            value={deal.closed_at ?? ""}
                            onChange={(e) =>
                              updateDeal(deal.id, { closed_at: e.target.value || null })
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] uppercase tracking-wide">Lease ends</p>
                          <Input
                            type="date"
                            className="h-8 text-xs"
                            value={deal.lease_end_date ?? ""}
                            onChange={(e) =>
                              updateDeal(deal.id, { lease_end_date: e.target.value || null })
                            }
                          />
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {touchpoints.map((tp) => (
                          <Button
                            key={tp.label}
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            asChild
                          >
                            <a
                              href={googleCalendarUrl({
                                title: `${tp.label.split(" (")[0]} — ${deal.client_name}`,
                                details: `${tp.details} Added from Brivano.`,
                                start: tp.start,
                              })}
                              target="_blank"
                              rel="noreferrer"
                            >
                              <CalendarPlus className="h-3.5 w-3.5" /> {tp.label}
                            </a>
                          </Button>
                        ))}
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        {calendarStatus.connected ? (
                          <Button
                            size="sm"
                            className="h-8 text-xs gap-1.5"
                            disabled={syncingDealId === deal.id}
                            onClick={() => syncDealToCalendar(deal.id)}
                          >
                            {syncingDealId === deal.id ? (
                              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <CalendarCheck className="h-3.5 w-3.5" />
                            )}
                            {deal.calendar_synced_at ? "Re-sync reminders" : "Add both to my calendar"}
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="h-8 text-xs gap-1.5"
                            onClick={() =>
                              connectCalendar().catch((e) =>
                                toast.error(e instanceof Error ? e.message : "Connection failed"),
                              )
                            }
                          >
                            <CalendarCheck className="h-3.5 w-3.5" /> Connect Google Calendar
                          </Button>
                        )}

                        {deal.referral_requested_at ? (
                          <Badge variant="secondary" className="text-[10px] gap-1">
                            <Gift className="h-3 w-3" /> Referral asked{" "}
                            {new Date(deal.referral_requested_at).toLocaleDateString()}
                          </Badge>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 text-xs gap-1.5"
                            onClick={() =>
                              updateDeal(deal.id, {
                                referral_requested_at: new Date().toISOString(),
                              })
                            }
                          >
                            <Gift className="h-3.5 w-3.5" /> Mark referral asked
                          </Button>
                        )}

                        {deal.client_phone && (
                          <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" asChild>
                            <a href={`sms:${deal.client_phone}`}>
                              <MessageSquare className="h-3.5 w-3.5" /> Text
                            </a>
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="report" className="mt-0 space-y-4">
            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Conversion funnel</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {report.funnel.map((step, i) => {
                  const top = report.funnel[0].value || 1;
                  const pct = Math.round((step.value / top) * 100);
                  const prev = i > 0 ? report.funnel[i - 1].value : null;
                  const stepPct =
                    prev && prev > 0 ? Math.round((step.value / prev) * 100) : null;
                  return (
                    <div key={step.label} className="space-y-1">
                      <div className="flex items-center justify-between text-xs">
                        <span>{step.label}</span>
                        <span className="text-muted-foreground">
                          {step.value}
                          {stepPct !== null ? ` · ${stepPct}% from previous` : ""}
                        </span>
                      </div>
                      <div className="h-2 rounded bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                {
                  label: "Avg days to close",
                  value: report.avgDays === null ? "—" : `${report.avgDays} days`,
                },
                { label: "Closed GCI", value: money(closedGci) },
                { label: "Pipeline GCI", value: money(pipelineGci) },
              ].map((s) => (
                <Card key={s.label} className="border-border/60">
                  <CardContent className="p-4">
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-lg font-semibold mt-1">{s.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border/60">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Source ROI</CardTitle>
              </CardHeader>
              <CardContent>
                {report.sources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Add a source to your deals to see which channels actually close.
                  </p>
                ) : (
                  <div className="overflow-auto">
                    <table className="w-full text-xs">
                      <thead className="text-muted-foreground">
                        <tr className="text-left">
                          <th className="py-1.5 font-medium">Source</th>
                          <th className="py-1.5 font-medium">Deals</th>
                          <th className="py-1.5 font-medium">Closed</th>
                          <th className="py-1.5 font-medium">Close rate</th>
                          <th className="py-1.5 font-medium">GCI</th>
                        </tr>
                      </thead>
                      <tbody>
                        {report.sources.map((row) => (
                          <tr key={row.source} className="border-t border-border/50">
                            <td className="py-1.5">{row.source}</td>
                            <td className="py-1.5">{row.total}</td>
                            <td className="py-1.5">{row.closed}</td>
                            <td className="py-1.5">
                              {row.total ? Math.round((row.closed / row.total) * 100) : 0}%
                            </td>
                            <td className="py-1.5">{money(row.gci)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default RealtorDeals;
