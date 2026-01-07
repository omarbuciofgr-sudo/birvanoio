import { useState, useEffect } from "react";
import { Phone, Mail, MessageSquare, Clock, Plus } from "lucide-react";
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
}

interface CommunicationPanelProps {
  leadId: string;
  clientId: string;
  leadEmail: string | null;
  leadPhone: string | null;
  leadName: string | null;
}

type LogType = "call" | "email" | "sms" | "note";
type LogDirection = "inbound" | "outbound";

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
}: CommunicationPanelProps) {
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  
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

  const handleCall = () => {
    if (!leadPhone) {
      toast.error("No phone number available");
      return;
    }
    window.open(`tel:${leadPhone}`, "_self");
    setNewLog({ ...newLog, type: "call", direction: "outbound" });
    setIsAdding(true);
  };

  const handleEmail = () => {
    if (!leadEmail) {
      toast.error("No email address available");
      return;
    }
    const subject = encodeURIComponent(`Following up - ${leadName || "Lead"}`);
    window.open(`mailto:${leadEmail}?subject=${subject}`, "_self");
    setNewLog({ ...newLog, type: "email", direction: "outbound" });
    setIsAdding(true);
  };

  const handleSMS = () => {
    if (!leadPhone) {
      toast.error("No phone number available");
      return;
    }
    window.open(`sms:${leadPhone}`, "_self");
    setNewLog({ ...newLog, type: "sms", direction: "outbound" });
    setIsAdding(true);
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
    <div className="space-y-4">
      {/* Quick Actions */}
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleCall}
          disabled={!leadPhone}
          className="flex-1 gap-2"
        >
          <Phone className="w-4 h-4" />
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
  );
}
