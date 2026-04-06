import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import {
  Plus, Mail, MessageSquare, Linkedin, Trash2, Edit, Play, Pause, Copy,
  Loader2, Sparkles, GripVertical, Clock, Users, BarChart3,
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
  email: { icon: Mail, label: "Email", color: "bg-blue-500/10 text-blue-600 border-blue-200" },
  sms: { icon: MessageSquare, label: "SMS", color: "bg-green-500/10 text-green-600 border-green-200" },
  linkedin: { icon: Linkedin, label: "LinkedIn", color: "bg-indigo-500/10 text-indigo-600 border-indigo-200" },
};

export default function Sequences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [editingSequence, setEditingSequence] = useState<Sequence | null>(null);
  const [selectedSequence, setSelectedSequence] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", description: "", channels: ["email"], tone: "professional", goal: "book a meeting" });

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

  // Create sequence
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from("sequences")
        .insert({ ...form, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sequences"] });
      setShowCreate(false);
      setForm({ name: "", description: "", channels: ["email"], tone: "professional", goal: "book a meeting" });
      toast.success("Sequence created");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Toggle sequence status
  const toggleStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const newStatus = status === "active" ? "paused" : "active";
      const { error } = await supabase.from("sequences").update({ status: newStatus }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequences"] }),
  });

  // Delete sequence
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

  // Add step
  const addStep = useMutation({
    mutationFn: async (step: Omit<SequenceStep, "id">) => {
      const { error } = await supabase.from("sequence_steps").insert(step);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequence-steps", selectedSequence] }),
  });

  // Delete step
  const deleteStep = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sequence_steps").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["sequence-steps", selectedSequence] }),
  });

  // AI generate steps
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
        // Delete existing steps then insert generated ones
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
    setForm(prev => ({
      ...prev,
      channels: prev.channels.includes(ch)
        ? prev.channels.filter(c => c !== ch)
        : [...prev.channels, ch],
    }));
  };

  const activeSeq = sequences.find(s => s.id === selectedSequence);
  const activeCount = sequences.filter(s => s.status === "active").length;
  const totalEnrollments = sequences.reduce((acc, _s) => acc, 0); // placeholder

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Sequences</h1>
            <p className="text-sm text-muted-foreground">Build multi-channel outreach sequences with AI assistance</p>
          </div>
          <Button onClick={() => setShowCreate(true)} className="gap-2">
            <Plus className="h-4 w-4" /> New Sequence
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10"><Mail className="h-4 w-4 text-primary" /></div>
              <div>
                <p className="text-2xl font-bold">{sequences.length}</p>
                <p className="text-xs text-muted-foreground">Total Sequences</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10"><Play className="h-4 w-4 text-green-600" /></div>
              <div>
                <p className="text-2xl font-bold">{activeCount}</p>
                <p className="text-xs text-muted-foreground">Active</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10"><Users className="h-4 w-4 text-blue-600" /></div>
              <div>
                <p className="text-2xl font-bold">{enrollments.length}</p>
                <p className="text-xs text-muted-foreground">Enrolled Leads</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="grid md:grid-cols-3 gap-6">
          {/* Sequence list */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Your Sequences</h3>
            {isLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : sequences.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-6 text-center">
                  <Mail className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No sequences yet. Create one to get started.</p>
                </CardContent>
              </Card>
            ) : (
              sequences.map(seq => (
                <Card
                  key={seq.id}
                  className={`cursor-pointer transition-all hover:shadow-md ${selectedSequence === seq.id ? "ring-2 ring-primary" : ""}`}
                  onClick={() => setSelectedSequence(seq.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm truncate">{seq.name}</h4>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{seq.description || "No description"}</p>
                      </div>
                      <Badge variant={seq.status === "active" ? "default" : "secondary"} className="ml-2 text-xs">
                        {seq.status}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-1.5 mt-2">
                      {(seq.channels || []).map(ch => {
                        const config = channelConfig[ch as keyof typeof channelConfig];
                        if (!config) return null;
                        const Icon = config.icon;
                        return <Badge key={ch} variant="outline" className={`text-[10px] px-1.5 py-0 ${config.color}`}><Icon className="h-3 w-3 mr-0.5" />{config.label}</Badge>;
                      })}
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-xs"
                        onClick={e => { e.stopPropagation(); toggleStatus.mutate({ id: seq.id, status: seq.status }); }}
                      >
                        {seq.status === "active" ? <><Pause className="h-3 w-3 mr-1" />Pause</> : <><Play className="h-3 w-3 mr-1" />Activate</>}
                      </Button>
                      <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive" onClick={e => { e.stopPropagation(); deleteMutation.mutate(seq.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>

          {/* Sequence detail */}
          <div className="md:col-span-2">
            {activeSeq ? (
              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-lg">{activeSeq.name}</CardTitle>
                      <CardDescription>{activeSeq.description || "Multi-channel outreach sequence"}</CardDescription>
                    </div>
                    <Button
                      variant="outline"
                      className="gap-2"
                      disabled={aiLoading}
                      onClick={() => generateSteps(activeSeq)}
                    >
                      {aiLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                      AI Generate Steps
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <Tabs defaultValue="steps">
                    <TabsList className="mb-4">
                      <TabsTrigger value="steps">Steps ({steps.length})</TabsTrigger>
                      <TabsTrigger value="enrolled">Enrolled ({enrollments.length})</TabsTrigger>
                      <TabsTrigger value="analytics">Analytics</TabsTrigger>
                    </TabsList>

                    <TabsContent value="steps">
                      <div className="space-y-3">
                        {steps.map((step, idx) => {
                          const config = channelConfig[step.channel as keyof typeof channelConfig] || channelConfig.email;
                          const Icon = config.icon;
                          return (
                            <div key={step.id} className="flex gap-3 items-start">
                              <div className="flex flex-col items-center">
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${config.color}`}>
                                  {idx + 1}
                                </div>
                                {idx < steps.length - 1 && <div className="w-px h-8 bg-border mt-1" />}
                              </div>
                              <Card className="flex-1">
                                <CardContent className="p-3">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <Badge variant="outline" className={`text-xs gap-1 ${config.color}`}>
                                        <Icon className="h-3 w-3" />{config.label}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                                        <Clock className="h-3 w-3" /> Wait {step.delay_days}d
                                      </span>
                                    </div>
                                    <Button size="sm" variant="ghost" className="h-6 w-6 p-0 text-destructive" onClick={() => deleteStep.mutate(step.id)}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                  {step.subject && <p className="text-xs font-medium mb-1">Subject: {step.subject}</p>}
                                  <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-3">{step.body}</p>
                                </CardContent>
                              </Card>
                            </div>
                          );
                        })}
                        <Button
                          variant="outline"
                          className="w-full mt-2 gap-2 border-dashed"
                          onClick={() => {
                            addStep.mutate({
                              sequence_id: activeSeq.id,
                              step_order: steps.length + 1,
                              channel: "email",
                              delay_days: steps.length === 0 ? 0 : 2,
                              subject: "",
                              body: "",
                            });
                          }}
                        >
                          <Plus className="h-4 w-4" /> Add Step
                        </Button>
                      </div>
                    </TabsContent>

                    <TabsContent value="enrolled">
                      {enrollments.length === 0 ? (
                        <div className="text-center py-8 text-muted-foreground">
                          <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                          <p className="text-sm">No leads enrolled in this sequence yet.</p>
                          <p className="text-xs mt-1">Enroll leads from the Leads page.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {enrollments.map(e => (
                            <div key={e.id} className="flex items-center justify-between p-3 border rounded-lg">
                              <div>
                                <p className="text-sm font-medium">{e.leads?.business_name || "Unknown"}</p>
                                <p className="text-xs text-muted-foreground">{e.leads?.email || "No email"}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <Badge variant="outline" className="text-xs">Step {e.current_step}</Badge>
                                <Badge variant={e.status === "active" ? "default" : "secondary"} className="text-xs">{e.status}</Badge>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </TabsContent>

                    <TabsContent value="analytics">
                      <div className="text-center py-8 text-muted-foreground">
                        <BarChart3 className="h-8 w-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Analytics will populate as leads progress through the sequence.</p>
                        <p className="text-xs mt-1">Track open rates, replies, and conversions per step.</p>
                      </div>
                    </TabsContent>
                  </Tabs>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-dashed">
                <CardContent className="p-12 text-center">
                  <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3 opacity-50" />
                  <h3 className="text-lg font-medium mb-1">Select a Sequence</h3>
                  <p className="text-sm text-muted-foreground">Choose a sequence from the left or create a new one to start building your outreach flow.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>

      {/* Create dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New Sequence</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1 block">Name</label>
              <Input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g., Cold Outreach Q2" />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Description</label>
              <Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Brief description..." rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium mb-1 block">Tone</label>
                <Select value={form.tone} onValueChange={v => setForm(f => ({ ...f, tone: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                <Select value={form.goal} onValueChange={v => setForm(f => ({ ...f, goal: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="book a meeting">Book Meeting</SelectItem>
                    <SelectItem value="get a reply">Get Reply</SelectItem>
                    <SelectItem value="share a resource">Share Resource</SelectItem>
                    <SelectItem value="close a deal">Close Deal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-2 block">Channels</label>
              <div className="flex gap-4">
                {(["email", "sms", "linkedin"] as const).map(ch => {
                  const config = channelConfig[ch];
                  return (
                    <label key={ch} className="flex items-center gap-2 text-sm cursor-pointer">
                      <Checkbox checked={form.channels.includes(ch)} onCheckedChange={() => toggleChannel(ch)} />
                      <config.icon className="h-3.5 w-3.5" />
                      {config.label}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createMutation.mutate()} disabled={!form.name || createMutation.isPending}>
              {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
