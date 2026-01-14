import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Trash2, Plus, Webhook, Check, X, Key } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { ClientWebhook, ClientOrganization } from '@/types/scraper';

interface ClientWebhooksManagerProps {
  organizations: ClientOrganization[];
}

const WEBHOOK_EVENTS = [
  { value: 'lead_assigned', label: 'Lead Assigned' },
  { value: 'lead_status_changed', label: 'Lead Status Changed' },
  { value: 'lead_enriched', label: 'Lead Enriched' },
  { value: 'lead_verified', label: 'Lead Verified' },
];

export function ClientWebhooksManager({ organizations }: ClientWebhooksManagerProps) {
  const queryClient = useQueryClient();
  const [selectedOrg, setSelectedOrg] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newWebhook, setNewWebhook] = useState({
    name: '',
    webhook_url: '',
    events: ['lead_assigned'] as string[],
  });

  // Fetch webhooks for selected org
  const { data: webhooks = [], isLoading } = useQuery({
    queryKey: ['client-webhooks', selectedOrg],
    queryFn: async () => {
      if (!selectedOrg) return [];
      const { data, error } = await supabase
        .from('client_webhooks')
        .select('*')
        .eq('organization_id', selectedOrg)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ClientWebhook[];
    },
    enabled: !!selectedOrg,
  });

  // Create webhook
  const createMutation = useMutation({
    mutationFn: async () => {
      if (!selectedOrg) throw new Error('No organization selected');
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('client_webhooks').insert({
        organization_id: selectedOrg,
        name: newWebhook.name,
        webhook_url: newWebhook.webhook_url,
        events: newWebhook.events,
        created_by: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Webhook created successfully');
      queryClient.invalidateQueries({ queryKey: ['client-webhooks', selectedOrg] });
      setDialogOpen(false);
      setNewWebhook({ name: '', webhook_url: '', events: ['lead_assigned'] });
    },
    onError: (error: Error) => {
      toast.error('Failed to create webhook: ' + error.message);
    },
  });

  // Toggle webhook active state
  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const { error } = await supabase
        .from('client_webhooks')
        .update({ is_active: isActive })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['client-webhooks', selectedOrg] });
    },
  });

  // Delete webhook
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('client_webhooks').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Webhook deleted');
      queryClient.invalidateQueries({ queryKey: ['client-webhooks', selectedOrg] });
    },
    onError: (error: Error) => {
      toast.error('Failed to delete webhook: ' + error.message);
    },
  });

  const toggleEvent = (event: string) => {
    const events = newWebhook.events.includes(event)
      ? newWebhook.events.filter(e => e !== event)
      : [...newWebhook.events, event];
    setNewWebhook({ ...newWebhook, events });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Webhook className="h-5 w-5" />
          Client Webhooks
        </CardTitle>
        <CardDescription>
          Configure webhooks to notify clients when leads are assigned or updated
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="space-y-2 flex-1">
            <Label>Select Organization</Label>
            <Select value={selectedOrg} onValueChange={setSelectedOrg}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an organization" />
              </SelectTrigger>
              <SelectContent>
                {organizations.map((org) => (
                  <SelectItem key={org.id} value={org.id}>
                    {org.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedOrg && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-1" /> Add Webhook
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Webhook</DialogTitle>
                  <DialogDescription>
                    Create a new webhook to receive notifications
                  </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input
                      value={newWebhook.name}
                      onChange={(e) => setNewWebhook({ ...newWebhook, name: e.target.value })}
                      placeholder="My Webhook"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Webhook URL</Label>
                    <Input
                      value={newWebhook.webhook_url}
                      onChange={(e) => setNewWebhook({ ...newWebhook, webhook_url: e.target.value })}
                      placeholder="https://example.com/webhook"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Events</Label>
                    <div className="flex flex-wrap gap-2">
                      {WEBHOOK_EVENTS.map((event) => (
                        <Badge
                          key={event.value}
                          variant={newWebhook.events.includes(event.value) ? 'default' : 'outline'}
                          className="cursor-pointer"
                          onClick={() => toggleEvent(event.value)}
                        >
                          {event.label}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    Cancel
                  </Button>
                  <Button
                    onClick={() => createMutation.mutate()}
                    disabled={createMutation.isPending || !newWebhook.name || !newWebhook.webhook_url}
                  >
                    Create Webhook
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {selectedOrg && (
          isLoading ? (
            <div className="text-center py-8 text-muted-foreground">Loading webhooks...</div>
          ) : webhooks.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No webhooks configured for this organization
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>URL</TableHead>
                  <TableHead>Events</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Active</TableHead>
                  <TableHead className="w-16"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {webhooks.map((webhook) => (
                  <TableRow key={webhook.id}>
                    <TableCell className="font-medium">{webhook.name}</TableCell>
                    <TableCell className="font-mono text-xs max-w-48 truncate">
                      {webhook.webhook_url}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {webhook.events.map((event) => (
                          <Badge key={event} variant="outline" className="text-xs">
                            {event}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {webhook.failure_count > 0 ? (
                        <Badge variant="destructive" className="flex items-center gap-1 w-fit">
                          <X className="h-3 w-3" />
                          {webhook.failure_count} failures
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="flex items-center gap-1 w-fit bg-green-500/20 text-green-600">
                          <Check className="h-3 w-3" />
                          OK
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      <Switch
                        checked={webhook.is_active}
                        onCheckedChange={(checked) =>
                          toggleMutation.mutate({ id: webhook.id, isActive: checked })
                        }
                      />
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(webhook.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )
        )}
      </CardContent>
    </Card>
  );
}
