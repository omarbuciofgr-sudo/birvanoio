import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
import { Plus, Clock, Mail, MessageSquare, Trash2, XCircle, CheckCircle, AlertCircle } from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface ScheduledMessage {
  id: string;
  lead_id: string;
  type: "email" | "sms";
  subject: string | null;
  body: string;
  scheduled_for: string;
  status: "pending" | "sent" | "failed" | "cancelled";
  sent_at: string | null;
  error_message: string | null;
  created_at: string;
  lead?: {
    business_name: string;
    contact_name: string | null;
  };
}

interface Lead {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
}

interface ScheduledMessagesProps {
  userId: string;
}

const statusConfig = {
  pending: { label: "Pending", icon: Clock, color: "text-yellow-500 bg-yellow-500/10" },
  sent: { label: "Sent", icon: CheckCircle, color: "text-green-500 bg-green-500/10" },
  failed: { label: "Failed", icon: AlertCircle, color: "text-red-500 bg-red-500/10" },
  cancelled: { label: "Cancelled", icon: XCircle, color: "text-muted-foreground bg-muted" },
};

export function ScheduledMessages({ userId }: ScheduledMessagesProps) {
  const [messages, setMessages] = useState<ScheduledMessage[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    lead_id: "",
    type: "email" as "email" | "sms",
    subject: "",
    body: "",
    scheduled_for: "",
    scheduled_time: "",
  });

  useEffect(() => {
    fetchMessages();
    fetchLeads();
  }, [userId]);

  const fetchMessages = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("scheduled_messages")
      .select("*, lead:leads(business_name, contact_name)")
      .eq("client_id", userId)
      .order("scheduled_for", { ascending: true });

    if (!error && data) {
      setMessages(data as any);
    }
    setIsLoading(false);
  };

  const fetchLeads = async () => {
    const { data, error } = await supabase
      .from("leads")
      .select("id, business_name, contact_name, email, phone")
      .order("business_name");

    if (!error && data) {
      setLeads(data);
    }
  };

  const handleCreate = async () => {
    if (!formData.lead_id || !formData.body || !formData.scheduled_for || !formData.scheduled_time) {
      toast.error("Please fill in all required fields");
      return;
    }

    const scheduledDateTime = new Date(`${formData.scheduled_for}T${formData.scheduled_time}`);
    if (scheduledDateTime <= new Date()) {
      toast.error("Scheduled time must be in the future");
      return;
    }

    const { error } = await supabase
      .from("scheduled_messages")
      .insert({
        client_id: userId,
        lead_id: formData.lead_id,
        type: formData.type,
        subject: formData.type === "email" ? formData.subject : null,
        body: formData.body,
        scheduled_for: scheduledDateTime.toISOString(),
      });

    if (error) {
      toast.error("Failed to schedule message");
      return;
    }

    toast.success("Message scheduled");
    setIsDialogOpen(false);
    resetForm();
    fetchMessages();
  };

  const handleCancel = async (id: string) => {
    const { error } = await supabase
      .from("scheduled_messages")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      toast.error("Failed to cancel message");
      return;
    }
    toast.success("Message cancelled");
    fetchMessages();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("scheduled_messages")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete message");
      return;
    }
    toast.success("Message deleted");
    fetchMessages();
  };

  const resetForm = () => {
    setFormData({
      lead_id: "",
      type: "email",
      subject: "",
      body: "",
      scheduled_for: "",
      scheduled_time: "",
    });
  };

  const selectedLead = leads.find(l => l.id === formData.lead_id);

  const pendingMessages = messages.filter(m => m.status === "pending");
  const pastMessages = messages.filter(m => m.status !== "pending");

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="w-5 h-5 text-primary" />
              Scheduled Messages
            </CardTitle>
            <CardDescription>
              Queue emails and SMS to send at optimal times
            </CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Schedule Message
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : messages.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No scheduled messages</p>
            <p className="text-sm mt-1">Schedule your first message</p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Pending Messages */}
            {pendingMessages.length > 0 && (
              <div>
                <h4 className="font-medium mb-3">Upcoming ({pendingMessages.length})</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Message</TableHead>
                      <TableHead>Scheduled For</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingMessages.map((msg) => (
                      <TableRow key={msg.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{msg.lead?.business_name}</p>
                            <p className="text-xs text-muted-foreground">{msg.lead?.contact_name}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          {msg.type === "email" ? (
                            <Mail className="w-4 h-4 text-purple-500" />
                          ) : (
                            <MessageSquare className="w-4 h-4 text-orange-500" />
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {msg.subject && <p className="font-medium text-sm truncate">{msg.subject}</p>}
                          <p className="text-sm text-muted-foreground truncate">{msg.body}</p>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{format(new Date(msg.scheduled_for), "MMM d, h:mm a")}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDistanceToNow(new Date(msg.scheduled_for), { addSuffix: true })}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleCancel(msg.id)}
                            >
                              <XCircle className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDelete(msg.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {/* Past Messages */}
            {pastMessages.length > 0 && (
              <div>
                <h4 className="font-medium mb-3 text-muted-foreground">History</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Lead</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Scheduled</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pastMessages.slice(0, 10).map((msg) => {
                      const status = statusConfig[msg.status];
                      const StatusIcon = status.icon;
                      return (
                        <TableRow key={msg.id}>
                          <TableCell>{msg.lead?.business_name}</TableCell>
                          <TableCell>
                            {msg.type === "email" ? (
                              <Mail className="w-4 h-4 text-purple-500" />
                            ) : (
                              <MessageSquare className="w-4 h-4 text-orange-500" />
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge className={status.color}>
                              <StatusIcon className="w-3 h-3 mr-1" />
                              {status.label}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(msg.scheduled_for), "MMM d, h:mm a")}
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive"
                              onClick={() => handleDelete(msg.id)}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Schedule Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Select Lead</label>
              <Select value={formData.lead_id} onValueChange={(v) => setFormData({ ...formData, lead_id: v })}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Choose a lead..." />
                </SelectTrigger>
                <SelectContent>
                  {leads.map((lead) => (
                    <SelectItem key={lead.id} value={lead.id}>
                      {lead.business_name} ({lead.contact_name || "No contact"})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Message Type</label>
              <Select 
                value={formData.type} 
                onValueChange={(v) => setFormData({ ...formData, type: v as "email" | "sms" })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="email" disabled={!selectedLead?.email}>
                    Email {!selectedLead?.email && "(no email)"}
                  </SelectItem>
                  <SelectItem value="sms" disabled={!selectedLead?.phone}>
                    SMS {!selectedLead?.phone && "(no phone)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === "email" && (
              <div>
                <label className="text-sm font-medium">Subject</label>
                <Input
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  placeholder="Email subject..."
                  className="mt-1"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium">Message</label>
              <Textarea
                value={formData.body}
                onChange={(e) => setFormData({ ...formData, body: e.target.value })}
                placeholder="Type your message..."
                rows={4}
                className="mt-1"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={formData.scheduled_for}
                  onChange={(e) => setFormData({ ...formData, scheduled_for: e.target.value })}
                  min={format(new Date(), "yyyy-MM-dd")}
                  className="mt-1"
                />
              </div>
              <div>
                <label className="text-sm font-medium">Time</label>
                <Input
                  type="time"
                  value={formData.scheduled_time}
                  onChange={(e) => setFormData({ ...formData, scheduled_time: e.target.value })}
                  className="mt-1"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Schedule Message</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
