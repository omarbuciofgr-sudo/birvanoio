import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  ArrowLeft, Mail, Phone, Globe, Linkedin, MapPin, Copy, Send,
  Building2, ExternalLink, Save, Sparkles, MessageSquare, PhoneCall,
} from "lucide-react";
import { LeadScoreBadge } from "@/components/leads/LeadScoreBadge";
import { LeadActivityTimeline } from "@/components/leads/LeadActivityTimeline";
import { CommunicationPanel } from "@/components/leads/CommunicationPanel";
import { AddToCampaignDialog } from "@/components/leads/AddToCampaignDialog";
import LocalTimeClock from "@/components/leads/LocalTimeClock";
import SequenceEnrollments from "@/components/leads/SequenceEnrollments";
import { resolveLeadTimezone } from "@/lib/leadTimezone";
import type { Database } from "@/integrations/supabase/types";

type Lead = Database["public"]["Tables"]["leads"]["Row"] & { lead_score?: number | null };
type LeadStatus = Database["public"]["Enums"]["lead_status"];

const statusOptions: LeadStatus[] = ["new", "contacted", "qualified", "converted", "lost"];
const statusColors: Record<string, string> = {
  new: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  contacted: "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  qualified: "bg-purple-500/10 text-purple-600 dark:text-purple-400",
  converted: "bg-green-500/10 text-green-600 dark:text-green-400",
  lost: "bg-destructive/10 text-destructive",
};

interface ConvLog {
  id: string;
  type: string;
  direction: string | null;
  subject: string | null;
  content: string | null;
  duration_seconds: number | null;
  created_at: string;
  recording_url: string | null;
}

interface CallRow {
  id: string;
  status: string;
  call_outcome: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  created_at: string;
  recording_url: string | null;
  ai_transcript: string | null;
}

function initials(name: string | null | undefined) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

function copy(text: string) {
  navigator.clipboard.writeText(text).then(
    () => toast.success("Copied"),
    () => toast.error("Copy failed"),
  );
}

export default function LeadDetail() {
  const { id } = useParams<{ id: string }>();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [lead, setLead] = useState<Lead | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [notes, setNotes] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [campaignOpen, setCampaignOpen] = useState(false);
  const [emails, setEmails] = useState<ConvLog[]>([]);
  const [sms, setSms] = useState<ConvLog[]>([]);
  const [callLogs, setCallLogs] = useState<ConvLog[]>([]);
  const [voiceCalls, setVoiceCalls] = useState<CallRow[]>([]);

  useEffect(() => {
    if (!loading && !user) navigate("/auth");
  }, [user, loading, navigate]);

  useEffect(() => {
    if (!id || !user) return;
    (async () => {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).maybeSingle();
      if (error || !data) {
        setNotFound(true);
        return;
      }
      setLead(data as Lead);
      setNotes(data.notes || "");
      setContactName(data.contact_name || "");
      setEmail(data.email || "");
      setPhone(data.phone || "");
    })();
  }, [id, user]);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const [{ data: convs }, { data: calls }] = await Promise.all([
        supabase.from("conversation_logs").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
        supabase.from("voice_agent_calls").select("*").eq("lead_id", id).order("created_at", { ascending: false }),
      ]);
      const list = (convs ?? []) as ConvLog[];
      setEmails(list.filter((c) => c.type === "email"));
      setSms(list.filter((c) => c.type === "sms"));
      setCallLogs(list.filter((c) => c.type === "call"));
      setVoiceCalls((calls ?? []) as CallRow[]);
    })();
  }, [id]);

  const tz = useMemo(
    () =>
      lead
        ? resolveLeadTimezone({
            state: lead.state,
            city: lead.city,
            phone: lead.phone,
          })
        : { tz: null, source: null },
    [lead],
  );

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6 text-sm text-muted-foreground">Loading…</div>
      </DashboardLayout>
    );
  }
  if (notFound) {
    return (
      <DashboardLayout>
        <div className="p-8 text-center space-y-2">
          <p className="text-sm font-medium">Lead not found</p>
          <Button variant="outline" size="sm" onClick={() => navigate("/dashboard/leads")}>
            Back to Leads
          </Button>
        </div>
      </DashboardLayout>
    );
  }
  if (!lead || !user) return null;

  const location = [lead.city, lead.state, lead.zip_code].filter(Boolean).join(", ") || "—";
  const socials = (lead.social_profiles ?? {}) as Record<string, string>;

  const updateStatus = async (status: LeadStatus) => {
    setSaving(true);
    const updates: Partial<Lead> = { status };
    if (status === "contacted" && !lead.contacted_at) (updates as any).contacted_at = new Date().toISOString();
    if (status === "converted" && !lead.converted_at) (updates as any).converted_at = new Date().toISOString();
    const { error } = await supabase.from("leads").update(updates).eq("id", lead.id);
    setSaving(false);
    if (error) toast.error("Failed to update status");
    else {
      setLead({ ...lead, ...(updates as Lead) });
      toast.success("Status updated");
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    const { error } = await supabase.from("leads").update({ notes: notes.trim() || null }).eq("id", lead.id);
    setSaving(false);
    if (error) toast.error("Failed to save notes");
    else {
      setLead({ ...lead, notes: notes.trim() || null });
      toast.success("Notes saved");
    }
  };

  const saveContact = async () => {
    setSaving(true);
    const payload = {
      contact_name: contactName.trim() || null,
      email: email.trim() || null,
      phone: phone.trim() || null,
    };
    const { error } = await supabase.from("leads").update(payload).eq("id", lead.id);
    setSaving(false);
    if (error) toast.error("Failed to save contact");
    else {
      setLead({ ...lead, ...payload });
      toast.success("Contact saved");
    }
  };

  return (
    <DashboardLayout>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <Button variant="ghost" size="sm" className="h-8 gap-1" onClick={() => navigate("/dashboard/leads")}>
              <ArrowLeft className="w-4 h-4" /> Leads
            </Button>
            <div className="h-12 w-12 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center ring-1 ring-border/40 shrink-0">
              <span className="text-sm font-semibold text-primary">
                {initials(lead.contact_name || lead.business_name)}
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-semibold tracking-tight truncate max-w-[360px]">
                  {lead.contact_name || lead.business_name}
                </h1>
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium ${statusColors[lead.status]}`}>
                  {lead.status}
                </span>
                <LeadScoreBadge leadId={lead.id} score={lead.lead_score ?? null} onScoreUpdate={(s) => setLead({ ...lead, lead_score: s })} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5 flex-wrap">
                {lead.contact_name && <span>{lead.business_name}</span>}
                {lead.business_name && (
                  <Link
                    to={`/dashboard/accounts/${encodeURIComponent(lead.business_name)}`}
                    className="inline-flex items-center gap-0.5 text-primary hover:underline"
                  >
                    <Building2 className="w-3 h-3" /> Account
                  </Link>
                )}
                {lead.industry && <span>· {lead.industry}</span>}
                {location !== "—" && <span>· {location}</span>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocalTimeClock tz={tz.tz} source={tz.source} />
            <Separator orientation="vertical" className="h-6" />
            {lead.phone && (
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                <a href={`tel:${lead.phone}`}><Phone className="w-3.5 h-3.5" /> Call</a>
              </Button>
            )}
            {lead.email && (
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" asChild>
                <a href={`mailto:${lead.email}`}><Mail className="w-3.5 h-3.5" /> Email</a>
              </Button>
            )}
            <Button size="sm" className="h-8 gap-1 text-xs" onClick={() => setCampaignOpen(true)}>
              <Send className="w-3.5 h-3.5" /> Add to Sequence
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          {/* Left rail */}
          <div className="space-y-3">
            {/* Contact */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Contact</h3>
                <div className="space-y-2">
                  <ContactRow icon={<Mail className="w-3.5 h-3.5" />} value={lead.email} href={lead.email ? `mailto:${lead.email}` : undefined} />
                  <ContactRow icon={<Phone className="w-3.5 h-3.5" />} value={lead.phone} href={lead.phone ? `tel:${lead.phone}` : undefined} />
                  <ContactRow
                    icon={<Globe className="w-3.5 h-3.5" />}
                    value={lead.website}
                    href={lead.website ? (lead.website.startsWith("http") ? lead.website : `https://${lead.website}`) : undefined}
                    external
                  />
                  {lead.linkedin_url && (
                    <ContactRow
                      icon={<Linkedin className="w-3.5 h-3.5" />}
                      value={lead.linkedin_url.replace(/^https?:\/\/(www\.)?/, "")}
                      href={lead.linkedin_url}
                      external
                    />
                  )}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5 shrink-0" /> {location}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Edit contact */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Edit</h3>
                <div className="space-y-2">
                  <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Contact name" className="h-8 text-xs" />
                  <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" className="h-8 text-xs" />
                  <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Phone" className="h-8 text-xs" />
                </div>
                <div className="flex justify-end">
                  <Button size="sm" className="h-7 text-xs gap-1" onClick={saveContact} disabled={saving}>
                    <Save className="w-3 h-3" /> Save
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Sequences */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sequences</h3>
                  <Button size="sm" variant="ghost" className="h-6 px-1.5 text-[10px]" onClick={() => setCampaignOpen(true)}>
                    + Enroll
                  </Button>
                </div>
                <SequenceEnrollments leadId={lead.id} />
              </CardContent>
            </Card>

            {/* Status */}
            <Card>
              <CardContent className="p-4 space-y-2">
                <h3 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Status</h3>
                <div className="flex flex-wrap gap-1">
                  {statusOptions.map((s) => (
                    <Button
                      key={s}
                      variant={lead.status === s ? "default" : "outline"}
                      size="sm"
                      className="h-7 text-[10px]"
                      onClick={() => updateStatus(s)}
                      disabled={saving}
                    >
                      {s}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Meta */}
            <Card>
              <CardContent className="p-4 space-y-1.5 text-xs">
                <MetaRow label="Created" value={new Date(lead.created_at).toLocaleDateString()} />
                {lead.contacted_at && <MetaRow label="First contacted" value={new Date(lead.contacted_at).toLocaleDateString()} />}
                {lead.converted_at && <MetaRow label="Converted" value={new Date(lead.converted_at).toLocaleDateString()} />}
                {lead.company_size && <MetaRow label="Company size" value={lead.company_size} />}
                {lead.estimated_revenue && <MetaRow label="Est. revenue" value={lead.estimated_revenue} />}
                {lead.source_url && (
                  <MetaRow
                    label="Source"
                    value={
                      <a href={lead.source_url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                        View <ExternalLink className="w-2.5 h-2.5" />
                      </a>
                    }
                  />
                )}
                {Object.entries(socials).slice(0, 3).map(([k, v]) => (
                  <MetaRow key={k} label={k} value={<span className="truncate">{String(v)}</span>} />
                ))}
              </CardContent>
            </Card>
          </div>

          {/* Main tabs */}
          <div>
            <Tabs defaultValue="activity">
              <TabsList className="h-8">
                <TabsTrigger value="activity" className="text-xs gap-1"><Sparkles className="w-3 h-3" /> Activity</TabsTrigger>
                <TabsTrigger value="emails" className="text-xs gap-1"><Mail className="w-3 h-3" /> Emails ({emails.length})</TabsTrigger>
                <TabsTrigger value="calls" className="text-xs gap-1"><PhoneCall className="w-3 h-3" /> Calls ({voiceCalls.length + callLogs.length})</TabsTrigger>
                <TabsTrigger value="sms" className="text-xs gap-1"><MessageSquare className="w-3 h-3" /> SMS ({sms.length})</TabsTrigger>
                <TabsTrigger value="notes" className="text-xs">Notes</TabsTrigger>
                <TabsTrigger value="compose" className="text-xs">Compose</TabsTrigger>
              </TabsList>

              <TabsContent value="activity" className="mt-3">
                <Card>
                  <CardContent className="p-3">
                    <LeadActivityTimeline leadId={lead.id} maxHeight="600px" />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="emails" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    {emails.length === 0 ? (
                      <EmptyState icon={<Mail className="w-6 h-6" />} label="No emails logged yet" />
                    ) : (
                      <ul className="divide-y divide-border/40">
                        {emails.map((e) => (
                          <li key={e.id} className="p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 min-w-0">
                                <Badge variant="outline" className="text-[9px]">{e.direction || "outbound"}</Badge>
                                <p className="text-sm font-medium truncate">{e.subject || "(no subject)"}</p>
                              </div>
                              <span className="text-[10px] text-muted-foreground shrink-0">{new Date(e.created_at).toLocaleString()}</span>
                            </div>
                            {e.content && <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{e.content}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="calls" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    {voiceCalls.length === 0 && callLogs.length === 0 ? (
                      <EmptyState icon={<PhoneCall className="w-6 h-6" />} label="No calls yet" />
                    ) : (
                      <ul className="divide-y divide-border/40">
                        {voiceCalls.map((c) => (
                          <li key={c.id} className="p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-[9px]">{c.status}</Badge>
                                {c.call_outcome && <Badge variant="secondary" className="text-[9px]">{c.call_outcome}</Badge>}
                                {typeof c.duration_seconds === "number" && (
                                  <span className="text-[10px] text-muted-foreground">{c.duration_seconds}s</span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground">{new Date(c.started_at || c.created_at).toLocaleString()}</span>
                            </div>
                            {c.ai_transcript && <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{c.ai_transcript}</p>}
                            {c.recording_url && (
                              <audio src={c.recording_url} controls className="mt-2 h-8 w-full" />
                            )}
                          </li>
                        ))}
                        {callLogs.map((c) => (
                          <li key={c.id} className="p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <Badge variant="outline" className="text-[9px]">{c.direction || "call"}</Badge>
                              <span className="text-[10px] text-muted-foreground">{new Date(c.created_at).toLocaleString()}</span>
                            </div>
                            {c.content && <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">{c.content}</p>}
                            {c.recording_url && (
                              <audio src={c.recording_url} controls className="mt-2 h-8 w-full" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="sms" className="mt-3">
                <Card>
                  <CardContent className="p-0">
                    {sms.length === 0 ? (
                      <EmptyState icon={<MessageSquare className="w-6 h-6" />} label="No SMS yet" />
                    ) : (
                      <ul className="divide-y divide-border/40">
                        {sms.map((m) => (
                          <li key={m.id} className="p-3">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <Badge variant="outline" className="text-[9px]">{m.direction || "outbound"}</Badge>
                              <span className="text-[10px] text-muted-foreground">{new Date(m.created_at).toLocaleString()}</span>
                            </div>
                            {m.content && <p className="text-xs whitespace-pre-wrap">{m.content}</p>}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notes" className="mt-3">
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Prospect notes — meeting takeaways, pain points, next steps…"
                      rows={12}
                      className="text-sm"
                    />
                    <div className="flex justify-end">
                      <Button size="sm" className="h-8 gap-1 text-xs" onClick={saveNotes} disabled={saving || notes === (lead.notes || "")}>
                        <Save className="w-3.5 h-3.5" /> Save notes
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="compose" className="mt-3">
                <Card>
                  <CardContent className="p-3">
                    <CommunicationPanel
                      leadId={lead.id}
                      clientId={user.id}
                      leadEmail={lead.email}
                      leadPhone={lead.phone}
                      leadName={lead.contact_name}
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <AddToCampaignDialog
        open={campaignOpen}
        onOpenChange={setCampaignOpen}
        leadIds={[lead.id]}
      />
    </DashboardLayout>
  );
}

function ContactRow({ icon, value, href, external }: { icon: React.ReactNode; value: string | null | undefined; href?: string; external?: boolean }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-2 text-xs group">
      <span className="text-muted-foreground shrink-0">{icon}</span>
      {href ? (
        <a href={href} target={external ? "_blank" : undefined} rel={external ? "noreferrer" : undefined} className="text-primary hover:underline truncate flex-1">
          {value}
        </a>
      ) : (
        <span className="truncate flex-1">{value}</span>
      )}
      <button
        onClick={() => copy(value)}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
        aria-label="Copy"
      >
        <Copy className="w-3 h-3 text-muted-foreground hover:text-foreground" />
      </button>
    </div>
  );
}

function MetaRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="text-xs font-medium">{value}</span>
    </div>
  );
}

function EmptyState({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="p-10 text-center text-muted-foreground">
      <div className="mx-auto mb-2 opacity-40">{icon}</div>
      <p className="text-xs">{label}</p>
    </div>
  );
}
