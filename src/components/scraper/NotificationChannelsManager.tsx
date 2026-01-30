import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Bell, Trash2, TestTube, Slack, MessageSquare, Mail, Webhook, Loader2, CheckCircle2, XCircle } from 'lucide-react';

interface NotificationChannel {
  id: string;
  name: string;
  channel_type: 'slack' | 'teams' | 'email' | 'webhook';
  webhook_url: string | null;
  config: Record<string, unknown>;
  notify_on_high_value_lead: boolean;
  notify_on_job_failure: boolean;
  notify_on_job_complete: boolean;
  notify_on_daily_summary: boolean;
  high_value_lead_score: number;
  is_active: boolean;
  last_triggered_at: string | null;
  failure_count: number;
}

const CHANNEL_TYPES = [
  { value: 'slack', label: 'Slack', icon: Slack },
  { value: 'teams', label: 'Microsoft Teams', icon: MessageSquare },
  { value: 'email', label: 'Email', icon: Mail },
  { value: 'webhook', label: 'Custom Webhook', icon: Webhook },
];

export function NotificationChannelsManager() {
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [newChannel, setNewChannel] = useState({
    name: '',
    channel_type: 'slack' as const,
    webhook_url: '',
    notify_on_high_value_lead: true,
    notify_on_job_failure: true,
    notify_on_job_complete: false,
    high_value_lead_score: 80,
  });

  // Fetch channels
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['notification-channels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notification_channels')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as NotificationChannel[];
    },
  });

  // Create channel
  const createMutation = useMutation({
    mutationFn: async () => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from('notification_channels').insert({
        ...newChannel,
        created_by: userData.user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      setIsDialogOpen(false);
      setNewChannel({
        name: '',
        channel_type: 'slack',
        webhook_url: '',
        notify_on_high_value_lead: true,
        notify_on_job_failure: true,
        notify_on_job_complete: false,
        high_value_lead_score: 80,
      });
      toast.success('Notification channel created');
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  // Toggle channel
  const toggleMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from('notification_channels')
        .update({ is_active })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
    },
  });

  // Delete channel
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notification_channels').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notification-channels'] });
      toast.success('Channel deleted');
    },
  });

  // Test channel
  const testChannel = async (channel: NotificationChannel) => {
    setTestingId(channel.id);
    try {
      const { error } = await supabase.functions.invoke('send-notification', {
        body: {
          channel_id: channel.id,
          test: true,
          message: 'Test notification from Brivano',
        },
      });
      if (error) throw error;
      toast.success('Test notification sent');
    } catch {
      toast.error('Failed to send test notification');
    } finally {
      setTestingId(null);
    }
  };

  const getChannelIcon = (type: string) => {
    const channel = CHANNEL_TYPES.find(c => c.value === type);
    if (!channel) return <Webhook className="h-4 w-4" />;
    const Icon = channel.icon;
    return <Icon className="h-4 w-4" />;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Notification Channels
          </h2>
          <p className="text-sm text-muted-foreground">
            Configure Slack, Teams, or webhook notifications for important events
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Add Channel
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Notification Channel</DialogTitle>
              <DialogDescription>
                Configure a new channel to receive alerts
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>Channel Name</Label>
                <Input
                  placeholder="e.g., Sales Team Slack"
                  value={newChannel.name}
                  onChange={e => setNewChannel(prev => ({ ...prev, name: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Channel Type</Label>
                <Select
                  value={newChannel.channel_type}
                  onValueChange={v => setNewChannel(prev => ({ ...prev, channel_type: v as typeof prev.channel_type }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNEL_TYPES.map(type => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <type.icon className="h-4 w-4" />
                          {type.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Webhook URL</Label>
                <Input
                  placeholder="https://hooks.slack.com/services/..."
                  value={newChannel.webhook_url}
                  onChange={e => setNewChannel(prev => ({ ...prev, webhook_url: e.target.value }))}
                />
                <p className="text-xs text-muted-foreground">
                  {newChannel.channel_type === 'slack' ? 'Create an incoming webhook in your Slack workspace' :
                   newChannel.channel_type === 'teams' ? 'Create an incoming webhook connector in Teams' :
                   newChannel.channel_type === 'email' ? 'Enter email addresses (comma-separated)' :
                   'Enter your custom webhook endpoint'}
                </p>
              </div>
              <div className="space-y-3 pt-2">
                <Label>Notify On:</Label>
                <div className="flex items-center justify-between">
                  <span className="text-sm">High-Value Lead Detected</span>
                  <Switch
                    checked={newChannel.notify_on_high_value_lead}
                    onCheckedChange={checked => setNewChannel(prev => ({ ...prev, notify_on_high_value_lead: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Job Failure</span>
                  <Switch
                    checked={newChannel.notify_on_job_failure}
                    onCheckedChange={checked => setNewChannel(prev => ({ ...prev, notify_on_job_failure: checked }))}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Job Complete</span>
                  <Switch
                    checked={newChannel.notify_on_job_complete}
                    onCheckedChange={checked => setNewChannel(prev => ({ ...prev, notify_on_job_complete: checked }))}
                  />
                </div>
              </div>
              {newChannel.notify_on_high_value_lead && (
                <div className="space-y-2">
                  <Label>High-Value Score Threshold</Label>
                  <Input
                    type="number"
                    value={newChannel.high_value_lead_score}
                    onChange={e => setNewChannel(prev => ({ ...prev, high_value_lead_score: parseInt(e.target.value) || 80 }))}
                    min={0}
                    max={100}
                  />
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => createMutation.mutate()}
                disabled={!newChannel.name || !newChannel.webhook_url}
              >
                Create Channel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {channels.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Bell className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No notification channels configured</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Channel</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Triggers</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Active</TableHead>
                <TableHead className="w-24">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {channels.map(channel => (
                <TableRow key={channel.id}>
                  <TableCell>
                    <div>
                      <div className="font-medium">{channel.name}</div>
                      <div className="text-xs text-muted-foreground truncate max-w-48">
                        {channel.webhook_url}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="flex items-center gap-1 w-fit">
                      {getChannelIcon(channel.channel_type)}
                      {channel.channel_type}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {channel.notify_on_high_value_lead && (
                        <Badge variant="secondary" className="text-xs">High-Value Lead</Badge>
                      )}
                      {channel.notify_on_job_failure && (
                        <Badge variant="destructive" className="text-xs">Job Failure</Badge>
                      )}
                      {channel.notify_on_job_complete && (
                        <Badge variant="outline" className="text-xs">Job Complete</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    {channel.failure_count > 0 ? (
                      <div className="flex items-center gap-1 text-destructive">
                        <XCircle className="h-4 w-4" />
                        <span className="text-xs">{channel.failure_count} failures</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle2 className="h-4 w-4" />
                        <span className="text-xs">OK</span>
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Switch
                      checked={channel.is_active}
                      onCheckedChange={is_active => toggleMutation.mutate({ id: channel.id, is_active })}
                    />
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => testChannel(channel)}
                        disabled={testingId === channel.id}
                      >
                        {testingId === channel.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <TestTube className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteMutation.mutate(channel.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
