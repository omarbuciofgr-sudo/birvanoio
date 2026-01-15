import { useState } from "react";
import { Zap, Send, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
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

interface ZapierIntegrationProps {
  leadData?: Record<string, unknown>;
  triggerType?: "new_lead" | "status_change" | "score_update" | "custom";
}

const ZapierIntegration = ({ leadData, triggerType = "custom" }: ZapierIntegrationProps) => {
  const [webhookUrl, setWebhookUrl] = useState("");
  const [selectedEvent, setSelectedEvent] = useState(triggerType);
  const [isLoading, setIsLoading] = useState(false);
  const [lastStatus, setLastStatus] = useState<"success" | "error" | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const eventTypes = [
    { value: "new_lead", label: "New Lead Created" },
    { value: "status_change", label: "Lead Status Changed" },
    { value: "score_update", label: "Lead Score Updated" },
    { value: "call_completed", label: "Call Completed" },
    { value: "email_sent", label: "Email Sent" },
    { value: "custom", label: "Custom Trigger" },
  ];

  const handleTrigger = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!webhookUrl) {
      toast.error("Please enter your Zapier webhook URL");
      return;
    }

    if (!webhookUrl.includes("hooks.zapier.com") && !webhookUrl.includes("hook.")) {
      toast.error("Please enter a valid Zapier webhook URL");
      return;
    }

    setIsLoading(true);
    setLastStatus(null);

    try {
      await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        mode: "no-cors",
        body: JSON.stringify({
          event_type: selectedEvent,
          timestamp: new Date().toISOString(),
          triggered_from: window.location.origin,
          data: leadData || {
            test: true,
            message: "This is a test trigger from Brivano",
          },
        }),
      });

      setLastStatus("success");
      toast.success("Webhook triggered! Check your Zap history to confirm.");
    } catch (error) {
      console.error("Error triggering webhook:", error);
      setLastStatus("error");
      toast.error("Failed to trigger webhook. Please check the URL and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Zap className="w-4 h-4" />
          Zapier
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-orange-500" />
            Zapier Integration
          </DialogTitle>
          <DialogDescription>
            Connect Brivano to 5,000+ apps via Zapier. Create a Zap with a webhook trigger to get started.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleTrigger} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="webhook-url">Webhook URL</Label>
            <Input
              id="webhook-url"
              type="url"
              placeholder="https://hooks.zapier.com/hooks/catch/..."
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              className="font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground">
              Create a Zap with "Webhooks by Zapier" as the trigger to get this URL.
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="event-type">Event Type</Label>
            <Select value={selectedEvent} onValueChange={(v) => setSelectedEvent(v as typeof selectedEvent)}>
              <SelectTrigger>
                <SelectValue placeholder="Select event type" />
              </SelectTrigger>
              <SelectContent>
                {eventTypes.map((event) => (
                  <SelectItem key={event.value} value={event.value}>
                    {event.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {lastStatus && (
            <div
              className={`flex items-center gap-2 p-3 rounded-lg ${
                lastStatus === "success"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-destructive/10 text-destructive"
              }`}
            >
              {lastStatus === "success" ? (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span className="text-sm">Webhook sent successfully!</span>
                </>
              ) : (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm">Failed to send webhook</span>
                </>
              )}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="submit"
              className="flex-1"
              disabled={isLoading || !webhookUrl}
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Test Webhook
                </>
              )}
            </Button>
          </div>
        </form>

        <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-border">
          <h4 className="text-sm font-medium text-foreground mb-2">Popular Zaps:</h4>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• Add new leads to Google Sheets</li>
            <li>• Send Slack notifications for hot leads</li>
            <li>• Create tasks in Asana/Monday.com</li>
            <li>• Sync with HubSpot or Salesforce</li>
            <li>• Send SMS via Twilio on status change</li>
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ZapierIntegration;
