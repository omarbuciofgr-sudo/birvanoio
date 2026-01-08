import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Webhook, Trash2, Play, Loader2, Zap } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface WebhookIntegration {
  id: string;
  name: string;
  webhook_url: string;
  trigger_event: string;
  is_active: boolean;
  last_triggered_at: string | null;
  created_at: string;
}

interface WebhookIntegrationsProps {
  userId: string;
}

const triggerEvents = [
  { value: "lead_created", label: "Lead Created", description: "When a new lead is added" },
  { value: "lead_status_changed", label: "Lead Status Changed", description: "When a lead's status updates" },
  { value: "lead_converted", label: "Lead Converted", description: "When a lead is marked as converted" },
  { value: "call_completed", label: "Call Completed", description: "When a call finishes" },
  { value: "message_sent", label: "Message Sent", description: "When an email/SMS is sent" },
];

export function WebhookIntegrations({ userId }: WebhookIntegrationsProps) {
  const [webhooks, setWebhooks] = useState<WebhookIntegration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);

  // Form state
  const [formData, setFormData] = useState({
    name: "",
    webhook_url: "",
    trigger_event: "",
  });

  useEffect(() => {
    fetchWebhooks();
  }, [userId]);

  const fetchWebhooks = async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from("webhook_integrations")
      .select("*")
      .eq("client_id", userId)
      .order("created_at", { ascending: false });

    if (!error && data) {
      setWebhooks(data as WebhookIntegration[]);
    }
    setIsLoading(false);
  };

  const handleCreate = async () => {
    if (!formData.name || !formData.webhook_url || !formData.trigger_event) {
      toast.error("All fields are required");
      return;
    }

    // Basic URL validation
    try {
      new URL(formData.webhook_url);
    } catch {
      toast.error("Please enter a valid webhook URL");
      return;
    }

    const { error } = await supabase
      .from("webhook_integrations")
      .insert({
        client_id: userId,
        name: formData.name,
        webhook_url: formData.webhook_url,
        trigger_event: formData.trigger_event,
      });

    if (error) {
      toast.error("Failed to create webhook");
      return;
    }

    toast.success("Webhook integration created");
    setIsDialogOpen(false);
    setFormData({ name: "", webhook_url: "", trigger_event: "" });
    fetchWebhooks();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase
      .from("webhook_integrations")
      .delete()
      .eq("id", id);

    if (error) {
      toast.error("Failed to delete webhook");
      return;
    }
    toast.success("Webhook deleted");
    fetchWebhooks();
  };

  const handleToggle = async (id: string, isActive: boolean) => {
    const { error } = await supabase
      .from("webhook_integrations")
      .update({ is_active: isActive })
      .eq("id", id);

    if (error) {
      toast.error("Failed to update webhook");
      return;
    }
    fetchWebhooks();
  };

  const handleTest = async (webhook: WebhookIntegration) => {
    setTestingId(webhook.id);
    try {
      await fetch(webhook.webhook_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        mode: "no-cors",
        body: JSON.stringify({
          event: webhook.trigger_event,
          test: true,
          timestamp: new Date().toISOString(),
          data: {
            source: "Brivano CRM",
            message: "This is a test webhook from Brivano",
          },
        }),
      });

      // Update last triggered timestamp
      await supabase
        .from("webhook_integrations")
        .update({ last_triggered_at: new Date().toISOString() })
        .eq("id", webhook.id);

      toast.success("Test webhook sent! Check your Zap history.");
      fetchWebhooks();
    } catch (error) {
      toast.error("Failed to send test webhook");
    } finally {
      setTestingId(null);
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-yellow-500" />
              Webhook Integrations
            </CardTitle>
            <CardDescription>
              Connect with Zapier, Make, or other automation tools
            </CardDescription>
          </div>
          <Button onClick={() => setIsDialogOpen(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            Add Webhook
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-center py-8 text-muted-foreground">Loading...</div>
        ) : webhooks.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Webhook className="w-12 h-12 mx-auto mb-4 opacity-30" />
            <p>No webhook integrations yet</p>
            <p className="text-sm mt-1">Connect your CRM to other tools</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Triggered</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {webhooks.map((webhook) => (
                <TableRow key={webhook.id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{webhook.name}</p>
                      <p className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {webhook.webhook_url}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary">
                      {triggerEvents.find(e => e.value === webhook.trigger_event)?.label || webhook.trigger_event}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={webhook.is_active}
                      onCheckedChange={(v) => handleToggle(webhook.id, v)}
                    />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {webhook.last_triggered_at
                      ? formatDistanceToNow(new Date(webhook.last_triggered_at), { addSuffix: true })
                      : "Never"}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleTest(webhook)}
                        disabled={testingId === webhook.id}
                      >
                        {testingId === webhook.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Play className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive"
                        onClick={() => handleDelete(webhook.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Webhook Integration</DialogTitle>
            <DialogDescription>
              Connect to Zapier, Make, or any webhook-enabled service
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Integration Name</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Slack Notifications"
                className="mt-1"
              />
            </div>

            <div>
              <Label>Webhook URL</Label>
              <Input
                value={formData.webhook_url}
                onChange={(e) => setFormData({ ...formData, webhook_url: e.target.value })}
                placeholder="https://hooks.zapier.com/..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Get this from your Zapier Zap or automation tool
              </p>
            </div>

            <div>
              <Label>Trigger Event</Label>
              <Select 
                value={formData.trigger_event} 
                onValueChange={(v) => setFormData({ ...formData, trigger_event: v })}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Select trigger..." />
                </SelectTrigger>
                <SelectContent>
                  {triggerEvents.map((event) => (
                    <SelectItem key={event.value} value={event.value}>
                      <div>
                        <p>{event.label}</p>
                        <p className="text-xs text-muted-foreground">{event.description}</p>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate}>Create Integration</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
