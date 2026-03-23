import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { 
  Webhook, 
  Plus, 
  Trash2, 
  Loader2, 
  CheckCircle2, 
  XCircle,
  Send,
  Clock,
  AlertTriangle
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const WEBHOOK_EVENTS = [
  { id: 'lead.created', label: 'Lead Created', description: 'When a new lead is scraped' },
  { id: 'lead.enriched', label: 'Lead Enriched', description: 'When enrichment completes' },
  { id: 'lead.validated', label: 'Lead Validated', description: 'When validation completes' },
  { id: 'lead.assigned', label: 'Lead Assigned', description: 'When lead is assigned to client' },
  { id: 'lead.status_changed', label: 'Status Changed', description: 'When lead status changes' },
  { id: 'lead.score_updated', label: 'Score Updated', description: 'When lead score changes' },
];

interface WebhookConfig {
  id: string;
  name: string;
  webhook_url: string;
  is_active: boolean;
  events: string[];
  created_at: string;
  last_triggered_at: string | null;
  failure_count: number;
}

export function WebhookNotificationsManager() {
  const queryClient = useQueryClient();
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    webhook_url: '',
    events: ['lead.created', 'lead.enriched'],
  });

  // Fetch webhooks - admin only
  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['admin-webhooks'],
    queryFn: async () => {
      // For now, we'll use the client_webhooks table for admin webhooks too
      // In production, you might want a separate admin_webhooks table
      const { data, error } = await supabase
        .from('webhook_integrations')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []).map(w => ({
        ...w,
        events: w.trigger_event ? [w.trigger_event] : [],
        failure_count: 0,
        last_triggered_at: null,
      })) as WebhookConfig[];
    },
  });

  // Add webhook
  const addWebhookMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Insert one entry per event (current schema limitation)
      for (const event of newWebhook.events) {
        const { error } = await supabase
          .from('webhook_integrations')
          .insert({
            name: `${newWebhook.name} - ${event}`,
            webhook_url: newWebhook.webhook_url,
            trigger_event: event,
            is_active: true,
            client_id: user.id,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success('Webhook added successfully');
      setIsAddDialogOpen(false);
      setNewWebhook({ name: '', webhook_url: '', events: ['lead.created'] });
      queryClient.invalidateQueries({ queryKey: ['admin-webhooks'] });
    },
    onError: (error) => {
      toast.error('Failed to add webhook: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  // Toggle webhook
  const toggleWebhookMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('webhook_integrations')
        .update({ is_active: isActive })
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-webhooks'] });
    },
  });

  // Delete webhook
  const deleteWebhookMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('webhook_integrations')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Webhook deleted');
      queryClient.invalidateQueries({ queryKey: ['admin-webhooks'] });
    },
  });

  // Test webhook
  const testWebhookMutation = useMutation({
    mutationFn: async (webhook: WebhookConfig) => {
      const testPayload = {
        event: 'test',
        timestamp: new Date().toISOString(),
        data: {
          message: 'This is a test webhook from Brivano',
          webhook_name: webhook.name,
        },
      };

      const response = await fetch(webhook.webhook_url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(testPayload),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      return response;
    },
    onSuccess: () => {
      toast.success('Test webhook sent successfully');
    },
    onError: (error) => {
      toast.error('Test failed: ' + (error instanceof Error ? error.message : 'Unknown error'));
    },
  });

  const toggleEvent = (eventId: string) => {
    setNewWebhook(prev => ({
      ...prev,
      events: prev.events.includes(eventId)
        ? prev.events.filter(e => e !== eventId)
        : [...prev.events, eventId],
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Webhook className="h-5 w-5" />
              Webhook Notifications
            </CardTitle>
            <CardDescription>
              Get notified when leads are created, enriched, or updated
            </CardDescription>
          </div>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Webhook
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Webhook</DialogTitle>
                <DialogDescription>
                  Configure a webhook to receive notifications for lead events.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input
                    id="name"
                    placeholder="My Webhook"
                    value={newWebhook.name}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="url">Webhook URL</Label>
                  <Input
                    id="url"
                    placeholder="https://example.com/webhook"
                    value={newWebhook.webhook_url}
                    onChange={(e) => setNewWebhook(prev => ({ ...prev, webhook_url: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Events</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {WEBHOOK_EVENTS.map(event => (
                      <div key={event.id} className="flex items-start space-x-2">
                        <Checkbox
                          id={event.id}
                          checked={newWebhook.events.includes(event.id)}
                          onCheckedChange={() => toggleEvent(event.id)}
                        />
                        <div>
                          <Label htmlFor={event.id} className="text-sm font-medium cursor-pointer">
                            {event.label}
                          </Label>
                          <p className="text-xs text-muted-foreground">{event.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={() => addWebhookMutation.mutate()}
                  disabled={!newWebhook.name || !newWebhook.webhook_url || newWebhook.events.length === 0 || addWebhookMutation.isPending}
                >
                  {addWebhookMutation.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Plus className="h-4 w-4 mr-2" />
                  )}
                  Add Webhook
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {webhooks.length === 0 ? (
          <Alert>
            <Webhook className="h-4 w-4" />
            <AlertDescription>
              No webhooks configured. Add a webhook to receive notifications when leads are processed.
            </AlertDescription>
          </Alert>
        ) : (
          <div className="space-y-4">
            {webhooks.map(webhook => (
              <div
                key={webhook.id}
                className="flex items-center justify-between p-4 border rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <Switch
                    checked={webhook.is_active}
                    onCheckedChange={(checked) => 
                      toggleWebhookMutation.mutate({ id: webhook.id, isActive: checked })
                    }
                  />
                  <div>
                    <div className="font-medium">{webhook.name}</div>
                    <code className="text-xs text-muted-foreground">{webhook.webhook_url}</code>
                    <div className="flex gap-1 mt-1">
                      {webhook.events.map(event => (
                        <Badge key={event} variant="outline" className="text-xs">
                          {event}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {webhook.failure_count > 0 && (
                    <Badge variant="destructive" className="text-xs">
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {webhook.failure_count} failures
                    </Badge>
                  )}
                  {webhook.last_triggered_at && (
                    <span className="text-xs text-muted-foreground">
                      Last: {format(new Date(webhook.last_triggered_at), 'MMM d, HH:mm')}
                    </span>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => testWebhookMutation.mutate(webhook)}
                    disabled={testWebhookMutation.isPending}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteWebhookMutation.mutate(webhook.id)}
                    disabled={deleteWebhookMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
