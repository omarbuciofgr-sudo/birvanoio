import { useCallback, useEffect, useMemo, useState } from "react";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
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
import {
  CalendarPlus,
  Home,
  Plus,
  Trophy,
  Clock,
  Trash2,
  DollarSign,
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
  timeline_date: string | null;
  closed_at: string | null;
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

const stageLabel = (id: string) => STAGES.find((s) => s.id === id)?.label ?? id;

const money = (v: number | null) =>
  typeof v === "number" && v > 0
    ? v.toLocaleString(undefined, { style: "currency", currency: "USD", maximumFractionDigits: 0 })
    : "—";

const addYears = (iso: string, years: number) => {
  const d = new Date(`${iso}T09:00:00`);
  d.setFullYear(d.getFullYear() + years);
  return d;
};

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
  timeline_date: "",
  notes: "",
};

const RealtorDeals = () => {
  const { user } = useAuth();
  const [deals, setDeals] = useState<RealtorDeal[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);

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

  useEffect(() => {
    load();
  }, [load]);

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

  const markClosed = (deal: RealtorDeal) => {
    const today = new Date().toISOString().slice(0, 10);
    updateDeal(deal.id, { stage: "closed", closed_at: today });
    toast.success(`${deal.client_name} marked as closed`);
  };

  const pipelineValue = active.reduce((sum, d) => sum + Number(d.deal_value ?? 0), 0);
  const closedValue = closed.reduce((sum, d) => sum + Number(d.deal_value ?? 0), 0);

  const DealCard = ({ deal }: { deal: RealtorDeal }) => (
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

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <DollarSign className="h-3 w-3" />
        {money(Number(deal.deal_value ?? 0))}
        {deal.timeline_date && (
          <span className="flex items-center gap-1 ml-auto">
            <Clock className="h-3 w-3" />
            {new Date(deal.timeline_date).toLocaleDateString()}
          </span>
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

      {deal.stage === "timeline" && (
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Revisit on</Label>
          <Input
            type="date"
            className="h-8 text-xs"
            value={deal.timeline_date ?? ""}
            onChange={(e) => updateDeal(deal.id, { timeline_date: e.target.value || null })}
          />
        </div>
      )}
    </div>
  );

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
            <DialogContent className="max-w-lg">
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
                  <Label className="text-xs">Value</Label>
                  <Input
                    type="number"
                    value={form.deal_value}
                    onChange={(e) => setForm({ ...form, deal_value: e.target.value })}
                  />
                </div>
                <div className="space-y-1">
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

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Active deals", value: String(active.length), icon: Home },
            { label: "Pipeline value", value: money(pipelineValue), icon: DollarSign },
            { label: "Closed clients", value: String(closed.length), icon: Trophy },
            { label: "Closed volume", value: money(closedValue), icon: DollarSign },
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
              <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-5">
                {STAGES.filter((s) => s.id !== "closed" && s.id !== "lost").map((stage) => {
                  const items = active.filter((d) => d.stage === stage.id);
                  return (
                    <div key={stage.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span
                          className={`text-[11px] font-medium px-2 py-1 rounded-md ${stage.tone}`}
                        >
                          {stage.label}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{items.length}</span>
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
                const anniversary = addYears(closedOn, 1);
                return (
                  <Card key={deal.id} className="border-border/60">
                    <CardHeader className="p-4 pb-2">
                      <CardTitle className="text-sm flex items-center justify-between gap-2">
                        <span className="truncate">{deal.client_name}</span>
                        <Badge variant="outline" className="text-[10px] capitalize">
                          {deal.deal_type === "lease" ? "Leased" : "Closed"}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="p-4 pt-0 space-y-3">
                      <div className="grid gap-3 sm:grid-cols-3 text-xs text-muted-foreground">
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
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1.5"
                          asChild
                        >
                          <a
                            href={googleCalendarUrl({
                              title: `Check in with ${deal.client_name}`,
                              details: `Follow-up check-in for ${
                                deal.property_address || "their property"
                              }. Added from Brivano.`,
                              start: addYears(closedOn, 0.5 as unknown as number),
                            })}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" /> 6-month check-in
                          </a>
                        </Button>
                        <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" asChild>
                          <a
                            href={googleCalendarUrl({
                              title: `1-year anniversary — ${deal.client_name}`,
                              details: `Send a happy 1-year gift and ask for referrals. ${
                                deal.property_address ?? ""
                              }`.trim(),
                              start: anniversary,
                            })}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" /> 1-year anniversary gift
                          </a>
                        </Button>
                        <span className="text-[11px] text-muted-foreground">
                          Adds the reminder to your Google Calendar ({stageLabel(deal.stage)})
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
};

export default RealtorDeals;
