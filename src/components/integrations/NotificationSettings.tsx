import { useState } from "react";
import { Bell, Slack, Mail, MessageSquare, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

interface NotificationSettings {
  slackWebhook: string;
  slackEnabled: boolean;
  emailEnabled: boolean;
  notifyOnNewLead: boolean;
  notifyOnHotLead: boolean;
  notifyOnStatusChange: boolean;
  notifyOnCallComplete: boolean;
}

const NotificationSettings = () => {
  const [settings, setSettings] = useState<NotificationSettings>({
    slackWebhook: "",
    slackEnabled: false,
    emailEnabled: true,
    notifyOnNewLead: true,
    notifyOnHotLead: true,
    notifyOnStatusChange: false,
    notifyOnCallComplete: true,
  });
  const [isTesting, setIsTesting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleTestSlack = async () => {
    if (!settings.slackWebhook) {
      toast.error("Please enter a Slack webhook URL");
      return;
    }

    setIsTesting(true);
    try {
      await fetch(settings.slackWebhook, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({
          text: "🎉 Test notification from Brivano! Your Slack integration is working.",
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: "🎉 *Test Notification from Brivano*\n\nYour Slack integration is working correctly!",
              },
            },
          ],
        }),
      });
      toast.success("Test message sent to Slack!");
    } catch {
      toast.error("Failed to send test message");
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    // Here you would save to your backend
    await new Promise((resolve) => setTimeout(resolve, 1000));
    toast.success("Notification settings saved!");
    setIsSaving(false);
  };

  const notificationOptions = [
    { key: "notifyOnNewLead", label: "New Lead Created", description: "Get notified when a new lead is added" },
    { key: "notifyOnHotLead", label: "Hot Lead Detected", description: "Instant alerts for high-scoring leads" },
    { key: "notifyOnStatusChange", label: "Status Changes", description: "When a lead moves through the pipeline" },
    { key: "notifyOnCallComplete", label: "Call Completed", description: "After AI voice agent completes a call" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Bell className="w-5 h-5 text-primary" />
          Notification Settings
        </CardTitle>
        <CardDescription>
          Configure how and when you receive notifications about your leads.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="channels" className="space-y-6">
          <TabsList>
            <TabsTrigger value="channels">Channels</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
          </TabsList>

          <TabsContent value="channels" className="space-y-6">
            {/* Slack Integration */}
            <div className="p-4 rounded-lg border border-border space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#4A154B] flex items-center justify-center">
                    <Slack className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Slack</p>
                    <p className="text-sm text-muted-foreground">Send notifications to a Slack channel</p>
                  </div>
                </div>
                <Switch
                  checked={settings.slackEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, slackEnabled: checked }))
                  }
                />
              </div>

              {settings.slackEnabled && (
                <div className="space-y-3 pt-2">
                  <div className="space-y-2">
                    <Label htmlFor="slack-webhook">Webhook URL</Label>
                    <Input
                      id="slack-webhook"
                      type="url"
                      placeholder="https://hooks.slack.com/services/..."
                      value={settings.slackWebhook}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, slackWebhook: e.target.value }))
                      }
                      className="font-mono text-sm"
                    />
                    <p className="text-xs text-muted-foreground">
                      Create an incoming webhook in your Slack workspace settings.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTestSlack}
                    disabled={isTesting || !settings.slackWebhook}
                  >
                    {isTesting ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <MessageSquare className="w-4 h-4 mr-2" />
                    )}
                    Send Test Message
                  </Button>
                </div>
              )}
            </div>

            {/* Email Notifications */}
            <div className="p-4 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Mail className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-medium text-foreground">Email</p>
                    <p className="text-sm text-muted-foreground">Receive email notifications</p>
                  </div>
                </div>
                <Switch
                  checked={settings.emailEnabled}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, emailEnabled: checked }))
                  }
                />
              </div>
            </div>
          </TabsContent>

          <TabsContent value="triggers" className="space-y-4">
            {notificationOptions.map((option) => (
              <div
                key={option.key}
                className="flex items-center justify-between p-4 rounded-lg border border-border"
              >
                <div>
                  <p className="font-medium text-foreground">{option.label}</p>
                  <p className="text-sm text-muted-foreground">{option.description}</p>
                </div>
                <Switch
                  checked={settings[option.key as keyof NotificationSettings] as boolean}
                  onCheckedChange={(checked) =>
                    setSettings((prev) => ({ ...prev, [option.key]: checked }))
                  }
                />
              </div>
            ))}
          </TabsContent>
        </Tabs>

        <div className="flex justify-end mt-6">
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              "Save Settings"
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};

export default NotificationSettings;
