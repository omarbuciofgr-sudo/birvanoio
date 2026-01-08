import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Phone, Mic, Play, Pause, Clock, CheckCircle, XCircle, AlertCircle, Bot, Wand2, Loader2, Settings } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { ElevenLabsVoiceAgent } from "@/components/voice/ElevenLabsVoiceAgent";

interface VoiceCall {
  id: string;
  lead_id: string;
  client_id: string;
  status: string;
  script_template: string | null;
  ai_transcript: string | null;
  call_summary: string | null;
  call_outcome: string | null;
  duration_seconds: number | null;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  lead?: {
    business_name: string;
    contact_name: string | null;
    phone: string | null;
  };
}

interface Lead {
  id: string;
  business_name: string;
  contact_name: string | null;
  phone: string | null;
  email: string | null;
  status: string;
}

const statusConfig: Record<string, { label: string; icon: typeof CheckCircle; color: string }> = {
  pending: { label: "Pending", icon: Clock, color: "text-yellow-500 bg-yellow-500/10" },
  in_progress: { label: "In Progress", icon: Phone, color: "text-blue-500 bg-blue-500/10" },
  completed: { label: "Completed", icon: CheckCircle, color: "text-green-500 bg-green-500/10" },
  failed: { label: "Failed", icon: XCircle, color: "text-red-500 bg-red-500/10" },
  no_answer: { label: "No Answer", icon: AlertCircle, color: "text-muted-foreground bg-muted" },
};

const VoiceAgent = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isInitiating, setIsInitiating] = useState(false);

  // Form state
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [scriptTemplate, setScriptTemplate] = useState("");
  const [elevenLabsAgentId, setElevenLabsAgentId] = useState("");
  const [isLiveCallActive, setIsLiveCallActive] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchCalls();
      fetchLeads();
    }
  }, [user]);

  const fetchCalls = async () => {
    const { data, error } = await supabase
      .from("voice_agent_calls")
      .select("*, lead:leads(business_name, contact_name, phone)")
      .order("created_at", { ascending: false });

    if (!error && data) {
      setCalls(data as any);
    }
  };

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, business_name, contact_name, phone, email, status")
      .not("phone", "is", null)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLeads(data);
    }
  };

  const generateScript = async () => {
    const selectedLead = leads.find(l => l.id === selectedLeadId);
    if (!selectedLead) return;

    setIsGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-message", {
        body: {
          messageType: "call_script",
          leadName: selectedLead.contact_name || "Contact",
          businessName: selectedLead.business_name,
          context: "Initial outreach call to introduce our services and qualify the lead",
        },
      });

      if (error) throw error;

      if (data?.script) {
        setScriptTemplate(data.script);
      } else if (data?.body) {
        setScriptTemplate(data.body);
      }
      toast.success("AI generated call script!");
    } catch (err: any) {
      toast.error(err.message || "Failed to generate script");
    } finally {
      setIsGenerating(false);
    }
  };

  const initiateCall = async () => {
    if (!user || !selectedLeadId) return;

    const selectedLead = leads.find(l => l.id === selectedLeadId);
    if (!selectedLead?.phone) {
      toast.error("Selected lead has no phone number");
      return;
    }

    setIsInitiating(true);
    try {
      // Create the voice agent call record
      const { data: callData, error: insertError } = await supabase
        .from("voice_agent_calls")
        .insert({
          lead_id: selectedLeadId,
          client_id: user.id,
          script_template: scriptTemplate || null,
          status: "pending",
        })
        .select()
        .single();

      if (insertError) throw insertError;

      // In a real implementation, this would trigger the ElevenLabs voice agent
      // For now, we'll simulate a pending call
      toast.success("Voice agent call scheduled!");
      
      // Note: Full ElevenLabs integration would go here
      // The call would be initiated via an edge function that:
      // 1. Connects to ElevenLabs Conversational AI
      // 2. Uses the script as the agent's prompt
      // 3. Streams the conversation
      // 4. Updates the call record with transcript and outcome
      
      setIsDialogOpen(false);
      setSelectedLeadId("");
      setScriptTemplate("");
      fetchCalls();
    } catch (err: any) {
      toast.error(err.message || "Failed to initiate call");
    } finally {
      setIsInitiating(false);
    }
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "—";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!user) return null;

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold text-foreground flex items-center gap-3">
              <Bot className="w-8 h-8 text-primary" />
              Voice AI Agent
            </h1>
            <p className="text-muted-foreground">
              Automated AI-powered outbound calls for lead qualification
            </p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Phone className="w-4 h-4" />
            New AI Call
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-4">
          {[
            { label: "Total Calls", value: calls.length, icon: Phone },
            { label: "Completed", value: calls.filter(c => c.status === "completed").length, icon: CheckCircle },
            { label: "In Progress", value: calls.filter(c => c.status === "in_progress").length, icon: Mic },
            { label: "Pending", value: calls.filter(c => c.status === "pending").length, icon: Clock },
          ].map((stat) => (
            <Card key={stat.label}>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">{stat.label}</p>
                    <p className="text-2xl font-bold text-foreground">{stat.value}</p>
                  </div>
                  <stat.icon className="w-8 h-8 text-primary/50" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Calls Table */}
        <Card>
          <CardHeader>
            <CardTitle>Call History</CardTitle>
            <CardDescription>
              View and manage AI voice agent calls
            </CardDescription>
          </CardHeader>
          <CardContent>
            {calls.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Bot className="w-12 h-12 mx-auto mb-4 opacity-30" />
                <p>No voice agent calls yet</p>
                <p className="text-sm mt-1">Start an AI call to begin qualifying leads</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Duration</TableHead>
                    <TableHead>Outcome</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calls.map((call) => {
                    const status = statusConfig[call.status] || statusConfig.pending;
                    const StatusIcon = status.icon;

                    return (
                      <TableRow key={call.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{call.lead?.business_name}</p>
                            <p className="text-xs text-muted-foreground">
                              {call.lead?.contact_name} • {call.lead?.phone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge className={`${status.color} gap-1`}>
                            <StatusIcon className="w-3 h-3" />
                            {status.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {formatDuration(call.duration_seconds)}
                        </TableCell>
                        <TableCell>
                          {call.call_outcome ? (
                            <Badge variant="outline">{call.call_outcome}</Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDistanceToNow(new Date(call.created_at), { addSuffix: true })}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setSelectedCall(call)}
                          >
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* New Call Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start AI Voice Call</DialogTitle>
            <DialogDescription>
              Connect with ElevenLabs to have an AI agent call your leads
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">ElevenLabs Agent ID</label>
              <Input
                value={elevenLabsAgentId}
                onChange={(e) => setElevenLabsAgentId(e.target.value)}
                placeholder="Enter your ElevenLabs Agent ID"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Create an agent at{" "}
                <a 
                  href="https://elevenlabs.io/app/conversational-ai" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  ElevenLabs Conversational AI
                </a>
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Select Lead</label>
              <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a lead to call" />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      <div className="flex items-center gap-2">
                        <span>{lead.business_name}</span>
                        <span className="text-muted-foreground">
                          ({lead.contact_name || "No contact"})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLead && (
                <p className="text-xs text-muted-foreground mt-1">
                  Phone: {selectedLead.phone}
                </p>
              )}
            </div>

            {elevenLabsAgentId && selectedLeadId && (
              <div className="pt-2">
                <label className="text-sm font-medium mb-2 block">Live AI Call</label>
                <ElevenLabsVoiceAgent
                  agentId={elevenLabsAgentId}
                  leadName={selectedLead?.contact_name || selectedLead?.business_name}
                  onTranscriptUpdate={(transcript) => setLiveTranscript(transcript)}
                  onCallEnd={async (summary) => {
                    // Save the call record when call ends
                    if (user && selectedLeadId) {
                      await supabase.from("voice_agent_calls").insert({
                        lead_id: selectedLeadId,
                        client_id: user.id,
                        script_template: scriptTemplate || null,
                        ai_transcript: summary,
                        status: "completed",
                      });
                      fetchCalls();
                      toast.success("Call saved to history");
                    }
                  }}
                />
              </div>
            )}

            {!elevenLabsAgentId && (
              <div className="p-4 bg-secondary/50 rounded-lg">
                <h4 className="font-medium flex items-center gap-2 mb-2">
                  <Settings className="w-4 h-4" />
                  Setup Required
                </h4>
                <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                  <li>Go to <a href="https://elevenlabs.io/app/conversational-ai" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">ElevenLabs</a></li>
                  <li>Create a new Conversational AI agent</li>
                  <li>Configure your agent's voice and personality</li>
                  <li>Copy the Agent ID and paste it above</li>
                </ol>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Call Details Dialog */}
      <Dialog open={!!selectedCall} onOpenChange={() => setSelectedCall(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Lead</p>
                  <p className="font-medium">{selectedCall.lead?.business_name}</p>
                  <p className="text-sm text-muted-foreground">
                    {selectedCall.lead?.contact_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={statusConfig[selectedCall.status]?.color || ""}>
                    {statusConfig[selectedCall.status]?.label || selectedCall.status}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{formatDuration(selectedCall.duration_seconds)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Outcome</p>
                  <p className="font-medium">{selectedCall.call_outcome || "—"}</p>
                </div>
              </div>

              {selectedCall.script_template && (
                <div>
                  <p className="text-sm font-medium mb-2">Script</p>
                  <div className="p-3 bg-secondary/50 rounded-lg text-sm">
                    {selectedCall.script_template}
                  </div>
                </div>
              )}

              {selectedCall.ai_transcript && (
                <div>
                  <p className="text-sm font-medium mb-2">Transcript</p>
                  <div className="p-3 bg-secondary/50 rounded-lg text-sm max-h-48 overflow-y-auto">
                    {selectedCall.ai_transcript}
                  </div>
                </div>
              )}

              {selectedCall.call_summary && (
                <div>
                  <p className="text-sm font-medium mb-2">AI Summary</p>
                  <div className="p-3 bg-primary/5 border border-primary/20 rounded-lg text-sm">
                    {selectedCall.call_summary}
                  </div>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default VoiceAgent;
