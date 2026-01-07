import { useState, useEffect } from "react";
import { Phone, Mail, MessageSquare, Clock, Plus, Loader2, Send, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CallDialog } from "./CallDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { z } from "zod";

interface ConversationLog {
  id: string;
  lead_id: string;
  client_id: string;
  type: string;
  direction: string | null;
  subject: string | null;
  content: string | null;
  duration_seconds: number | null;
  created_at: string;
  recording_url: string | null;
  call_sid: string | null;
}

interface CommunicationPanelProps {
  leadId: string;
  clientId: string;
  leadEmail: string | null;
  leadPhone: string | null;
  leadName: string | null;
  businessName?: string | null;
}

type LogType = "call" | "email" | "sms" | "note";
type LogDirection = "inbound" | "outbound";

const e164Regex = /^\+[1-9]\d{1,14}$/;
const isE164 = (value: string) => e164Regex.test(value);

const logSchema = z.object({
  type: z.enum(["call", "email", "sms", "note"]),
  direction: z.enum(["inbound", "outbound"]).optional(),
  subject: z.string().max(200).optional(),
  content: z.string().max(5000).optional(),
  duration_seconds: z.number().min(0).max(86400).optional(),
});

export function CommunicationPanel({
  leadId,
  clientId,
  leadEmail,
  leadPhone,
  leadName,
  businessName,
}: CommunicationPanelProps) {
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSending, setIsSending] = useState(false);
  
  // Dialog states
  const [smsDialogOpen, setSmsDialogOpen] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [recapDialogOpen, setRecapDialogOpen] = useState(false);
  const [callDialogOpen, setCallDialogOpen] = useState(false);
  const [smsMessage, setSmsMessage] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);
  const [recapEmail, setRecapEmail] = useState("");
  const [recapSms, setRecapSms] = useState("");
  const [emailBody, setEmailBody] = useState("");
  
  const [newLog, setNewLog] = useState<{
    type: LogType;
    direction: LogDirection;
    subject: string;
    content: string;
    duration_seconds: number;
  }>({
    type: "call",
    direction: "outbound",
    subject: "",
    content: "",
    duration_seconds: 0,
  });

  useEffect(() => {
    fetchLogs();
  }, [leadId]);

  const fetchLogs = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("conversation_logs")
      .select("*")
      .eq("lead_id", leadId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setLogs(data);
    }
    setIsLoading(false);
  };

  const handleCall = async () => {
    if (!leadPhone) {
      toast.error("No phone number available");
      return;
    }

    if (!isE164(leadPhone)) {
      toast.error("Lead phone must be in E.164 format (example: +15551234567)");
      return;
    }
    
    // Open the call dialog immediately for visual feedback
    setCallDialogOpen(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("make-call", {
        body: { to: leadPhone, leadId },
      });
      
      if (error) throw error;
      // Call initiated - dialog will show status
    } catch (err: any) {
      console.error("Call error:", err);
      toast.error(err.message || "Failed to initiate call");
      setCallDialogOpen(false);
    }
  };

  const handleEndCall = () => {
    fetchLogs();
    toast.success("Call ended");
  };

  const handleEmail = () => {
    if (!leadEmail) {
      toast.error("No email address available");
      return;
    }
    setEmailSubject(`Following up - ${leadName || "Lead"}`);
    setEmailBody("");
    setEmailDialogOpen(true);
  };

  const sendEmail = async () => {
    if (!leadEmail || !emailSubject || !emailBody) {
      toast.error("Please fill in all fields");
      return;
    }
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-email", {
        body: { to: leadEmail, subject: emailSubject, body: emailBody, leadId },
      });
      
      if (error) throw error;
      toast.success("Email sent successfully");
      setEmailDialogOpen(false);
      setEmailSubject("");
      setEmailBody("");
      fetchLogs();
    } catch (err: any) {
      console.error("Email error:", err);
      toast.error(err.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const handleSMS = () => {
    if (!leadPhone) {
      toast.error("No phone number available");
      return;
    }

    if (!isE164(leadPhone)) {
      toast.error("Lead phone must be in E.164 format (example: +15551234567)");
      return;
    }

    setSmsMessage("");
    setSmsDialogOpen(true);
  };

  const sendSMS = async () => {
    if (!leadPhone) {
      toast.error("No phone number available");
      return;
    }

    if (!isE164(leadPhone)) {
      toast.error("Lead phone must be in E.164 format (example: +15551234567)");
      return;
    }

    if (!smsMessage) {
      toast.error("Please enter a message");
      return;
    }
    
    setIsSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-sms", {
        body: { to: leadPhone, message: smsMessage, leadId },
      });
      
      if (error) throw error;
      toast.success("SMS sent successfully");
      setSmsDialogOpen(false);
      setSmsMessage("");
      fetchLogs();
    } catch (err: any) {
      console.error("SMS error:", err);
      toast.error(err.message || "Failed to send SMS");
    } finally {
      setIsSending(false);
    }
  };

  const handleGenerateRecap = async (recordingUrl?: string) => {
    setRecapDialogOpen(true);
    setIsGeneratingRecap(true);
    setRecapEmail("");
    setRecapSms("");

    try {
      const { data, error } = await supabase.functions.invoke("generate-call-recap", {
        body: { 
          recordingUrl: recordingUrl || null, 
          leadName: leadName || "Contact",
          businessName: businessName || "the company"
        },
      });

      if (error) throw error;

      setRecapEmail(data.emailContent || "");
      setRecapSms(data.smsContent || "");
    } catch (err: any) {
      console.error("Recap error:", err);
      toast.error(err.message || "Failed to generate recap");
    } finally {
      setIsGeneratingRecap(false);
    }
  };

  // Get the most recent call with a recording
  const getLatestRecordingUrl = () => {
    const callWithRecording = logs.find(log => log.type === "call" && log.recording_url);
    return callWithRecording?.recording_url || null;
  };

  const sendRecapEmail = async () => {
    if (!leadEmail || !recapEmail) {
      toast.error("Missing email content");
      return;
    }

    setIsSending(true);
    try {
      // Extract subject from email content if present
      const lines = recapEmail.split('\n');
      let subject = `Call Follow-up - ${leadName || "Lead"}`;
      let body = recapEmail;
      
      if (lines[0]?.toLowerCase().startsWith('subject:')) {
        subject = lines[0].replace(/^subject:\s*/i, '').trim();
        body = lines.slice(1).join('\n').trim();
      }

      const { error } = await supabase.functions.invoke("send-email", {
        body: { to: leadEmail, subject, body, leadId },
      });

      if (error) throw error;
      toast.success("Recap email sent!");
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to send email");
    } finally {
      setIsSending(false);
    }
  };

  const sendRecapSms = async () => {
    if (!leadPhone || !recapSms) {
      toast.error("Missing SMS content");
      return;
    }

    setIsSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-sms", {
        body: { to: leadPhone, message: recapSms, leadId },
      });

      if (error) throw error;
      toast.success("Recap SMS sent!");
      fetchLogs();
    } catch (err: any) {
      toast.error(err.message || "Failed to send SMS");
    } finally {
      setIsSending(false);
    }
  };

  const saveLog = async () => {
    const validation = logSchema.safeParse(newLog);
    if (!validation.success) {
      toast.error(validation.error.errors[0].message);
      return;
    }

    setIsSaving(true);
    const { error } = await supabase.from("conversation_logs").insert({
      lead_id: leadId,
      client_id: clientId,
      type: newLog.type,
      direction: newLog.direction,
      subject: newLog.subject || null,
      content: newLog.content || null,
      duration_seconds: newLog.type === "call" ? newLog.duration_seconds || null : null,
    });

    if (error) {
      toast.error("Failed to save log");
    } else {
      toast.success("Conversation logged");
      setNewLog({
        type: "call",
        direction: "outbound",
        subject: "",
        content: "",
        duration_seconds: 0,
      });
      setIsAdding(false);
      fetchLogs();
    }
    setIsSaving(false);
  };

  const formatDuration = (seconds: number | null) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="w-4 h-4" />;
      case "email":
        return <Mail className="w-4 h-4" />;
      case "sms":
        return <MessageSquare className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "call":
        return "text-green-500 bg-green-500/10";
      case "email":
        return "text-blue-500 bg-blue-500/10";
      case "sms":
        return "text-purple-500 bg-purple-500/10";
      default:
        return "text-muted-foreground bg-muted";
    }
  };

  return (
    <>
      {/* Call Dialog */}
      <CallDialog
        open={callDialogOpen}
        onOpenChange={setCallDialogOpen}
        leadName={leadName}
        leadPhone={leadPhone}
        onEndCall={handleEndCall}
      />

      {/* SMS Dialog */}
      <Dialog open={smsDialogOpen} onOpenChange={setSmsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send SMS to {leadName || leadPhone}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="Type your message..."
              value={smsMessage}
              onChange={(e) => setSmsMessage(e.target.value)}
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSmsDialogOpen(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={sendSMS} disabled={isSending || !smsMessage}>
              {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send SMS
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Send Email to {leadName || leadEmail}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              placeholder="Subject"
              value={emailSubject}
              onChange={(e) => setEmailSubject(e.target.value)}
            />
            <Textarea
              placeholder="Type your message..."
              value={emailBody}
              onChange={(e) => setEmailBody(e.target.value)}
              rows={6}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEmailDialogOpen(false)} disabled={isSending}>
              Cancel
            </Button>
            <Button onClick={sendEmail} disabled={isSending || !emailSubject || !emailBody}>
              {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
              Send Email
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Recap Dialog */}
      <Dialog open={recapDialogOpen} onOpenChange={setRecapDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              AI-Generated Call Recap
            </DialogTitle>
          </DialogHeader>
          
          {isGeneratingRecap ? (
            <div className="flex flex-col items-center justify-center py-8 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Generating recap with AI...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Email Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <Mail className="w-4 h-4" />
                    Follow-up Email
                  </label>
                  <Button 
                    size="sm" 
                    onClick={sendRecapEmail}
                    disabled={isSending || !leadEmail || !recapEmail}
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Send Email
                  </Button>
                </div>
                <Textarea
                  value={recapEmail}
                  onChange={(e) => setRecapEmail(e.target.value)}
                  rows={8}
                  placeholder="Email content will appear here..."
                  className="font-mono text-sm"
                />
              </div>

              {/* SMS Section */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    Follow-up SMS
                    <span className="text-xs text-muted-foreground">({recapSms.length}/160)</span>
                  </label>
                  <Button 
                    size="sm" 
                    onClick={sendRecapSms}
                    disabled={isSending || !leadPhone || !recapSms}
                  >
                    {isSending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
                    Send SMS
                  </Button>
                </div>
                <Textarea
                  value={recapSms}
                  onChange={(e) => setRecapSms(e.target.value)}
                  rows={2}
                  placeholder="SMS content will appear here..."
                  maxLength={160}
                />
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRecapDialogOpen(false)}>
              Close
            </Button>
            <Button variant="outline" onClick={() => handleGenerateRecap(getLatestRecordingUrl() || undefined)} disabled={isGeneratingRecap}>
              <Sparkles className="w-4 h-4 mr-2" />
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="space-y-4">
        {/* Quick Actions */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCall}
            disabled={!leadPhone || isSending}
            className="flex-1 gap-2"
          >
            {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Phone className="w-4 h-4" />}
            Call
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleEmail}
            disabled={!leadEmail}
            className="flex-1 gap-2"
          >
            <Mail className="w-4 h-4" />
            Email
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleSMS}
            disabled={!leadPhone}
            className="flex-1 gap-2"
          >
            <MessageSquare className="w-4 h-4" />
            SMS
          </Button>
        </div>

        {/* Generate Recap Button */}
        <Button
          variant="secondary"
          size="sm"
          onClick={() => handleGenerateRecap(getLatestRecordingUrl() || undefined)}
          className="w-full gap-2"
        >
          <Sparkles className="w-4 h-4" />
          Generate AI Recap
        </Button>

      {/* Add Log Button */}
      {!isAdding && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setIsAdding(true)}
          className="w-full gap-2 text-muted-foreground"
        >
          <Plus className="w-4 h-4" />
          Log Conversation
        </Button>
      )}

      {/* New Log Form */}
      {isAdding && (
        <div className="p-4 rounded-lg border border-border bg-secondary/30 space-y-3">
          <div className="flex gap-2">
            <Select
              value={newLog.type}
              onValueChange={(value: string) =>
                setNewLog({ ...newLog, type: value as LogType })
              }
            >
              <SelectTrigger className="w-28">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="call">Call</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
                <SelectItem value="note">Note</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={newLog.direction}
              onValueChange={(value: string) =>
                setNewLog({ ...newLog, direction: value as LogDirection })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="outbound">Outbound</SelectItem>
                <SelectItem value="inbound">Inbound</SelectItem>
              </SelectContent>
            </Select>
            {newLog.type === "call" && (
              <Input
                type="number"
                placeholder="Duration (sec)"
                value={newLog.duration_seconds || ""}
                onChange={(e) =>
                  setNewLog({ ...newLog, duration_seconds: parseInt(e.target.value) || 0 })
                }
                className="w-32"
              />
            )}
          </div>
          {(newLog.type === "email" || newLog.type === "note") && (
            <Input
              placeholder="Subject"
              value={newLog.subject}
              onChange={(e) => setNewLog({ ...newLog, subject: e.target.value })}
            />
          )}
          <Textarea
            placeholder="Notes about the conversation..."
            value={newLog.content}
            onChange={(e) => setNewLog({ ...newLog, content: e.target.value })}
            rows={3}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={saveLog} disabled={isSaving}>
              Save Log
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsAdding(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Conversation History */}
      <div className="space-y-2">
        <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
          <Clock className="w-4 h-4" />
          Conversation History
        </h4>
        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading...</p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">No conversations logged yet</p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {logs.map((log) => (
              <div
                key={log.id}
                className="p-3 rounded-lg border border-border bg-background/50"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`p-1 rounded ${getTypeColor(log.type)}`}>
                    {getTypeIcon(log.type)}
                  </span>
                  <span className="text-sm font-medium capitalize">{log.type}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    ({log.direction})
                  </span>
                  {log.duration_seconds && (
                    <span className="text-xs text-muted-foreground">
                      • {formatDuration(log.duration_seconds)}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground ml-auto">
                    {new Date(log.created_at).toLocaleDateString()}{" "}
                    {new Date(log.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>
                {log.subject && (
                  <p className="text-sm font-medium text-foreground">{log.subject}</p>
                )}
                {log.content && (
                  <p className="text-sm text-muted-foreground mt-1">{log.content}</p>
                )}
              </div>
            ))}
          </div>
          )}
        </div>
      </div>
    </>
  );
}
