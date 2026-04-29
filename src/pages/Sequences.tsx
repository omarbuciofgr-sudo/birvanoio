import { useState, useMemo } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus,
  Mail,
  MessageSquare,
  Linkedin,
  Trash2,
  Play,
  Pause,
  Loader2,
  Sparkles,
  Clock,
  Users,
  BarChart3,
  ArrowLeft,
  Search,
  Workflow as WorkflowIcon,
  List as ListIcon,
  GitBranch,
  CheckCircle2,
  Phone,
} from "lucide-react";
import { format } from "date-fns";

type Sequence = {
  id: string;
  name: string;
  description: string | null;
  status: string;
  channels: string[];
  tone: string;
  goal: string;
  created_at: string;
  updated_at: string;
  user_id: string;
};

type SequenceStep = {
  id: string;
  sequence_id: string;
  step_order: number;
  channel: string;
  delay_days: number;
  subject: string | null;
  body: string;
};

type Enrollment = {
  id: string;
  sequence_id: string;
  lead_id: string;
  current_step: number;
  status: string;
  enrolled_at: string;
  leads?: { business_name: string; contact_name: string | null; email: string | null } | null;
};

const channelConfig = {
  email: {
    icon: Mail,
    label: "Email",
    color: "bg-blue-500/10 text-blue-600 border-blue-200 dark:border-blue-900",
    dot: "bg-blue-500",
  },
  sms: {
    icon: MessageSquare,
    label: "SMS",
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900",
    dot: "bg-emerald-500",
  },
  linkedin: {
    icon: Linkedin,
    label: "LinkedIn",
    color: "bg-indigo-500/10 text-indigo-600 border-indigo-200 dark:border-indigo-900",
    dot: "bg-indigo-500",
  },
  call: {
    icon: Phone,
    label: "Call",
    color: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900",
    dot: "bg-amber-500",
  },
} as const;

type ChannelKey = keyof typeof channelConfig;

function getChannelConfig(ch: string) {
  return channelConfig[(ch as ChannelKey)] || channelConfig.email;
}

export default function Sequences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "paused" | "draft">("all");
  const [stepView, setStepView] = useState<"list" | "flow">("list");
  const [form, setForm] = useState({
    name: "",
    description: "",
    channels: ["email"] as string[],
    tone: "professional",
    goal: "book a meeting",
  });

  // Fetch sequences
  const { data: sequences = [], isLoading } = useQuery({
    queryKey: ["sequences"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequences")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Sequence[];
    },
    enabled: !!user,
  });

  // Per-sequence step counts (a single query)
  const { data: stepCounts = {} } = useQuery({
    queryKey: ["sequence-step-counts", sequences.map((s) => s.id).join(",")],
    enabled: sequences.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequence_steps")
        .select("sequence_id")
        .in("sequence_id", sequences.map((s) => s.id));
      if (error) throw error;
      return (data || []).reduce<Record<string, number>>((acc, row: any) => {
        acc[row.sequence_id] = (acc[row.sequence_id] || 0) + 1;
        return acc;
      }, {});
    },
  });

  // Per-sequence enrollment counts
  const { data: enrollmentCounts = {} } = useQuery({
    queryKey: ["sequence-enrollment-counts", sequences.map((s) => s.id).join(",")],
    enabled: sequences.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequence_enrollments")
        .select("sequence_id")
        .in("sequence_id", sequences.map((s) => s.id));
      if (error) throw error;
      return (data || []).reduce<Record<string, number>>((acc, row: any) => {
        acc[row.sequence_id] = (acc[row.sequence_id] || 0) + 1;
        return acc;
      }, {});
    },
  });

  // Fetch steps for selected sequence
  const { data: steps = [] } = useQuery({
    queryKey: ["sequence-steps", selectedSequence],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequence_steps")
        .select("*")
        .eq("sequence_id", selectedSequence!)
        .order("step_order");
      if (error) throw error;
      return data as SequenceStep[];
    },
    enabled: !!selectedSequence,
  });

  // Fetch enrollments for selected sequence
  const { data: enrollments = [] } = useQuery({
    queryKey: ["sequence-enrollments", selectedSequence],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sequence_enrollments")
        .select("*, leads(business_name, contact_name, email)")
        .eq("sequence_id", selectedSequence!)
        .order("enrolled_at", { ascending: false });
      if (error) throw error;
      return data as Enrollment[];
    },
    enabled: !!selectedSequence,
  });

  // Mutations
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("sequences")
        .insert({ ...form, user_id: user!.id, status: "draft" })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      setShowCreate(false);
      setForm({ name: "", description: "", channels: ["email"], tone: "professional", goal: "book a meeting" });
      toast.success("Sequence created");
      if (created?.id) setSelectedSequence(created.id);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "paused" : "active";
      const { error } = await supabase.from("sequences").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequences"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sequences").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      if (selectedSequence) setSelectedSequence(null);
      toast.success("Sequence deleted");
    },
  });

  const addStep = useMutation({
    mutationFn: async (step: Omit<SequenceStep, "id">) => {
      const { error } = await supabase.from("sequence_steps").insert(step);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequence-steps", selectedSequence] }),
  });

  const updateStep = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<SequenceStep> }) => {
      const { error } = await supabase.from("sequence_steps").update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequence-steps", selectedSequence] }),
  });

  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sequence_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequence-steps", selectedSequence] }),
  });

  const [aiLoading, setAiLoading] = useState(false);
  const generateSteps = async (seq: Sequence) => {
    setAiLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-outreach-agent", {
        body: {
          lead: { business_name: "{{lead}}", contact_name: "{{contact}}" },
          channels: seq.channels,
          tone: seq.tone,
          goal: seq.goal,
        },
      });
      if (error) throw error;
      if (data?.steps) {
        await supabase.from("sequence_steps").delete().eq("sequence_id", seq.id);
        const stepsToInsert = data.steps.map((s: any, i: number) => ({
          sequence_id: seq.id,
          step_order: i + 1,
          channel: s.channel || "email",
          delay_days: s.delay_days || i * 2,
          subject: s.subject || null,
          body: s.body || "",
        }));
        await supabase.from("sequence_steps").insert(stepsToInsert);
        queryClient.invalidateQueries({ queryKey: ["sequence-steps", seq.id] });
        toast.success(`Generated ${data.steps.length} steps with AI`);
      }
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
    } finally {
      setAiLoading(false);
    }
  };

  const toggleChannel = (ch: string) => {
    setForm((prev) => ({
      ...prev,
      channels: prev.channels.includes(ch) ? prev.channels.filter((c) => c !== ch) : [...prev.channels, ch],
    }));
  };

  const filteredSequences = useMemo(() => {
    return sequences.filter((s) => {
      if (statusFilter !== "all" && s.status !== statusFilter) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!s.name.toLowerCase().includes(q) && !(s.description || "").toLowerCase().includes(q)) {
          return false;
        }
      }
      return true;
    });
  }, [sequences, statusFilter, searchQuery]);

  const activeSeq = sequences.find((s) => s.id === selectedSequence) || null;
  const activeCount = sequences.filter((s) => s.status === "active").length;
  const totalEnrolled = Object.values(enrollmentCounts).reduce((a, b) => a + (b as number), 0);

  // ============================ DETAIL VIEW ============================
  if (activeSeq) {
    return (
      <DashboardLayout fullWidth>
        <SequenceDetail
          seq={activeSeq}
          steps={steps}
          enrollments={enrollments}
          stepView={stepView}
          setStepView={setStepView}
          onBack={() => setSelectedSequence(null)}
          onTogglePlay={() => toggleStatus.mutate({ id: activeSeq.id, status: activeSeq.status })}
          onDelete={() => deleteMutation.mutate(activeSeq.id)}
          onAddStep={() =>
            addStep.mutate({
              sequence_id: activeSeq.id,
              step_order: steps.length + 1,
              channel: "email",
              delay_days: steps.length === 0 ? 0 : 2,
              subject: "",
              body: "",
            })
          }
          onUpdateStep={(id, patch) => updateStep.mutate({ id, patch })}
          onDeleteStep={(id) => deleteStep.mutate(id)}
          onAIGenerate={() => generateSteps(activeSeq)}
          aiLoading={aiLoading}
        />
      </DashboardLayout>
    );
  }

  // ============================ LIST VIEW ============================
  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Sequences</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Build multi-channel outreach with AI assistance
            </p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2 h-9">
            <Plus className="h-4 w-4" /> New sequence
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <StatCard label="Total" value={sequences.length} icon={WorkflowIcon} color="text-foreground" />
          <StatCard label="Active" value={activeCount} icon={Play} color="text-emerald-600" />
          <StatCard label="Enrolled leads" value={totalEnrolled} icon={Users} color="text-blue-600" />
          <StatCard label="Avg steps" value={
            sequences.length === 0
              ? 0
              : Math.round(Object.values(stepCounts).reduce((a, b) => a + (b as number), 0) / Math.max(sequences.length, 1))
          } icon={GitBranch} color="text-indigo-600" />
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative flex-1 min-w-[240px] max-w-md">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search sequences…"
              className="pl-9 h-9"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v: any) => setStatusFilter(v)}>
            <SelectTrigger className="w-[140px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="paused">Paused</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Sequence table */}
        <Card>
          <div className="overflow-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 border-b border-border/60">
                <tr className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  <th className="px-4 py-2.5">Name</th>
                  <th className="px-4 py-2.5">Status</th>
                  <th className="px-4 py-2.5">Channels</th>
                  <th className="px-4 py-2.5 text-center">Steps</th>
                  <th className="px-4 py-2.5 text-center">Enrolled</th>
                  <th className="px-4 py-2.5">Updated</th>
                  <th className="px-4 py-2.5 w-32"></th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground mx-auto" />
                    </td>
                  </tr>
                ) : filteredSequences.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <div className="space-y-3">
                        <WorkflowIcon className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                        <div>
                          <p className="text-sm font-medium text-foreground">No sequences yet</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Create your first multi-channel outreach sequence to engage leads automatically.
                          </p>
                        </div>
                        <Button onClick={() => setShowCreate(true)} size="sm" className="gap-2">
                          <Plus className="h-3.5 w-3.5" /> New sequence
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredSequences.map((seq) => {
                    const steps = stepCounts[seq.id] || 0;
                    const enrolled = enrollmentCounts[seq.id] || 0;
                    return (
                      <tr
                        key={seq.id}
                        className="border-b border-border/40 hover:bg-accent/30 cursor-pointer transition-colors"
                        onClick={() => {
                          setSelectedSequence(seq.id);
                          setStepView("list");
                        }}
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-foreground">{seq.name}</div>
                          {seq.description && (
                            <div className="text-xs text-muted-foreground truncate max-w-[360px]">
                              {seq.description}
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={seq.status} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {(seq.channels || []).map((ch) => {
                              const c = getChannelConfig(ch);
                              const Icon = c.icon;
                              return (
                                <span
                                  key={ch}
                                  title={c.label}
                                  className={`h-6 w-6 rounded-md flex items-center justify-center ${c.color} border`}
                                >
                                  <Icon className="h-3 w-3" />
                                </span>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center text-sm tabular-nums">{steps}</td>
                        <td className="px-4 py-3 text-center text-sm tabular-nums">{enrolled}</td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(seq.updated_at || seq.created_at), "MMM d, yyyy")}
                        </td>
                        <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2 text-xs"
                              onClick={() => toggleStatus.mutate({ id: seq.id, status: seq.status })}
                              title={seq.status === "active" ? "Pause" : "Activate"}
                            >
                              {seq.status === "active" ? (
                                <Pause className="h-3.5 w-3.5" />
                              ) : (
                                <Play className="h-3.5 w-3.5" />
                              )}
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm(`Delete sequence "${seq.name}"?`)) deleteMutation.mutate(seq.id);
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New sequence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                placeholder="e.g., Cold Outreach Q2"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief description…"
                rows={2}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Tone</label>
                <Select value={form.tone} onValueChange={(v) => setForm((f) => ({ ...f, tone: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="professional">Professional</SelectItem>
                    <SelectItem value="friendly">Friendly</SelectItem>
                    <SelectItem value="casual">Casual</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">Goal</label>
                <Select value={form.goal} onValueChange={(v) => setForm((f) => ({ ...f, goal: v }))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book a meeting">Book meeting</SelectItem>
                    <SelectItem value="get a reply">Get reply</SelectItem>
                    <SelectItem value="share a resource">Share resource</SelectItem>
                    <SelectItem value="close a deal">Close deal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Channels</label>
              <div className="grid grid-cols-2 gap-2">
                {(["email", "sms", "linkedin", "call"] as const).map((ch) => {
                  const c = channelConfig[ch];
                  const checked = form.channels.includes(ch);
                  return (
                    <label
                      key={ch}
                      className={`flex items-center gap-2 text-sm cursor-pointer rounded-md border px-3 py-2 transition-colors ${
                        checked ? c.color : "border-border/60 hover:bg-muted/40"
                      }`}
                    >
                      <Checkbox checked={checked} onCheckedChange={() => toggleChannel(ch)} />
                      <c.icon className="h-3.5 w-3.5" />
                      {c.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={!form.name || createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

// ===================================================================
// Sub-components
// ===================================================================

function StatCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: number;
  icon: any;
  color: string;
}) {
  return (
    <Card>
      <CardContent className="p-4 flex items-center gap-3">
        <div className="h-9 w-9 rounded-lg bg-muted/60 flex items-center justify-center">
          <Icon className={`h-4 w-4 ${color}`} />
        </div>
        <div>
          <p className="text-xl font-bold tabular-nums">{value}</p>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; className: string }> = {
    active: { label: "Active", className: "bg-emerald-500/10 text-emerald-600 border-emerald-200 dark:border-emerald-900" },
    paused: { label: "Paused", className: "bg-amber-500/10 text-amber-600 border-amber-200 dark:border-amber-900" },
    draft: { label: "Draft", className: "bg-muted text-muted-foreground border-border/60" },
  };
  const cfg = map[status] || map.draft;
  return (
    <Badge variant="outline" className={`text-[10px] px-2 py-0.5 font-medium ${cfg.className}`}>
      {cfg.label}
    </Badge>
  );
}

// ===================================================================
// Detail view (sequence editor)
// ===================================================================

interface DetailProps {
  seq: Sequence;
  steps: SequenceStep[];
  enrollments: Enrollment[];
  stepView: "list" | "flow";
  setStepView: (v: "list" | "flow") => void;
  onBack: () => void;
  onTogglePlay: () => void;
  onDelete: () => void;
  onAddStep: () => void;
  onUpdateStep: (id: string, patch: Partial<SequenceStep>) => void;
  onDeleteStep: (id: string) => void;
  onAIGenerate: () => void;
  aiLoading: boolean;
}

function SequenceDetail({
  seq,
  steps,
  enrollments,
  stepView,
  setStepView,
  onBack,
  onTogglePlay,
  onDelete,
  onAddStep,
  onUpdateStep,
  onDeleteStep,
  onAIGenerate,
  aiLoading,
}: DetailProps) {
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="sm" onClick={onBack} className="h-8 gap-1.5">
            <ArrowLeft className="h-4 w-4" /> All sequences
          </Button>
          <div className="h-5 w-px bg-border/60" />
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold truncate">{seq.name}</h1>
              <StatusBadge status={seq.status} />
            </div>
            {seq.description && (
              <p className="text-xs text-muted-foreground truncate">{seq.description}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5"
            disabled={aiLoading}
            onClick={onAIGenerate}
          >
            {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            AI generate
          </Button>
          <Button
            variant={seq.status === "active" ? "outline" : "default"}
            size="sm"
            className="h-8 gap-1.5"
            onClick={onTogglePlay}
          >
            {seq.status === "active" ? (
              <>
                <Pause className="h-3.5 w-3.5" /> Pause
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5" /> Activate
              </>
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 text-destructive hover:text-destructive"
            onClick={() => {
              if (confirm(`Delete sequence "${seq.name}"?`)) onDelete();
            }}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="steps">
        <TabsList>
          <TabsTrigger value="steps" className="gap-1.5">
            <WorkflowIcon className="h-3.5 w-3.5" /> Steps
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{steps.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="enrolled" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Enrolled
            <Badge variant="secondary" className="ml-1 h-4 px-1 text-[10px]">{enrollments.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" /> Analytics
          </TabsTrigger>
        </TabsList>

        {/* Steps tab */}
        <TabsContent value="steps" className="mt-4 space-y-4">
          {/* View toggle */}
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-md border border-border/60 p-0.5 bg-muted/40">
              <button
                onClick={() => setStepView("list")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  stepView === "list" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <ListIcon className="h-3.5 w-3.5" /> List
              </button>
              <button
                onClick={() => setStepView("flow")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  stepView === "flow" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <GitBranch className="h-3.5 w-3.5" /> Flow
              </button>
            </div>
            <Button onClick={onAddStep} size="sm" className="h-8 gap-1.5">
              <Plus className="h-3.5 w-3.5" /> Add step
            </Button>
          </div>

          {steps.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center space-y-3">
                <WorkflowIcon className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <div>
                  <p className="text-sm font-medium">No steps yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Add steps manually or let AI generate a multi-touch sequence based on your goal.
                  </p>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Button onClick={onAddStep} size="sm" className="gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add step
                  </Button>
                  <Button onClick={onAIGenerate} size="sm" variant="outline" className="gap-1.5" disabled={aiLoading}>
                    {aiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
                    AI generate
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : stepView === "list" ? (
            <StepListView
              steps={steps}
              onUpdateStep={onUpdateStep}
              onDeleteStep={onDeleteStep}
            />
          ) : (
            <StepFlowView steps={steps} />
          )}
        </TabsContent>

        {/* Enrolled tab */}
        <TabsContent value="enrolled" className="mt-4">
          {enrollments.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="p-12 text-center space-y-2">
                <Users className="h-10 w-10 text-muted-foreground/30 mx-auto" />
                <p className="text-sm font-medium">No enrolled leads</p>
                <p className="text-xs text-muted-foreground">
                  Enroll leads from the Leads page to start running this sequence.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 border-b border-border/60">
                    <tr className="text-left text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                      <th className="px-4 py-2.5">Lead</th>
                      <th className="px-4 py-2.5">Email</th>
                      <th className="px-4 py-2.5 text-center">Step</th>
                      <th className="px-4 py-2.5">Status</th>
                      <th className="px-4 py-2.5">Enrolled</th>
                    </tr>
                  </thead>
                  <tbody>
                    {enrollments.map((e) => (
                      <tr key={e.id} className="border-b border-border/40 hover:bg-accent/20">
                        <td className="px-4 py-3 font-medium">{e.leads?.business_name || "—"}</td>
                        <td className="px-4 py-3 text-muted-foreground">{e.leads?.email || "—"}</td>
                        <td className="px-4 py-3 text-center tabular-nums">{e.current_step}</td>
                        <td className="px-4 py-3">
                          <StatusBadge status={e.status} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {format(new Date(e.enrolled_at), "MMM d, yyyy")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </TabsContent>

        {/* Analytics tab */}
        <TabsContent value="analytics" className="mt-4">
          <Card className="border-dashed">
            <CardContent className="p-12 text-center space-y-2">
              <BarChart3 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
              <p className="text-sm font-medium">Analytics coming online</p>
              <p className="text-xs text-muted-foreground">
                Open rates, replies, and conversion metrics will populate as leads progress through the sequence.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ===================================================================
// Step list view (vertical timeline editor)
// ===================================================================

function StepListView({
  steps,
  onUpdateStep,
  onDeleteStep,
}: {
  steps: SequenceStep[];
  onUpdateStep: (id: string, patch: Partial<SequenceStep>) => void;
  onDeleteStep: (id: string) => void;
}) {
  return (
    <div className="space-y-2">
      {steps.map((step, idx) => (
        <StepListRow
          key={step.id}
          step={step}
          index={idx}
          isLast={idx === steps.length - 1}
          onUpdate={(patch) => onUpdateStep(step.id, patch)}
          onDelete={() => onDeleteStep(step.id)}
        />
      ))}
    </div>
  );
}

function StepListRow({
  step,
  index,
  isLast,
  onUpdate,
  onDelete,
}: {
  step: SequenceStep;
  index: number;
  isLast: boolean;
  onUpdate: (patch: Partial<SequenceStep>) => void;
  onDelete: () => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [subject, setSubject] = useState(step.subject || "");
  const [body, setBody] = useState(step.body || "");
  const config = getChannelConfig(step.channel);
  const Icon = config.icon;

  return (
    <div className="flex gap-3">
      {/* Timeline rail */}
      <div className="flex flex-col items-center pt-3">
        <div className={`h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold border ${config.color}`}>
          {index + 1}
        </div>
        {!isLast && <div className="w-px flex-1 bg-border/60 mt-1" />}
      </div>

      {/* Card */}
      <Card className="flex-1">
        <CardContent className="p-3 space-y-2">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex items-center gap-2 flex-wrap">
              <Select value={step.channel} onValueChange={(v) => onUpdate({ channel: v })}>
                <SelectTrigger className={`h-7 w-[120px] text-xs ${config.color}`}>
                  <SelectValue>
                    <span className="flex items-center gap-1.5">
                      <Icon className="h-3 w-3" />
                      {config.label}
                    </span>
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {(["email", "sms", "linkedin", "call"] as ChannelKey[]).map((k) => {
                    const c = channelConfig[k];
                    const I = c.icon;
                    return (
                      <SelectItem key={k} value={k}>
                        <span className="flex items-center gap-2">
                          <I className="h-3.5 w-3.5" /> {c.label}
                        </span>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>Wait</span>
                <Input
                  type="number"
                  min={0}
                  value={step.delay_days}
                  onChange={(e) => onUpdate({ delay_days: parseInt(e.target.value || "0", 10) })}
                  className="h-7 w-14 text-xs px-2"
                />
                <span>day{step.delay_days === 1 ? "" : "s"}</span>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-7 px-2 text-xs"
                onClick={() => setExpanded((v) => !v)}
              >
                {expanded ? "Collapse" : "Edit"}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                onClick={onDelete}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {!expanded ? (
            <div className="space-y-1">
              {step.subject && (
                <p className="text-xs font-medium truncate">
                  <span className="text-muted-foreground">Subject:</span> {step.subject}
                </p>
              )}
              <p className="text-xs text-muted-foreground line-clamp-2 whitespace-pre-wrap">
                {step.body || <span className="italic">No content yet — click Edit.</span>}
              </p>
            </div>
          ) : (
            <div className="space-y-2 pt-1">
              {step.channel === "email" && (
                <Input
                  placeholder="Subject line"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="h-8 text-sm"
                />
              )}
              <Textarea
                placeholder={`${config.label} message body…`}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={5}
                className="text-sm"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    setSubject(step.subject || "");
                    setBody(step.body || "");
                    setExpanded(false);
                  }}
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => {
                    onUpdate({ subject: subject || null, body });
                    setExpanded(false);
                    toast.success("Step saved");
                  }}
                >
                  <CheckCircle2 className="h-3 w-3" /> Save
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ===================================================================
// Step flow view (visual diagram, read-only)
// ===================================================================

function StepFlowView({ steps }: { steps: SequenceStep[] }) {
  return (
    <Card>
      <CardContent className="p-6 overflow-x-auto">
        <div className="flex items-stretch gap-3 min-w-max">
          {/* Start node */}
          <div className="flex flex-col items-center justify-center px-4 py-3 rounded-lg border border-border/60 bg-muted/40">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center mb-1">
              <Play className="h-3.5 w-3.5 text-primary" />
            </div>
            <span className="text-[11px] font-medium">Start</span>
            <span className="text-[10px] text-muted-foreground">Lead enrolled</span>
          </div>

          {steps.map((step, idx) => {
            const config = getChannelConfig(step.channel);
            const Icon = config.icon;
            return (
              <div key={step.id} className="flex items-center gap-3">
                {/* Connector */}
                <div className="flex flex-col items-center gap-1">
                  <div className="h-px w-8 bg-border" />
                  {step.delay_days > 0 && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap absolute mt-3">
                      {step.delay_days}d
                    </span>
                  )}
                </div>
                {/* Step node */}
                <div className={`flex flex-col items-center px-4 py-3 rounded-lg border-2 min-w-[160px] ${config.color}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <Icon className="h-3.5 w-3.5" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider">{config.label}</span>
                  </div>
                  <span className="text-[10px] opacity-70">Step {idx + 1}</span>
                  {step.subject && (
                    <p className="text-[10px] mt-1 max-w-[160px] truncate" title={step.subject}>
                      {step.subject}
                    </p>
                  )}
                </div>
              </div>
            );
          })}

          {/* End node */}
          <div className="flex items-center gap-3">
            <div className="h-px w-8 bg-border" />
            <div className="flex flex-col items-center justify-center px-4 py-3 rounded-lg border border-border/60 bg-muted/40">
              <div className="h-8 w-8 rounded-full bg-emerald-500/10 flex items-center justify-center mb-1">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              <span className="text-[11px] font-medium">Complete</span>
              <span className="text-[10px] text-muted-foreground">Goal reached</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
